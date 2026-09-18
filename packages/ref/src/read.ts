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
import type { Prisma } from "@prisma/client";
import type { ParsedOffering, Snapshot } from "./index.js";
import type { Block } from "./ingestion/parse/rich.js";
import { load } from "./ingestion/snapshot.js";
import { officialCourseUrl, officialProgrammeUrl } from "./sources/official-url.js";
import { mainLanguage } from "./ingestion/parse/offering.js";
import type { ProgrammeKind } from "./ingestion/parse/programme.js";

/**
 * A Json column back into a block tree.
 *
 * The only writer is `load.ts`, and the migration that introduced these
 * columns dropped whatever was in them, so the shape is not in doubt. The
 * check is here because a Json column's type says nothing: without it, a
 * malformed row would reach the renderer as `any` and fail there instead,
 * far from the cause.
 *
 * A row that fails the check reads as absent rather than throwing. A course
 * page missing one field is better than a course page that will not load, and
 * the field is rebuilt by the next ingestion either way.
 */
function blocksFrom(value: Prisma.JsonValue): Block[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (typeof first !== "object" || first === null || !("kind" in first)) return null;
  return value as unknown as Block[];
}

export interface CourseSummary {
  code: string;
  title: string;
  /** The year this description comes from, which is not always the current one. */
  year: number;
  /**
   * False when the institution no longer offers the course in the catalogue's
   * current year, and this description is the most recent one it published.
   *
   * A course identity outlives a yearly offering, which is why they are two
   * tables: `LINGI` became `LINFO`, codes appear and vanish. Before this, a
   * course with no offering for the current year could not be opened at all,
   * so 61 of them were unreachable and any review written about one would have
   * become invisible with it. FR-D16 says a review survives a missing offering,
   * and it cannot if the page it lives on has gone.
   */
  offeredThisYear: boolean;
  /** Null when the official page does not state it, never 0 as a stand-in. */
  ects: number | null;
  quarter: string | null;
  /** Present only when UCLouvain owns the course. See OPEN-45. */
  teachers: string[];
  /** True when the course is taught at another institution (OPEN-45). */
  external: boolean;
  /**
   * The teaching language alone, without the accommodation note.
   *
   * `language` on the detail keeps the whole string, because "Anglais >
   * Facilités pour suivre le cours en français" is exactly what a hesitant
   * student needs to read. This is the part a filter can group on.
   */
  mainLanguage: string | null;
  /**
   * The entity that teaches it, without the arrow the source page draws.
   *
   * Not the same as the faculty a course is REACHED through: EPL students take
   * LSM, AGRO and ILV courses through options, so this is many to one while
   * `reachedVia` is many to many. Naming it `owningEntity` rather than
   * `owningFaculty` on the summary is deliberate: most of these values are
   * schools and institutes, not faculties.
   */
  owningEntity: string | null;
  /**
   * The campuses this course is taught on, where the source states them per
   * course. A list, because a course is regularly taught on more than one.
   *
   * ULB does; UCLouvain states it on the programme instead, so this is empty
   * for its courses and their site is still a fact about the programme. On the
   * summary because it is what a filter groups on and what a row shows.
   */
  campuses: string[];
  /**
   * WHICH CATALOGUE THIS CAME FROM, as an institution code.
   *
   * On the summary rather than only on the detail because every link to a
   * course is built from a summary, and since OPEN-48 a link needs it: a code
   * alone does not say which university it belongs to, and `lepl1503` and
   * `comm-b1010` only look distinct by accident of naming.
   */
  institution: string;
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
  /** Null for an institution no source here knows how to link to. */
  officialUrl: string | null;
  language: string | null;
  contactHours: string | null;
  /** FR-D19: scraped, never asked of reviewers. Structured, see rich.ts. */
  assessment: Block[] | null;
  themes: Block[] | null;
  content: Block[] | null;
  /**
   * Four more that both universities publish, under different names. Added
   * 2026-09-19 on François's request, each with a column of its own so a field
   * does not mean two things depending on which university a row came from.
   */
  objectives: Block[] | null;
  prerequisites: Block[] | null;
  teachingMethods: Block[] | null;
  bibliography: Block[] | null;
  owningFaculty: string | null;
  /** Faculties this course was reached through. Many-to-many on purpose. */
  reachedVia: string[];
}

function summarise(o: ParsedOffering, institution: string): CourseSummary {
  return {
    institution,
    code: o.code,
    title: o.title,
    year: o.year,
    // A snapshot holds exactly one year, so everything in it is that year's.
    offeredThisYear: true,
    ects: o.ects,
    quarter: o.quarter,
    teachers: o.teachers,
    // A course with no teachers and no assessment on its UCLouvain page is
    // hosted elsewhere: verified on the ENANO courses, which carry only a
    // reference institution. See OPEN-45.
    external: o.teachers.length === 0 && o.assessment === null,
    mainLanguage: mainLanguage(o.language),
    owningEntity: o.owningFaculty,
    campuses: o.campuses ?? [],
  };
}

/**
 * The same summary, from a database row.
 *
 * One function because there were three copies of this object literal, in
 * search, in coursesOfProgramme and inside get. Adding a field to two of the
 * three is the kind of thing that produces a filter which works when you
 * browse and is empty when you search.
 */
function summariseRow(
  row: {
    course: { code: string; institution: { code: string } };
    title: string;
    year: number;
    ects: unknown;
    quarter: string | null;
    language: string | null;
    owningFaculty: string | null;
    assessment: unknown;
    sites: Array<{ site: { name: string } }>;
    teachers: Array<{ teacherName: string }>;
  },
  /** The catalogue's current year, so a stale offering can say it is stale. */
  currentYear: number,
): CourseSummary {
  return {
    institution: row.course.institution.code,
    code: row.course.code,
    title: row.title,
    year: row.year,
    offeredThisYear: row.year === currentYear,
    ects: row.ects === null || row.ects === undefined ? null : Number(row.ects),
    quarter: row.quarter,
    teachers: row.teachers.map((t) => t.teacherName),
    external: row.teachers.length === 0 && row.assessment === null,
    mainLanguage: mainLanguage(row.language),
    owningEntity: row.owningFaculty,
    campuses: row.sites.map((s) => s.site.name),
  };
}

export interface FacultySummary {
  code: string;
  name: string;
  programmes: number;
}

export interface ProgrammeSummary {
  /**
   * Which catalogue this came from, as an institution code (OPEN-48).
   *
   * Same reason as on a course: every link to a programme is built from a
   * summary, and a code is unique inside one catalogue and nothing more.
   */
  institution: string;
  code: string;
  title: string;
  /** Null when the source states no faculty for it. See snapshot version 9. */
  faculty: string | null;
  /** Null when the programme has no faculty, for the same reason as above. */
  /**
   * The faculty's own name.
   *
   * Carried because the browse screen no longer makes somebody pick a faculty
   * before seeing anything: with 21 of them, a student looking for a minor does
   * not know which one owns it. The faculty is a filter now, and a filter needs
   * a label a person recognises rather than a four-letter code.
   */
  facultyName: string | null;
  courses: number;
  /**
   * What kind of programme it is (FR-D24), null when nothing known matched.
   *
   * STORED NOW, not derived on read. It used to be parsed out of the title
   * every time a programme was read, which meant the database could not be
   * asked for the masters in Charleroi and the parse ran on every request. It
   * runs once, at ingestion, and this reads the column. Two places deriving one
   * fact is how they come to disagree.
   */
  kind: ProgrammeKind | null;
  /** 120 or 60 for a master that states it, null otherwise. */
  credits: number | null;
  /** Louvain-la-Neuve, Charleroi, "Autre site". As the institution publishes it. */
  site: string | null;
  /**
   * The programme's page on the institution's own site.
   *
   * Carried because a programme with no courses has to lead somewhere. 247 of
   * 690 publish no course list, mostly continuing education certificates and
   * joint programmes hosted by a partner, and they used to be hidden entirely
   * rather than shown with somewhere to go.
   */
  /** Null for an institution no source here knows how to link to. */
  officialUrl: string | null;
  /**
   * The decree's field of study, for instance "Sciences juridiques".
   *
   * Only the search application publishes it, so it is null for a programme
   * that source does not cover, which is every minor and every doctorate.
   */
  domain: string | null;
}

/**
 * What a consumer may ask the catalogue. Storage does not appear in it.
 *
 * A COURSE IS ADDRESSED BY INSTITUTION AND CODE, not by code alone (OPEN-48,
 * decided 2026-09-18). A code is unique inside one catalogue and nothing more:
 * `lepl1503` and `comm-b1010` look distinct by accident of naming, and the day
 * two universities publish the same string, a reader asking by code alone gets
 * one of them and cannot tell which.
 */
export interface Catalogue {
  readonly year: number;
  readonly size: number;
  search(query: string, limit?: number): CourseSummary[] | Promise<CourseSummary[]>;
  get(institution: string, code: string): (CourseDetail | null) | Promise<CourseDetail | null>;
  /**
   * Which catalogues hold a course with this code.
   *
   * For links made before OPEN-48 was answered, which carry a bare code. One
   * answer means the old link can be sent to its new address; more than one
   * means it is genuinely ambiguous and nobody can guess which was meant.
   * Empty means no such code anywhere.
   */
  locate(code: string): string[] | Promise<string[]>;
  /** FR-D24 and FR-D25: browsing, not only searching. */
  faculties(): FacultySummary[] | Promise<FacultySummary[]>;
  /** Every programme of the year, or only one faculty's. */
  programmes(facultyCode?: string): ProgrammeSummary[] | Promise<ProgrammeSummary[]>;
  coursesOfProgramme(
    institution: string,
    programmeCode: string,
  ): (CourseSummary[] | null) | Promise<CourseSummary[] | null>;
}

export class SnapshotCatalogue implements Catalogue {
  private constructor(
    private readonly snapshot: Snapshot,
    /**
     * A snapshot is ONE institution's crawl, and the file does not yet say
     * which. `load.ts` has taken the institution as an option since before
     * this, for the same reason, and defaults the same way. It becomes a field
     * of the file at snapshot version 9, which is the adapter's change to make:
     * bumping the version here would refuse the snapshot on disk and cost a
     * re-crawl for a field nothing yet varies.
     */
    readonly institution: string,
  ) {}

  static async open(path: string, institution = "uclouvain"): Promise<SnapshotCatalogue> {
    return new SnapshotCatalogue(await load(path), institution);
  }

  locate(code: string): string[] {
    const found = this.snapshot.offerings.some((o) => o.code === code.toLowerCase());
    return found ? [this.institution] : [];
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
    return [...byCode, ...byTitle].slice(0, limit)
      .map((o) => summarise(o, this.institution));
  }

  faculties(): FacultySummary[] {
    return this.snapshot.faculties.map((f) => ({
      code: f.code,
      name: f.name,
      programmes: this.snapshot.programmes.filter((p) => p.faculty === f.code).length,
    }));
  }

  programmes(facultyCode?: string): ProgrammeSummary[] {
    const known = new Set(this.snapshot.offerings.map((o) => o.code));
    const want = facultyCode?.toLowerCase();
    const nameOf = new Map(this.snapshot.faculties.map((f) => [f.code, f.name]));
    return this.snapshot.programmes
      .filter((p) => want === undefined || p.faculty === want)
      .map((p) => ({
        institution: this.institution,
        code: p.code,
        title: p.title,
        faculty: p.faculty,
        // Null stays null rather than becoming a word. A programme whose
        // source names no faculty has none, and "AUTRE" in that column would
        // be an answer we invented.
        facultyName: p.faculty === null ? null : (nameOf.get(p.faculty) ?? p.faculty.toUpperCase()),
        // Only courses actually present in this snapshot: a scoped run holds a
        // sample, and claiming a count we cannot show would be a lie.
        courses: new Set(
          this.snapshot.reachedVia
            .filter((r) => r.programme === p.code && known.has(r.code))
            .map((r) => r.code),
        ).size,
        kind: p.kind as ProgrammeKind | null,
        credits: p.credits,
        site: p.site,
        domain: p.domain,
        officialUrl: officialProgrammeUrl(this.institution, this.snapshot.year, p.code),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  coursesOfProgramme(institution: string, programmeCode: string): CourseSummary[] | null {
    const code = programmeCode.toLowerCase();
    if (institution.toLowerCase() !== this.institution) return null;
    if (!this.snapshot.programmes.some((p) => p.code === code)) return null;
    const codes = new Set(
      this.snapshot.reachedVia.filter((r) => r.programme === code).map((r) => r.code),
    );
    return this.snapshot.offerings
      .filter((o) => codes.has(o.code))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((o) => summarise(o, this.institution));
  }

  get(institution: string, code: string): CourseDetail | null {
    if (institution.toLowerCase() !== this.institution) return null;
    const o = this.snapshot.offerings.find((x) => x.code === code.toLowerCase());
    if (!o) return null;
    return {
      ...summarise(o, this.institution),
      officialUrl: officialCourseUrl(this.institution, o.year, o.code),
      language: o.language,
      contactHours: o.contactHours,
      assessment: o.assessment,
      themes: o.themes,
      content: o.content,
      objectives: o.objectives ?? null,
      prerequisites: o.prerequisites ?? null,
      teachingMethods: o.teachingMethods ?? null,
      bibliography: o.bibliography ?? null,
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

    // Not restricted to the current year, and then reduced to one row per
    // course, the most recent. A course the institution stopped offering is
    // exactly the one somebody searches for after taking it, and a review of it
    // is still worth reading. Excluding it made 61 courses unfindable and their
    // reviews unreachable with them.
    const rows = await this.prisma.courseOffering.findMany({
      where: {
        OR: [
          { course: { code: { startsWith: q } } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        course: { include: { institution: true } },
        teachers: true,
        sites: { include: { site: true } },
      },
      orderBy: { year: "desc" },
      // Room for older editions of the same course before they are collapsed.
      take: limit * 4,
    });

    // Keyed by institution AND code, not by code: collapsing older editions of
    // one course must not also collapse two universities' courses that happen
    // to share a string into one result.
    const newest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = `${r.course.institution.code}/${r.course.code}`;
      if (!newest.has(key)) newest.set(key, r);
    }
    const unique = [...newest.values()].slice(0, limit);

    // Code matches first: someone typing LEPL1503 wants that course, not one
    // whose title happens to contain the string.
    const scored = unique.map((r) => ({
      row: r,
      code: r.course.code.startsWith(q) ? 0 : 1,
    }));
    scored.sort((a, b) => a.code - b.code || a.row.course.code.localeCompare(b.row.course.code));

    return scored.map(({ row }) => summariseRow(row, this.year));
  }

  /**
   * An institution's id from its code, or a sentinel that matches nothing.
   *
   * An unknown institution in a URL is a 404, not an error: somebody typing
   * `/c/oxford/x` has asked for something that does not exist, which is the
   * same answer as an unknown code. Returning a sentinel keeps that in the
   * query rather than needing a branch at every call site.
   */
  private async institutionIdOf(code: string): Promise<string> {
    const row = await this.prisma.institution.findUnique({
      where: { code: code.toLowerCase() },
      select: { id: true },
    });
    return row?.id ?? "no-such-institution";
  }

  async locate(code: string): Promise<string[]> {
    const rows = await this.prisma.course.findMany({
      where: { code: code.toLowerCase() },
      select: { institution: { select: { code: true } } },
      orderBy: { institution: { code: "asc" } },
    });
    return rows.map((r) => r.institution.code);
  }

  async get(institution: string, code: string): Promise<CourseDetail | null> {
    // The current year first, then the most recent there is. A course the
    // institution has stopped offering still has readers: somebody who took it
    // last year, and anybody reading the reviews they wrote about it.
    //
    // Both halves are scoped to the institution. Before OPEN-48 this took a
    // code alone and ordered the ambiguity away, which was stable and still a
    // guess; now the caller says which catalogue it means.
    const where = {
      course: { code: code.toLowerCase(), institution: { code: institution.toLowerCase() } },
    };
    const include = {
      course: { include: { institution: true } },
      teachers: true,
      sites: { include: { site: true } },
      faculties: { include: { faculty: true } },
    };
    const row =
      (await this.prisma.courseOffering.findFirst({ where: { ...where, year: this.year }, include })) ??
      (await this.prisma.courseOffering.findFirst({
        where,
        orderBy: { year: "desc" as const },
        include,
      }));
    if (!row) return null;
    return {
      ...summariseRow(row, this.year),
      officialUrl: officialCourseUrl(row.course.institution.code, row.year, row.course.code),
      language: row.language,
      contactHours: row.contactHours,
      assessment: blocksFrom(row.assessment),
      themes: blocksFrom(row.themes),
      content: blocksFrom(row.content),
      objectives: blocksFrom(row.objectives),
      prerequisites: blocksFrom(row.prerequisites),
      teachingMethods: blocksFrom(row.teachingMethods),
      bibliography: blocksFrom(row.bibliography),
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

  async programmes(facultyCode?: string): Promise<ProgrammeSummary[]> {
    const rows = await this.prisma.programme.findMany({
      where: {
        year: this.year,
        ...(facultyCode ? { faculty: { code: facultyCode.toLowerCase() } } : {}),
      },
      include: {
        faculty: true,
        institution: true,
        site: true,
        domain: true,
        _count: { select: { offerings: true } },
      },
      orderBy: { title: "asc" },
    });
    return rows.map((p) => ({
        // From the programme's own column, not through the faculty: since
        // 2026-09-18 a programme may have no faculty, and its institution is
        // still known.
        institution: p.institution.code,
        code: p.code,
        title: p.title,
        faculty: p.faculty?.code ?? null,
        facultyName: p.faculty?.name ?? null,
        courses: p._count.offerings,
        kind: p.kind as ProgrammeKind | null,
        credits: p.credits,
        site: p.site?.name ?? null,
        domain: p.domain?.name ?? null,
        officialUrl: officialProgrammeUrl(p.institution.code, p.year, p.code),
      }));
  }

  async coursesOfProgramme(
    institution: string,
    programmeCode: string,
  ): Promise<CourseSummary[] | null> {
    // `findFirst`, not `findUnique`, because the unique key is now
    // (institution, code, year) and this reader has no institution.
    // Scoped to the institution the caller named (OPEN-48). Before this it
    // took a code alone and ordered the ambiguity away, which was stable and
    // was still a guess.
    const programme = await this.prisma.programme.findUnique({
      where: {
        institutionId_code_year: {
          institutionId: await this.institutionIdOf(institution),
          code: programmeCode.toLowerCase(),
          year: this.year,
        },
      },
    });
    if (!programme) return null;
    const rows = await this.prisma.programmeOffering.findMany({
      where: { programmeId: programme.id },
      include: {
        offering: {
          include: {
            course: { include: { institution: true } },
            teachers: true,
            sites: { include: { site: true } },
          },
        },
      },
    });
    return rows
      .map(({ offering }) => summariseRow(offering, this.year))
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
  programmes(facultyCode?: string): Promise<ProgrammeSummary[]>;
  coursesOfProgramme(institution: string, programmeCode: string): Promise<CourseSummary[] | null>;
}
