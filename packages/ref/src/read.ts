/**
 * The reference module's READ interface.
 *
 * FR-B11: feature modules and apps ask this module questions; they do not
 * reach into its storage. Everything a consumer needs is here, and nothing
 * here exposes how the catalogue is stored.
 *
 * TWO implementations behind ONE interface, which is the whole reason the
 * interface exists (CC-2, FR-B10):
 *
 *   DatabaseCatalogue   the real one, reading ref.* as studens_ref
 *   SnapshotCatalogue   reads a snapshot file, so the app runs with no
 *                       database and the parser tests need no infrastructure
 *
 * When this moved from the file to Postgres on 2026-09-10, the API route
 * handlers did not change at all. That was the claim; this is the receipt.
 */
import { PrismaClient } from "@prisma/client";
import type { ParsedOffering, Snapshot } from "./index.js";
import { load } from "./ingestion/snapshot.js";
import { courseUrl } from "./ingestion/urls.js";

export interface CourseSummary {
  code: string;
  title: string;
  year: number;
  ects: number;
  quarter: string | null;
  /** Present only when UCLouvain owns the course. See OPEN-45. */
  teachers: string[];
  /** True when the course is taught at another institution (OPEN-45). */
  external: boolean;
}

export interface CourseDetail extends CourseSummary {
  /**
   * The official UCLouvain page for THIS offering.
   *
   * Derived from the code and the year, never stored. Storing it would put a
   * copy of UCLouvain's URL grammar in every row, so a change upstream would
   * leave every row stale instead of one function wrong. For years before
   * 2024 this canonical form redirects to the archive portal, which is exactly
   * the behaviour wanted: the link lands on the right page either way.
   */
  officialUrl: string;
  language: string | null;
  contactHours: string | null;
  /** FR-D19: scraped, never asked of reviewers. */
  assessment: string | null;
  themes: string | null;
  content: string | null;
  owningFaculty: string | null;
  /** Faculties this course was reached through. Many-to-many on purpose. */
  reachedVia: string[];
}

function summarise(o: ParsedOffering): CourseSummary {
  return {
    code: o.code,
    title: o.title,
    year: o.year,
    ects: o.ects,
    quarter: o.quarter,
    teachers: o.teachers,
    // A course with no teachers and no assessment on its UCLouvain page is
    // hosted elsewhere: verified on the ENANO courses, which carry only a
    // reference institution. See OPEN-45.
    external: o.teachers.length === 0 && o.assessment === null,
  };
}

export interface FacultySummary {
  code: string;
  name: string;
  programmes: number;
}

export interface ProgrammeSummary {
  code: string;
  title: string;
  faculty: string;
  courses: number;
}

/** What a consumer may ask the catalogue. Storage does not appear in it. */
export interface Catalogue {
  readonly year: number;
  readonly size: number;
  search(query: string, limit?: number): CourseSummary[] | Promise<CourseSummary[]>;
  get(code: string): (CourseDetail | null) | Promise<CourseDetail | null>;
  /** FR-D24 and FR-D25: browsing, not only searching. */
  faculties(): FacultySummary[] | Promise<FacultySummary[]>;
  programmes(facultyCode: string): ProgrammeSummary[] | Promise<ProgrammeSummary[]>;
  coursesOfProgramme(
    programmeCode: string,
  ): (CourseSummary[] | null) | Promise<CourseSummary[] | null>;
}

export class SnapshotCatalogue implements Catalogue {
  private constructor(private readonly snapshot: Snapshot) {}

  static async open(path: string): Promise<SnapshotCatalogue> {
    return new SnapshotCatalogue(await load(path));
  }

  get year(): number {
    return this.snapshot.year;
  }

  get size(): number {
    return this.snapshot.offerings.length;
  }

  /**
   * FR-D1 and FR-D2: match on code, then on words in the title. Exact and
   * prefix matching only; semantic matching is deferred (1.4).
   */
  search(query: string, limit = 25): CourseSummary[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const byCode: ParsedOffering[] = [];
    const byTitle: ParsedOffering[] = [];
    for (const o of this.snapshot.offerings) {
      if (o.code.startsWith(q)) byCode.push(o);
      else if (o.title.toLowerCase().includes(q)) byTitle.push(o);
    }
    // Code matches first: someone typing LEPL1503 wants that course, not a
    // course whose description mentions it.
    return [...byCode, ...byTitle].slice(0, limit).map(summarise);
  }

  faculties(): FacultySummary[] {
    return this.snapshot.faculties.map((f) => ({
      code: f.code,
      name: f.name,
      programmes: this.snapshot.programmes.filter((p) => p.faculty === f.code).length,
    }));
  }

  programmes(facultyCode: string): ProgrammeSummary[] {
    const known = new Set(this.snapshot.offerings.map((o) => o.code));
    return this.snapshot.programmes
      .filter((p) => p.faculty === facultyCode.toLowerCase())
      .map((p) => ({
        code: p.code,
        title: p.title,
        faculty: p.faculty,
        // Only courses actually present in this snapshot: a scoped run holds a
        // sample, and claiming a count we cannot show would be a lie.
        courses: new Set(
          this.snapshot.reachedVia
            .filter((r) => r.programme === p.code && known.has(r.code))
            .map((r) => r.code),
        ).size,
      }))
      .filter((p) => p.courses > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  coursesOfProgramme(programmeCode: string): CourseSummary[] | null {
    const code = programmeCode.toLowerCase();
    if (!this.snapshot.programmes.some((p) => p.code === code)) return null;
    const codes = new Set(
      this.snapshot.reachedVia.filter((r) => r.programme === code).map((r) => r.code),
    );
    return this.snapshot.offerings
      .filter((o) => codes.has(o.code))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(summarise);
  }

  get(code: string): CourseDetail | null {
    const o = this.snapshot.offerings.find((x) => x.code === code.toLowerCase());
    if (!o) return null;
    return {
      ...summarise(o),
      officialUrl: courseUrl(o.year, o.code),
      language: o.language,
      contactHours: o.contactHours,
      assessment: o.assessment,
      themes: o.themes,
      content: o.content,
      owningFaculty: o.owningFaculty,
      reachedVia: this.snapshot.reachedVia
        .filter((r) => r.code === o.code)
        .map((r) => r.faculty),
    };
  }
}

/**
 * The database-backed catalogue.
 *
 * Assumes the `studens_ref` role per query where possible, so a missing grant
 * shows up here rather than being masked by a more privileged connection. The
 * SQL is deliberately plain: search is a prefix match on the code and a
 * substring match on the title (FR-D1, FR-D2), and semantic matching is
 * deferred (1.4).
 */
export class DatabaseCatalogue implements Catalogue {
  private constructor(
    private readonly prisma: PrismaClient,
    readonly year: number,
    readonly size: number,
  ) {}

  static async open(opts: { client?: PrismaClient; year?: number } = {}): Promise<DatabaseCatalogue> {
    const prisma = opts.client ?? new PrismaClient();
    // Default to the most recent year the catalogue actually holds, rather
    // than to today's date: the two disagree whenever ingestion lags.
    const latest =
      opts.year ??
      (await prisma.courseOffering.aggregate({ _max: { year: true } }))._max.year ??
      0;
    const size = await prisma.courseOffering.count({ where: { year: latest } });
    if (size === 0) {
      throw new Error(
        `the catalogue holds no offerings for year ${latest}. ` +
          `Run: npm run ingest -- --faculty epl --max 40 && npm run db:load`,
      );
    }
    return new DatabaseCatalogue(prisma, latest, size);
  }

  async search(query: string, limit = 25): Promise<CourseSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const rows = await this.prisma.courseOffering.findMany({
      where: {
        year: this.year,
        OR: [
          { course: { code: { startsWith: q } } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { course: true, teachers: true },
      take: limit,
    });

    // Code matches first: someone typing LEPL1503 wants that course, not one
    // whose title happens to contain the string.
    const scored = rows.map((r) => ({
      row: r,
      code: r.course.code.startsWith(q) ? 0 : 1,
    }));
    scored.sort((a, b) => a.code - b.code || a.row.course.code.localeCompare(b.row.course.code));

    return scored.map(({ row }) => ({
      code: row.course.code,
      title: row.title,
      year: row.year,
      ects: Number(row.ects),
      quarter: row.quarter,
      teachers: row.teachers.map((t) => t.teacherName),
      external: row.teachers.length === 0 && row.assessment === null,
    }));
  }

  async get(code: string): Promise<CourseDetail | null> {
    const row = await this.prisma.courseOffering.findFirst({
      where: { year: this.year, course: { code: code.toLowerCase() } },
      include: { course: true, teachers: true, faculties: { include: { faculty: true } } },
    });
    if (!row) return null;
    return {
      code: row.course.code,
      title: row.title,
      year: row.year,
      ects: Number(row.ects),
      quarter: row.quarter,
      teachers: row.teachers.map((t) => t.teacherName),
      external: row.teachers.length === 0 && row.assessment === null,
      officialUrl: courseUrl(row.year, row.course.code),
      language: row.language,
      contactHours: row.contactHours,
      assessment: row.assessment,
      themes: row.themes,
      content: row.content,
      owningFaculty: row.owningFaculty,
      reachedVia: row.faculties.map((f) => f.faculty.code),
    };
  }

  async faculties(): Promise<FacultySummary[]> {
    const rows = await this.prisma.faculty.findMany({
      include: { _count: { select: { programmes: true } } },
      orderBy: { code: "asc" },
    });
    return rows
      .map((f) => ({ code: f.code, name: f.name, programmes: f._count.programmes }))
      .filter((f) => f.programmes > 0);
  }

  async programmes(facultyCode: string): Promise<ProgrammeSummary[]> {
    const rows = await this.prisma.programme.findMany({
      where: { year: this.year, faculty: { code: facultyCode.toLowerCase() } },
      include: { faculty: true, _count: { select: { offerings: true } } },
      orderBy: { title: "asc" },
    });
    return rows
      .filter((p) => p._count.offerings > 0)
      .map((p) => ({
        code: p.code,
        title: p.title,
        faculty: p.faculty.code,
        courses: p._count.offerings,
      }));
  }

  async coursesOfProgramme(programmeCode: string): Promise<CourseSummary[] | null> {
    const programme = await this.prisma.programme.findUnique({
      where: { code_year: { code: programmeCode.toLowerCase(), year: this.year } },
    });
    if (!programme) return null;
    const rows = await this.prisma.programmeOffering.findMany({
      where: { programmeId: programme.id },
      include: { offering: { include: { course: true, teachers: true } } },
    });
    return rows
      .map(({ offering }) => ({
        code: offering.course.code,
        title: offering.title,
        year: offering.year,
        ects: Number(offering.ects),
        quarter: offering.quarter,
        teachers: offering.teachers.map((t) => t.teacherName),
        external: offering.teachers.length === 0 && offering.assessment === null,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
}

/**
 * Browse support for the database-backed catalogue (FR-D24, FR-D25).
 *
 * Counts are of courses actually present, not of courses the programme
 * nominally contains: a scoped ingestion run holds a sample, and a count we
 * cannot then show would be a lie.
 */
export interface BrowseQueries {
  faculties(): Promise<FacultySummary[]>;
  programmes(facultyCode: string): Promise<ProgrammeSummary[]>;
  coursesOfProgramme(programmeCode: string): Promise<CourseSummary[] | null>;
}
