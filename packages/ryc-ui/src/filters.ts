/**
 * Filtering the catalogue, as pure functions over data already fetched.
 *
 * NO NEW REQUESTS. A programme holds at most a few hundred courses and a search
 * returns twenty-five, so every filter here runs on the array the screen
 * already has. That keeps a filter instant, keeps the API surface unchanged,
 * and means the facet counts cannot disagree with the list beneath them.
 * The day a list is big enough to page, this moves to the server, and the
 * shapes below are what that endpoint would take.
 *
 * FACETS ARE DERIVED FROM THE DATA, NEVER LISTED. The quarters offered are the
 * quarters present; the languages offered are the languages present. A hardcoded
 * list would be wrong within a year, which is the same rule the whole catalogue
 * is built under, and it would offer options that match nothing.
 *
 * EACH FACET IS COUNTED AGAINST THE OTHER FILTERS, NOT AGAINST THE WHOLE LIST.
 * Standard faceted search, and the reason is accuracy: if "Q1" said 23 while the
 * language filter had already excluded all 23, clicking it would empty the
 * screen. A count here is what you get if you click it.
 */
import type { CourseSummary, ProgrammeSummary } from "./api.js";
import { languageKey, quarterKey } from "./normalise.js";
import { courseKey } from "./Ryc.js";

/** One option in a facet, with what choosing it would leave. */
export interface Facet<T> {
  value: T;
  label: string;
  count: number;
}

// --------------------------------------------------------------------------
// Courses
// --------------------------------------------------------------------------

export interface CourseFilter {
  text: string;
  quarters: string[];
  languages: string[];
  /** `null` means "the page does not state it", which is its own group. */
  ects: Array<number | null>;
  entities: string[];
  /**
   * WHERE THE CLASS IS, which ULB states per course and UCLouvain does not.
   *
   * A student picking electives cares: two courses of one programme can be on
   * different campuses, and crossing Brussels between them is a real cost that
   * no other field on the row expresses.
   */
  campuses: string[];
  /** FR-D24 is discovery: at launch 10 courses of 547 have anything to read. */
  reviewedOnly: boolean;
}

export const NO_COURSE_FILTER: CourseFilter = {
  text: "",
  quarters: [],
  languages: [],
  ects: [],
  entities: [],
  campuses: [],
  reviewedOnly: false,
};

export function courseFilterIsEmpty(f: CourseFilter): boolean {
  return (
    f.text.trim() === "" &&
    f.quarters.length === 0 &&
    f.languages.length === 0 &&
    f.ects.length === 0 &&
    f.entities.length === 0 &&
    f.campuses.length === 0 &&
    !f.reviewedOnly
  );
}

/** The dimensions, so a facet can be counted with its own one ignored. */
type Dimension =
  | "text"
  | "quarters"
  | "languages"
  | "ects"
  | "entities"
  | "campuses"
  | "reviewedOnly";

function matchesCourse(
  c: CourseSummary,
  f: CourseFilter,
  counts: Record<string, number>,
  ignore?: Dimension,
): boolean {
  if (ignore !== "text" && f.text.trim() !== "") {
    const q = f.text.trim().toLowerCase();
    // Code or title. Not the lecturer: see the note on reviewCounts in the API
    // and section 5.1, searching the catalogue by person is a different feature
    // with a different legal footing and it is deliberately not this one.
    if (!c.code.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) return false;
  }
  if (ignore !== "quarters" && f.quarters.length > 0) {
    // The CANONICAL term, the same one the facet is built from. Matching on
    // the raw string here and faceting on the key there would give chips that
    // select nothing.
    const q = quarterKey(c.quarter);
    if (!q || !f.quarters.includes(q)) return false;
  }
  if (ignore !== "languages" && f.languages.length > 0) {
    const l = languageKey(c.mainLanguage);
    if (!l || !f.languages.includes(l)) return false;
  }
  if (ignore !== "ects" && f.ects.length > 0) {
    if (!f.ects.includes(c.ects)) return false;
  }
  if (ignore !== "entities" && f.entities.length > 0) {
    if (!c.owningEntity || !f.entities.includes(c.owningEntity)) return false;
  }
  if (ignore !== "campuses" && f.campuses.length > 0) {
    // A course with no stated campus matches no campus, like the site and the
    // field of study on a programme. Every UCLouvain course is in that case,
    // and its site is a fact about its programme rather than about it.
    // ANY of the course's campuses, not all: a course taught at Solbosch and
    // Flagey belongs in both, and a student filtering for Solbosch wants it.
    if (!c.campuses.some((x) => f.campuses.includes(x))) return false;
  }
  if (ignore !== "reviewedOnly" && f.reviewedOnly) {
    // Keyed by institution AND code (OPEN-48). Keyed by code alone, one
    // university's review count would answer for another's course, and the
    // "only those with reviews" filter would quietly show the wrong list.
    if ((counts[courseKey(c)] ?? 0) === 0) return false;
  }
  return true;
}

export function applyCourseFilter(
  courses: CourseSummary[],
  f: CourseFilter,
  counts: Record<string, number> = {},
): CourseSummary[] {
  return courses.filter((c) => matchesCourse(c, f, counts));
}

/** Group by one property, counting only what the OTHER filters already allow. */
/**
 * The campus facet, which cannot use `facetsOf` because a course has SEVERAL.
 *
 * Every other dimension picks one value per course, so the tally is one
 * increment. A course taught at Solbosch and Flagey has to count towards both,
 * or the numbers beside the chips do not add up to the list underneath them,
 * which is the one thing a facet count must never do.
 */
function campusFacets(
  courses: CourseSummary[],
  f: CourseFilter,
  counts: Record<string, number>,
): Array<Facet<string>> {
  const tally = new Map<string, number>();
  for (const c of courses) {
    if (!matchesCourse(c, f, counts, "campuses")) continue;
    for (const campus of new Set(c.campuses)) {
      tally.set(campus, (tally.get(campus) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function facetsOf<T extends string | number>(
  courses: CourseSummary[],
  f: CourseFilter,
  counts: Record<string, number>,
  dimension: Dimension,
  pick: (c: CourseSummary) => T | null,
  label: (v: T) => string = (v) => String(v),
): Array<Facet<T>> {
  const tally = new Map<T, number>();
  for (const c of courses) {
    if (!matchesCourse(c, f, counts, dimension)) continue;
    const v = pick(c);
    if (v === null) continue;
    tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) =>
      typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : String(a.value).localeCompare(String(b.value)),
    );
}

export interface CourseFacets {
  quarters: Array<Facet<string>>;
  languages: Array<Facet<string>>;
  ects: Array<Facet<number | null>>;
  entities: Array<Facet<string>>;
  campuses: Array<Facet<string>>;
  /** How many of the currently matching courses have anything to read. */
  reviewed: number;
}

export function courseFacets(
  courses: CourseSummary[],
  f: CourseFilter,
  counts: Record<string, number> = {},
): CourseFacets {
  return {
    quarters: facetsOf(courses, f, counts, "quarters", (c) => quarterKey(c.quarter)),
    languages: facetsOf(courses, f, counts, "languages", (c) => languageKey(c.mainLanguage)),
    ects: facetsOf(courses, f, counts, "ects", (c) => c.ects),
    entities: facetsOf(courses, f, counts, "entities", (c) => c.owningEntity),
    campuses: campusFacets(courses, f, counts),
    reviewed: courses.filter(
      (c) => matchesCourse(c, f, counts, "reviewedOnly") && (counts[courseKey(c)] ?? 0) > 0,
    ).length,
  };
}

// --------------------------------------------------------------------------
// Programmes
// --------------------------------------------------------------------------

/**
 * A fixed order for the kinds, because alphabetical would put "certificat"
 * above "bachelier" and the list reads as a progression: what you study first,
 * then what you add to it, then what comes after.
 *
 * Used by BOTH the facets and the grouped list, so the filter and the sections
 * below it cannot disagree about what order the kinds come in.
 */
const KIND_ORDER = [
  "bachelier",
  "master",
  "specialisation",
  "mineure",
  "filiere",
  "approfondissement",
  "certificat",
];

function rankKind(k: string | null): number {
  return k === null ? KIND_ORDER.length : KIND_ORDER.indexOf(k);
}

export interface ProgrammeFilter {
  text: string;
  /** `null` in the list means "kind we could not parse", shown as its own group. */
  kinds: Array<string | null>;
  sites: string[];
  /**
   * The faculty, a filter rather than a gate.
   *
   * It used to be a choice made BEFORE anything was shown, which works with one
   * faculty and fails with twenty-one: somebody looking for a minor does not
   * know which faculty owns it, and the whole point of browsing is not knowing
   * yet. UCLouvain's own catalogue does not ask either.
   */
  faculties: string[];
  /** The decree's field of study. */
  domains: string[];
  /**
   * WHICH UNIVERSITY, and a filter rather than a gate.
   *
   * Same argument as the faculty above it: somebody looking for a course does
   * not necessarily know which institution owns it, and asking first is a wall
   * in front of the thing browsing is for. It is also self-effacing: a
   * dimension with one option is not shown, so with one catalogue loaded this
   * control does not appear at all.
   */
  institutions: string[];
}

export const NO_PROGRAMME_FILTER: ProgrammeFilter = {
  text: "",
  kinds: [],
  sites: [],
  faculties: [],
  domains: [],
  institutions: [],
};

export function programmeFilterIsEmpty(f: ProgrammeFilter): boolean {
  return (
    f.text.trim() === "" &&
    f.kinds.length === 0 &&
    f.sites.length === 0 &&
    f.faculties.length === 0 &&
    f.domains.length === 0 &&
    f.institutions.length === 0
  );
}

type ProgrammeDimension =
  | "text"
  | "kinds"
  | "sites"
  | "faculties"
  | "domains"
  | "institutions";

function matchesProgramme(
  p: ProgrammeSummary,
  f: ProgrammeFilter,
  ignore?: ProgrammeDimension,
): boolean {
  if (ignore !== "text" && f.text.trim() !== "") {
    const q = f.text.trim().toLowerCase();
    if (!p.title.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
  }
  if (ignore !== "kinds" && f.kinds.length > 0) {
    if (!f.kinds.includes(p.kind)) return false;
  }
  if (ignore !== "sites" && f.sites.length > 0) {
    if (!p.site || !f.sites.includes(p.site)) return false;
  }
  if (ignore !== "faculties" && f.faculties.length > 0) {
    // A programme with no faculty matches no faculty. Treated like the site
    // and the field of study above rather than given a group of its own: a
    // faculty filter is for finding a faculty's programmes, and "the ones
    // belonging to no faculty" is not that question.
    if (!p.faculty || !f.faculties.includes(p.faculty)) return false;
  }
  if (ignore !== "domains" && f.domains.length > 0) {
    if (!p.domain || !f.domains.includes(p.domain)) return false;
  }
  if (ignore !== "institutions" && f.institutions.length > 0) {
    if (!f.institutions.includes(p.institution)) return false;
  }
  return true;
}

export function applyProgrammeFilter(
  programmes: ProgrammeSummary[],
  f: ProgrammeFilter,
): ProgrammeSummary[] {
  return programmes.filter((p) => matchesProgramme(p, f));
}

export interface ProgrammeFacets {
  kinds: Array<Facet<string | null>>;
  sites: Array<Facet<string>>;
  faculties: Array<Facet<string>>;
  domains: Array<Facet<string>>;
  institutions: Array<Facet<string>>;
}

export function programmeFacets(
  programmes: ProgrammeSummary[],
  f: ProgrammeFilter,
): ProgrammeFacets {
  const kinds = new Map<string | null, number>();
  for (const p of programmes) {
    if (!matchesProgramme(p, f, "kinds")) continue;
    kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);
  }
  const sites = new Map<string, number>();
  for (const p of programmes) {
    if (!matchesProgramme(p, f, "sites") || !p.site) continue;
    sites.set(p.site, (sites.get(p.site) ?? 0) + 1);
  }
  // Keyed by code and labelled by name, because two faculties can read alike in
  // a list and the code is what the rest of the catalogue joins on.
  const faculties = new Map<string, { label: string; count: number }>();
  for (const p of programmes) {
    if (!matchesProgramme(p, f, "faculties") || !p.faculty) continue;
    const seen = faculties.get(p.faculty);
    faculties.set(p.faculty, {
      label: p.facultyName || p.faculty.toUpperCase(),
      count: (seen?.count ?? 0) + 1,
    });
  }
  const domains = new Map<string, number>();
  for (const p of programmes) {
    if (!matchesProgramme(p, f, "domains") || !p.domain) continue;
    domains.set(p.domain, (domains.get(p.domain) ?? 0) + 1);
  }
  const institutions = new Map<string, number>();
  for (const p of programmes) {
    if (!matchesProgramme(p, f, "institutions")) continue;
    institutions.set(p.institution, (institutions.get(p.institution) ?? 0) + 1);
  }

  const rank = rankKind;

  return {
    kinds: [...kinds.entries()]
      .map(([value, count]) => ({ value, label: String(value ?? "autre"), count }))
      .sort((a, b) => rank(a.value) - rank(b.value)),
    sites: [...sites.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    // Both by name rather than by count: a faculty list and a list of fields of
    // study are things somebody scans for a known word, and an order that moves
    // as the other filters change is one you cannot learn.
    faculties: [...faculties.entries()]
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    domains: [...domains.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    // By name, like the two above. Uppercased because an institution code is
    // an acronym a reader knows in that form, not a word.
    institutions: [...institutions.entries()]
      .map(([value, count]) => ({ value, label: value.toUpperCase(), count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/**
 * The published title, without the site we are already showing beside it.
 *
 * UCLouvain writes the site into the name: "Bachelier en sciences de gestion
 * (Mons)". That parenthesis is why the site could be parsed at all before it
 * was a field, and now that the row states the site as a fact, keeping it in
 * the title says the same word twice on one line.
 *
 * Only ever removes an EXACT match of the site being displayed, so nothing is
 * lost: a title whose parenthesis says something else keeps it, and so does one
 * whose site we do not have. The published name is not rewritten, it is
 * de-duplicated against a fact shown next to it.
 */
export function titleWithoutSite(title: string, site: string | null): string {
  if (!site) return title;
  const trimmed = title.trimEnd();
  const suffix = `(${site})`;
  if (!trimmed.endsWith(suffix)) return title;
  return trimmed.slice(0, -suffix.length).trimEnd();
}

/**
 * The programmes, split into sections by kind, in the order the filter uses.
 *
 * 690 rows in one alphabetical run is a wall. The order is shared with
 * `programmeFacets` deliberately: a list ordered one way and a filter ordered
 * another is two answers to "what kinds are there".
 */
export function groupByKind(
  programmes: ProgrammeSummary[],
): Array<[string | null, ProgrammeSummary[]]> {
  const by = new Map<string | null, ProgrammeSummary[]>();
  for (const p of programmes) by.set(p.kind, [...(by.get(p.kind) ?? []), p]);
  return [...by.entries()].sort((a, b) => rankKind(a[0]) - rankKind(b[0]));
}

/**
 * The courses, split into sections by term.
 *
 * 114 programmes hold more than 60 courses and the largest holds 173, which as
 * one list is unreadable. At PAE time the question is nearly always "what can I
 * take in Q1", so the term is the split that matches how somebody is already
 * thinking, and it is a field the catalogue publishes rather than one we infer.
 *
 * Courses with no term stated come last, under their own heading, never folded
 * into Q1: an unknown is not a first quadrimester.
 *
 * Below a threshold there is nothing to organise and headings are just noise,
 * so a short list stays flat.
 */
export const GROUP_COURSES_ABOVE = 12;

export function groupByTerm(courses: CourseSummary[]): Array<[string | null, CourseSummary[]]> {
  if (courses.length <= GROUP_COURSES_ABOVE) return [[null, courses]];
  const by = new Map<string | null, CourseSummary[]>();
  for (const c of courses) by.set(c.quarter, [...(by.get(c.quarter) ?? []), c]);
  const rank = (q: string | null) => (q === null ? 99 : (QUARTER_ORDER.indexOf(q) + 1 || 98));
  return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

/** The order UCLouvain publishes, not alphabetical: Q1 comes before Q2. */
const QUARTER_ORDER = ["Q1", "Q2", "Q1 et Q2", "Q1 and Q2", "Q1 of Q2", "Q1 ou Q2", "Q3"];

/** Toggle a value in a multi-select list. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// --------------------------------------------------------------------------
// Filters in the URL
// --------------------------------------------------------------------------

/**
 * A FILTER IS PART OF THE SCREEN, SO IT BELONGS IN THE ADDRESS.
 *
 * This file used to say the opposite, at the top of CourseFilters.tsx: filters
 * stayed in component state because "the programme being browsed is itself not
 * yet in the URL", and a link restoring a filter but not what it filtered would
 * be worse than no link. That was true when it was written. The programme went
 * into the URL in phase 30, and nobody came back to this.
 *
 * What it cost, reported by François: select filters, open a course, press
 * Back, and the filters are gone. The same three failures the module already
 * fixed for courses and programmes, one screen lower down. Back cannot restore
 * what was never written down, a refresh cannot either, and the third failure
 * is the quiet one: a link to a filtered list is a link that shows the reader
 * something else.
 *
 * THE PARAMETER NAMES ARE FRENCH, like the routes around them (`/recherche`,
 * `/p/`, `/c/`, `/avis`). French is the source language (packages/i18n), and a
 * URL is not translated: the same link has to work for the person it is sent
 * to, whatever language they read the page in.
 *
 * `f` is what is typed into the filter box and `q` is what is typed into the
 * search box, and they are deliberately not the same letter. One narrows a list
 * already on screen, the other asks the server a question, and the search
 * screen shows both at once.
 */

/**
 * What stands for "the page does not state it", which is a real group in three
 * of these dimensions and not the absence of a filter.
 *
 * A single hyphen, because no kind, site, faculty, domain or credit value is
 * one, and because it survives URL encoding unchanged.
 */
export const UNSTATED = "-";

/** Read a repeated parameter. `?quad=Q1&quad=Q2`, not a comma-joined list: a
    value may contain a comma and none of them may contain a `&`. */
function list(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).filter((v) => v !== "");
}

function put(params: URLSearchParams, key: string, values: readonly string[]): void {
  for (const v of values) params.append(key, v);
}

/** The parameters the course filter owns, so writing it leaves the rest alone. */
export const COURSE_FILTER_KEYS = [
  "f",
  "quad",
  "langue",
  "credits",
  "entite",
  "campus",
  "avis",
] as const;

export function courseFilterToQuery(f: CourseFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.text.trim() !== "") p.set("f", f.text.trim());
  put(p, "quad", f.quarters);
  put(p, "langue", f.languages);
  put(p, "credits", f.ects.map((e) => (e === null ? UNSTATED : String(e))));
  put(p, "entite", f.entities);
  put(p, "campus", f.campuses);
  if (f.reviewedOnly) p.set("avis", "1");
  return p;
}

export function courseFilterFromQuery(params: URLSearchParams): CourseFilter {
  return {
    text: params.get("f") ?? "",
    quarters: list(params, "quad"),
    languages: list(params, "langue"),
    // A credit value that is not a number is dropped rather than kept as NaN,
    // which would match nothing and could not be unclicked.
    ects: list(params, "credits")
      .map((v) => (v === UNSTATED ? null : Number(v)))
      .filter((v) => v === null || Number.isFinite(v)),
    entities: list(params, "entite"),
    campuses: list(params, "campus"),
    reviewedOnly: params.get("avis") === "1",
  };
}

/** The parameters the programme filter owns. */
export const PROGRAMME_FILTER_KEYS = ["f", "type", "site", "fac", "domaine", "univ"] as const;

export function programmeFilterToQuery(f: ProgrammeFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.text.trim() !== "") p.set("f", f.text.trim());
  put(p, "type", f.kinds.map((k) => k ?? UNSTATED));
  put(p, "site", f.sites);
  put(p, "fac", f.faculties);
  put(p, "domaine", f.domains);
  put(p, "univ", f.institutions);
  return p;
}

export function programmeFilterFromQuery(params: URLSearchParams): ProgrammeFilter {
  return {
    text: params.get("f") ?? "",
    kinds: list(params, "type").map((v) => (v === UNSTATED ? null : v)),
    sites: list(params, "site"),
    faculties: list(params, "fac"),
    domains: list(params, "domaine"),
    institutions: list(params, "univ"),
  };
}

/**
 * Drop chosen values that nothing in the list has.
 *
 * The point of a link that survives is that it is opened later, and later the
 * catalogue has been crawled again: a faculty is renamed, a site closes, a
 * programme kind stops being used. Kept as-is, such a filter empties the list
 * and cannot even be unclicked, because a chip is only drawn for a value the
 * data has. The visitor sees nothing, with nothing to press.
 *
 * Pruned against the raw list rather than against the facets, which are
 * computed from the filter and would make this circular. Applied where the
 * filter is derived, so there is no state to fall out of step and no effect
 * that could write back into its own input.
 */
export function pruneCourseFilter(f: CourseFilter, courses: CourseSummary[]): CourseFilter {
  if (courses.length === 0) return f;
  const has = <T,>(values: Set<T>, chosen: T[]): T[] => chosen.filter((v) => values.has(v));
  return {
    ...f,
    quarters: has(new Set(courses.map((c) => c.quarter).filter((q): q is string => q !== null)), f.quarters),
    languages: has(
      new Set(courses.map((c) => languageKey(c.mainLanguage)).filter((l): l is string => l !== null)),
      f.languages,
    ),
    ects: has(new Set(courses.map((c) => c.ects)), f.ects),
    entities: has(
      new Set(courses.map((c) => c.owningEntity).filter((e): e is string => e !== null)),
      f.entities,
    ),
    campuses: has(new Set(courses.flatMap((c) => c.campuses)), f.campuses),
  };
}

export function pruneProgrammeFilter(
  f: ProgrammeFilter,
  programmes: ProgrammeSummary[],
): ProgrammeFilter {
  if (programmes.length === 0) return f;
  const has = <T,>(values: Set<T>, chosen: T[]): T[] => chosen.filter((v) => values.has(v));
  return {
    ...f,
    kinds: has(new Set(programmes.map((p) => p.kind)), f.kinds),
    sites: has(
      new Set(programmes.map((p) => p.site).filter((s): s is string => s !== null)),
      f.sites,
    ),
    faculties: has(
      new Set(programmes.map((p) => p.faculty).filter((x): x is string => x !== null)),
      f.faculties,
    ),
    institutions: has(new Set(programmes.map((p) => p.institution)), f.institutions),
    domains: has(
      new Set(programmes.map((p) => p.domain).filter((d): d is string => d !== null)),
      f.domains,
    ),
  };
}
