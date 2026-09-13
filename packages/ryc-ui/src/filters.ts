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
 * Standard faceted search, and the reason is honesty: if "Q1" said 23 while the
 * language filter had already excluded all 23, clicking it would empty the
 * screen. A count here is what you get if you click it.
 */
import type { CourseSummary, ProgrammeSummary } from "./api.js";

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
  ects: number[];
  entities: string[];
  /** FR-D24 is discovery: at launch 10 courses of 547 have anything to read. */
  reviewedOnly: boolean;
}

export const NO_COURSE_FILTER: CourseFilter = {
  text: "",
  quarters: [],
  languages: [],
  ects: [],
  entities: [],
  reviewedOnly: false,
};

export function courseFilterIsEmpty(f: CourseFilter): boolean {
  return (
    f.text.trim() === "" &&
    f.quarters.length === 0 &&
    f.languages.length === 0 &&
    f.ects.length === 0 &&
    f.entities.length === 0 &&
    !f.reviewedOnly
  );
}

/** The dimensions, so a facet can be counted with its own one ignored. */
type Dimension = "text" | "quarters" | "languages" | "ects" | "entities" | "reviewedOnly";

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
    if (!c.quarter || !f.quarters.includes(c.quarter)) return false;
  }
  if (ignore !== "languages" && f.languages.length > 0) {
    if (!c.mainLanguage || !f.languages.includes(c.mainLanguage)) return false;
  }
  if (ignore !== "ects" && f.ects.length > 0) {
    if (!f.ects.includes(c.ects)) return false;
  }
  if (ignore !== "entities" && f.entities.length > 0) {
    if (!c.owningEntity || !f.entities.includes(c.owningEntity)) return false;
  }
  if (ignore !== "reviewedOnly" && f.reviewedOnly) {
    if ((counts[c.code] ?? 0) === 0) return false;
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
  ects: Array<Facet<number>>;
  entities: Array<Facet<string>>;
  /** How many of the currently matching courses have anything to read. */
  reviewed: number;
}

export function courseFacets(
  courses: CourseSummary[],
  f: CourseFilter,
  counts: Record<string, number> = {},
): CourseFacets {
  return {
    quarters: facetsOf(courses, f, counts, "quarters", (c) => c.quarter),
    languages: facetsOf(courses, f, counts, "languages", (c) => c.mainLanguage),
    ects: facetsOf(courses, f, counts, "ects", (c) => c.ects),
    entities: facetsOf(courses, f, counts, "entities", (c) => c.owningEntity),
    reviewed: courses.filter(
      (c) => matchesCourse(c, f, counts, "reviewedOnly") && (counts[c.code] ?? 0) > 0,
    ).length,
  };
}

// --------------------------------------------------------------------------
// Programmes
// --------------------------------------------------------------------------

export interface ProgrammeFilter {
  text: string;
  /** `null` in the list means "kind we could not parse", shown as its own group. */
  kinds: Array<string | null>;
  sites: string[];
}

export const NO_PROGRAMME_FILTER: ProgrammeFilter = { text: "", kinds: [], sites: [] };

export function programmeFilterIsEmpty(f: ProgrammeFilter): boolean {
  return f.text.trim() === "" && f.kinds.length === 0 && f.sites.length === 0;
}

type ProgrammeDimension = "text" | "kinds" | "sites";

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

  /**
   * A fixed order for the kinds, because alphabetical would put "certificat"
   * above "bachelier" and the list reads as a progression: what you study
   * first, then what you add to it, then what comes after.
   */
  const order = [
    "bachelier",
    "master",
    "specialisation",
    "mineure",
    "filiere",
    "approfondissement",
    "certificat",
  ];
  const rank = (k: string | null) => (k === null ? order.length : order.indexOf(k));

  return {
    kinds: [...kinds.entries()]
      .map(([value, count]) => ({ value, label: String(value ?? "autre"), count }))
      .sort((a, b) => rank(a.value) - rank(b.value)),
    sites: [...sites.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };
}

/** Toggle a value in a multi-select list. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
