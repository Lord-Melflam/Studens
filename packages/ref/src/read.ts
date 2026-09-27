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
   * 2026-09-19 on request, each with a column of its own so a field
   * does not mean two things depending on which university a row came from.
   */
  objectives: Block[] | null;
  prerequisites: Block[] | null;
  teachingMethods: Block[] | null;
  bibliography: Block[] | null;
  owningFaculty: string | null;
  /** Faculties this course was reached through. Many-to-many on purpose. */
  reachedVia: string[];
  /**
   * OPEN-47: which language each text field actually ended up in.
   *
   * REPORTED RATHER THAN ASSUMED, because it varies per field on the same
   * course. Measured on 24 courses: 38% of fields are genuinely translated,
   * 16% exist in French only, and the English edition sometimes publishes the
   * literal sentence "See French document", which is refused at ingestion. A
   * reader who asked for English and is shown French deserves to be told
   * which parts, and a screen cannot work that out for itself.
   *
   * Absent keys are fields the course does not have at all.
   */
  textLanguage: Partial<Record<TextField, "fr" | "en">>;
  /**
   * The editions that actually exist for this course, in no order.
   *
   * SO THE SCREEN CAN OFFER A CHOICE ONLY WHERE THERE IS ONE. A switch with a
   * single option is a control that can do nothing, which is the same rule the
   * filter groups and the review pager already follow.
   *
   * It is computed from the text rather than from a column, because "has an
   * English edition" means "some field came back in English", and a row can
   * carry an English title with no English prose.
   */
  editions: Array<"fr" | "en">;
  /**
   * The edition this response is written in: the reader's first preference
   * that exists.
   *
   * REPORTED, NOT INFERRED. A Dutch reader is served the English edition, so
   * the screen cannot work out which one it is holding by comparing against
   * the interface language: neither `fr` nor `en` matches `nl`, and the switch
   * marked neither as current. Individual fields may still differ from this,
   * which is what `textLanguage` is for.
   */
  edition: "fr" | "en";
}

/** The fields that have a French and possibly an English edition. */
export type TextField =
  | "title"
  | "assessment"
  | "themes"
  | "content"
  | "objectives"
  | "prerequisites"
  | "teachingMethods"
  | "bibliography";

export const TEXT_FIELDS: readonly TextField[] = [
  "title",
  "assessment",
  "themes",
  "content",
  "objectives",
  "prerequisites",
  "teachingMethods",
  "bibliography",
];

/**
 * Choose between the two editions, field by field.
 *
 * ONLY `en` EVER GETS THE ENGLISH TEXT. French readers get French, and Dutch
 * readers get French too, because `nl-cours-...` answers 404 and there is no
 * Dutch source to fall back from. That is a fact about the university's site
 * and it is why the interface says which language a field is in rather than
 * pretending three are available.
 */
/**
 * WHICH EDITION A READER WOULD RATHER HAVE, IN ORDER.
 *
 * A DUTCH READER IS OFFERED ENGLISH BEFORE FRENCH, and that is the owner's
 * call, 2026-09-27, on knowledge of the country rather than on anything in
 * this repository: a Dutch speaker in Belgium is likelier to read English
 * comfortably than French. The first version offered French to everyone who
 * had not asked for English, so a Dutch reader on a course with a perfectly
 * good English edition was shown French and told it was French. That is a
 * worse guess than the one available.
 *
 * Neither guess has to be right, because the course page carries a switch: the
 * reader changes edition in one press and the page says which language every
 * field ended up in. This decides only where they start.
 *
 * WHAT WOULD CHANGE IT: a Dutch edition existing, which would go first for
 * `nl` and make the rest of this moot; or evidence that Dutch readers here
 * prefer French, which would be a fact about the population and not about the
 * catalogue.
 */
const PREFERENCE: Record<string, readonly ("fr" | "en")[]> = {
  fr: ["fr", "en"],
  en: ["en", "fr"],
  nl: ["en", "fr"],
};

function pickText(
  locale: string | undefined,
  french: Block[] | null,
  english: Block[] | null,
): { value: Block[] | null; lang: "fr" | "en" | null } {
  const have = { fr: french, en: english };
  for (const want of PREFERENCE[locale ?? "fr"] ?? PREFERENCE["fr"]!) {
    if (have[want] !== null) return { value: have[want], lang: want };
  }
  return { value: null, lang: null };
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
/** One institution's share of the catalogue. */
export interface InstitutionCounts {
  code: string;
  courses: number;
  programmes: number;
}

/**
 * Which catalogues a request is about.
 *
 * Empty or absent means all of them, which is what the public pages want. The
 * app zone passes the member's, because a student's catalogue is the
 * university they chose and not everybody's (see Browse.tsx).
 */
export interface Scope {
  institutions?: readonly string[] | undefined;
  limit?: number | undefined;
}

export interface Catalogue {
  readonly year: number;
  readonly size: number;
  /**
   * FR-D1 and FR-D2.
   *
   * THE SCOPE GOES IN THE QUERY, not over the results. Filtering afterwards
   * looks equivalent and is not: the limit would already have been spent on
   * rows from catalogues the reader did not ask for. Measured on 2026-09-21,
   * searching "droit" across two catalogues returned 24 ULB rows and 1
   * UCLouvain, while the database holds 282 UCLouvain matches and 199 ULB. The
   * window is filled by whichever sorts first, so a browser-side filter would
   * have hidden the ULB rows and left one result out of 282, which looks like
   * a working search and is not.
   */
  search(query: string, scope?: Scope): CourseSummary[] | Promise<CourseSummary[]>;
  /**
   * How many courses the same query matches, ignoring the limit.
   *
   * Because the page was saying "25 of 25". That is true about the array it
   * was handed and false about the catalogue: 25 is the window, and "droit"
   * matches 282 courses at one university alone. A number that reads as a
   * fact and is an artefact of a limit is the same defect as a count typed
   * into a sentence, and the answer is the same: fetch it.
   *
   * The real number is also the useful one. It is what tells somebody to
   * narrow the search rather than scroll a list that was never complete.
   */
  searchCount(query: string, scope?: Scope): number | Promise<number>;
  /**
   * `locale` selects which edition a field comes back in, per field, and the
   * record says which one each ended up being (OPEN-47). Optional, because a
   * caller that does not care gets French, which is what every row has.
   */
  get(
    institution: string,
    code: string,
    locale?: string,
  ): (CourseDetail | null) | Promise<CourseDetail | null>;
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
  /**
   * How much each institution contributes to this year's catalogue.
   *
   * Counted the same way `size` is, one row per offering, because the obvious
   * shortcut is wrong: summing each programme's course count double counts
   * every course reachable from more than one programme, and most are. Doing
   * that gave 28,870 against a real total of 12,093.
   */
  countsByInstitution(): InstitutionCounts[] | Promise<InstitutionCounts[]>;
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
  search(query: string, scope: Scope = {}): CourseSummary[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const limit = scope.limit ?? 25;
    // A snapshot holds one institution, so the scope either includes it or
    // excludes everything. Checked rather than ignored: a caller that asks for
    // another catalogue must get nothing back, not this one's courses.
    const wanted = scope.institutions;
    if (wanted && wanted.length > 0 && !wanted.includes(this.institution)) return [];

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

  searchCount(query: string, scope: Scope = {}): number {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    const wanted = scope.institutions;
    if (wanted && wanted.length > 0 && !wanted.includes(this.institution)) return 0;
    let n = 0;
    for (const o of this.snapshot.offerings) {
      if (o.code.startsWith(q) || o.title.toLowerCase().includes(q)) n++;
    }
    return n;
  }

  countsByInstitution(): InstitutionCounts[] {
    // A snapshot holds exactly one institution's crawl (version 9), so this
    // is that institution and nothing else.
    return [
      {
        code: this.snapshot.institution ?? "uclouvain",
        courses: this.snapshot.offerings.length,
        programmes: this.snapshot.programmes.length,
      },
    ];
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

  /**
   * The locale is accepted and ignored: a snapshot on disk is the French
   * crawl, and the English edition is loaded into the database beside it. The
   * parameter exists so both catalogues satisfy one interface, and every field
   * this returns reports itself as French rather than staying silent.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get(institution: string, code: string, locale?: string): CourseDetail | null {
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
      // A snapshot on disk is the French crawl. The English edition is loaded
      // into the database alongside it and is not carried here, so every field
      // this reader returns is French and says so rather than staying silent.
      textLanguage: Object.fromEntries(
        TEXT_FIELDS.filter((f) => (f === "title" ? true : o[f as keyof typeof o] != null)).map(
          (f) => [f, "fr" as const],
        ),
      ),
      // A snapshot on disk is one crawl in one language, so there is nothing
      // to choose between and the screen offers no switch.
      editions: ["fr"],
      edition: "fr",
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

  async countsByInstitution(): Promise<InstitutionCounts[]> {
    // Grouped in the database, one row per offering of this year, so a course
    // reachable from six programmes is counted once. The programme tally is a
    // second count because the two live on different tables.
    const rows = await this.prisma.institution.findMany({
      select: {
        code: true,
        courses: {
          select: { id: true },
          where: { offerings: { some: { year: this.year } } },
        },
        programmes: { select: { id: true } },
      },
      orderBy: { code: "asc" },
    });
    return rows
      .map((i) => ({
        code: i.code,
        courses: i.courses.length,
        programmes: i.programmes.length,
      }))
      .filter((i) => i.courses > 0 || i.programmes > 0);
  }

  /**
   * The same `where` as `search`, counted rather than fetched.
   *
   * DISTINCT COURSES, not offerings. `search` collapses older editions of one
   * course into a single row, so counting offerings would report a number the
   * list could never reach and send somebody narrowing a search that was
   * already narrow enough.
   */
  async searchCount(query: string, scope: Scope = {}): Promise<number> {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    const wanted = scope.institutions?.filter((c) => c !== "") ?? [];
    const rows = await this.prisma.courseOffering.findMany({
      where: {
        OR: [
          { course: { code: { startsWith: q } } },
          { title: { contains: q, mode: "insensitive" } },
          // OPEN-47. A student reading the English interface types "Project 3"
          // and has to find the course whose French title is "Projet 3". This
          // is the reason `titleEn` is a column and not a key inside the JSON
          // blob: a string inside JSON is not matchable by this query.
          { titleEn: { contains: q, mode: "insensitive" } },
        ],
        ...(wanted.length > 0
          ? { course: { institution: { code: { in: [...wanted] } } } }
          : {}),
      },
      select: { courseId: true },
      distinct: ["courseId"],
    });
    return rows.length;
  }

  async search(query: string, scope: Scope = {}): Promise<CourseSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const limit = scope.limit ?? 25;
    const wanted = scope.institutions?.filter((c) => c !== "") ?? [];

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
          // OPEN-47. A student reading the English interface types "Project 3"
          // and has to find the course whose French title is "Projet 3". This
          // is the reason `titleEn` is a column and not a key inside the JSON
          // blob: a string inside JSON is not matchable by this query.
          { titleEn: { contains: q, mode: "insensitive" } },
        ],
        // THE SCOPE BELONGS HERE AND NOT AFTER THE FACT. `take` below is spent
        // on whatever the database returns first, so narrowing afterwards
        // spends the window on rows the reader did not ask for and truncates
        // the ones they did. See the note on `Catalogue.search`.
        ...(wanted.length > 0
          ? { course: { institution: { code: { in: [...wanted] } } } }
          : {}),
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

  async get(institution: string, code: string, locale?: string): Promise<CourseDetail | null> {
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

    // OPEN-47. Field by field, because the two editions disagree about which
    // fields exist: 16% are French only, so choosing an edition per COURSE
    // would lose them.
    const en = (row.textEn ?? null) as Record<string, unknown> | null;
    const lang: Partial<Record<TextField, "fr" | "en">> = {};
    const chosen = {} as Record<TextField, Block[] | null>;
    for (const f of TEXT_FIELDS) {
      if (f === "title") continue;
      const picked = pickText(
        locale,
        blocksFrom((row as unknown as Record<string, Prisma.JsonValue>)[f] ?? null),
        blocksFrom((en?.[f] as Prisma.JsonValue) ?? null),
      );
      chosen[f] = picked.value;
      if (picked.lang) lang[f] = picked.lang;
    }
    // What EXISTS, not what was chosen: the switch is offered on the strength
    // of there being another edition, whichever one is currently shown.
    const hasEnglish =
      Boolean(row.titleEn) ||
      TEXT_FIELDS.some((f) => f !== "title" && blocksFrom((en?.[f] as Prisma.JsonValue) ?? null));

    // The first preference that exists, which is what the reader is reading.
    const available: Array<"fr" | "en"> = hasEnglish ? ["fr", "en"] : ["fr"];
    const order = PREFERENCE[locale ?? "fr"] ?? PREFERENCE["fr"]!;
    const chosen_ = order.find((e) => available.includes(e)) ?? "fr";

    const useEnglishTitle = chosen_ === "en" && Boolean(row.titleEn);
    lang.title = useEnglishTitle ? "en" : "fr";

    return {
      ...summariseRow(row, this.year),
      title: useEnglishTitle ? row.titleEn! : row.title,
      officialUrl: officialCourseUrl(row.course.institution.code, row.year, row.course.code),
      language: row.language,
      contactHours: row.contactHours,
      assessment: chosen.assessment,
      themes: chosen.themes,
      content: chosen.content,
      objectives: chosen.objectives,
      prerequisites: chosen.prerequisites,
      teachingMethods: chosen.teachingMethods,
      bibliography: chosen.bibliography,
      owningFaculty: row.owningFaculty,
      reachedVia: row.faculties.map((f) => f.faculty.code),
      textLanguage: lang,
      editions: hasEnglish ? ["fr", "en"] : ["fr"],
      edition: chosen_,
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
