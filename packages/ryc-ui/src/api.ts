import type { Block } from "./Prose.js";

/**
 * RYC's view of the API.
 *
 * The module talks HTTP and declares its own response types. It does NOT
 * import @studens/ref: that package reads files and is Node only, and a
 * browser reaching module storage would break FR-B11 whatever the language.
 * The API response is a contract in its own right.
 */
export interface CourseSummary {
  /**
   * Which catalogue this came from, as an institution code (OPEN-48).
   *
   * Every link to a course is built from a summary, and a link needs it: a
   * code is unique inside one catalogue and nothing more.
   */
  institution: string;
  code: string;
  title: string;
  /** The year this description comes from, which is not always the current one. */
  year: number;
  /** False when the institution no longer offers it, and this is its last description. */
  offeredThisYear: boolean;
  /** Null when the official page does not state it. Never 0 as a stand-in. */
  ects: number | null;
  quarter: string | null;
  teachers: string[];
  external: boolean;
  /** The teaching language without the accommodation note, for filtering. */
  mainLanguage: string | null;
  /** The school or institute that teaches it, not the faculty it is reached through. */
  owningEntity: string | null;
  /** The campuses, where the source states them per course. A list: a course
      is regularly taught on more than one. Empty for UCLouvain, which states
      the site on the programme instead. */
  campuses: string[];
}

export interface CourseDetail extends CourseSummary {
  /** Null for an institution no source here knows how to link to. */
  officialUrl: string | null;
  language: string | null;
  contactHours: string | null;
  /** FR-D19: scraped, and structured. See Prose.tsx for the model. */
  assessment: Block[] | null;
  themes: Block[] | null;
  content: Block[] | null;
  /** Four more both universities publish, each with a column of its own. */
  objectives: Block[] | null;
  prerequisites: Block[] | null;
  teachingMethods: Block[] | null;
  bibliography: Block[] | null;
  owningFaculty: string | null;
  reachedVia: string[];
}

export interface FacultySummary {
  code: string;
  name: string;
  programmes: number;
}

export interface ProgrammeSummary {
  /** Which catalogue this came from, for the same reason as on a course. */
  institution: string;
  code: string;
  title: string;
  /** Null when the source states no faculty for it. See snapshot version 9. */
  faculty: string | null;
  /** The faculty's own name, so a filter can be labelled with something readable. */
  facultyName: string | null;
  courses: number;
  /** Stored by the reference module. Null when nothing known matched. */
  kind: string | null;
  credits: number | null;
  /** Louvain-la-Neuve, Charleroi, and so on, as the institution publishes it. */
  site: string | null;
  /** The decree's field of study. Null where the source that publishes it does not cover the programme. */
  domain: string | null;
  /** The programme's page on the institution's site, so an empty one leads somewhere. */
  /** Null for an institution no source here knows how to link to. */
  officialUrl: string | null;
}

/**
 * FR-E8. What a reporting form offers, mirrored from the platform.
 *
 * Duplicated rather than imported for the same reason the text rules are: the
 * platform package is Node only. The endpoint publishes the authoritative list
 * at `/api/reports/categories`, and a test asserts the two agree.
 */
export const REPORT_CATEGORIES = [
  "illegal",
  "thirdparty",
  "abuse",
  "spam",
  "inaccurate",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Article 16(2)(a): a substantiated explanation, not a word. */
export const REPORT_DETAIL_MIN = 20;

export interface ReportOutcome {
  received: boolean;
  /** Whether this notice hid the review at once (FR-E11). */
  held: boolean;
  duplicate: boolean;
}

/** FR-D15 and FR-C16: the nulls below are the server's answer, not a client choice. */
export interface PublishedReview {
  id: string;
  path: "named" | "anonymous" | "imported" | "detached";
  academicYear: number;
  body: string;
  advice: string | null;
  date: string;
  author: string | null;
  recommendation: number | null;
  workloadVsEcts: number | null;
  difficulty: number | null;
  source: string | null;
}

export interface Aggregate {
  count: number;
  named: number;
  anonymous: number;
  /** FR-A15: signed, but its author has since deleted their account. */
  detached: number;
  recommendation: number | null;
  workloadVsEcts: number | null;
  difficulty: number | null;
  /** FR-D23: a band, never a percentage. Typed as a string for that reason. */
  passBand: string | null;
  passAnswers: number;
}

/** FR-C21: the two numbers a contributor gets to see before choosing a path. */
export interface ReviewContext {
  course: string;
  named: number;
  anonymous: number;
  /** null when there is no session, in which case the form is not offered. */
  quotaRemaining: number | null;
}

/** What the form collects. The path is deliberately NOT here: it is chosen after. */
export interface ReviewDraft {
  academicYear: number;
  recommendation: number;
  workloadVsEcts: number;
  difficulty: number;
  hoursPerWeek?: number | undefined;
  passed?: boolean | undefined;
  body: string;
  advice?: string | undefined;
  completed: boolean;
}

/** FR-D8, mirrored so the character counter agrees with the server as you type.
    Pinned to the server's value by a test, because a counter that disagrees
    tells somebody their review is fine and then the save refuses it. */
export const MIN_BODY = 10;
/** FR-D8's ceiling, mirrored for the same reason. The server is the authority. */
export const MAX_BODY = 4000;

/** A refused submission, carrying the field the server named. */
export class SubmitFailed extends Error {
  constructor(
    readonly status: number,
    readonly field: string | null,
    message: string,
  ) {
    super(message);
    this.name = "SubmitFailed";
  }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/**
 * Submit a review.
 *
 * `anonymous` is a separate argument from the draft, not a field inside it, so
 * that a draft object can never carry a path by accident. The caller has to
 * pass it, at the moment the person chooses (FR-C6).
 *
 * The response for the anonymous path carries no id, so this returns none.
 */
async function submit(
  institution: string,
  code: string,
  draft: ReviewDraft,
  anonymous: boolean,
): Promise<{ anonymous: boolean; id?: string }> {
  const target = `/api/courses/${encodeURIComponent(institution)}/${encodeURIComponent(code)}`;
  const res = await fetch(`${target}/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...draft, anonymous }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    field?: string;
    detail?: string;
    anonymous?: boolean;
    id?: string;
  };
  if (!res.ok) {
    throw new SubmitFailed(
      res.status,
      payload.field ?? null,
      payload.detail ?? payload.error ?? `${res.status}`,
    );
  }
  return { anonymous: payload.anonymous === true, ...(payload.id ? { id: payload.id } : {}) };
}

export const api = {
  catalogue: () =>
    json<{
      year: number;
      courses: number;
      programmes: number;
      /** What each institution contributes. The parts sum to the totals. */
      institutions: Array<{ code: string; courses: number; programmes: number }>;
    }>("/api/catalogue"),
  /**
   * The scope travels with the query, because the server applies it in the
   * query. Narrowing the answer here instead would hide the other catalogue's
   * rows and leave the reader's own truncated, which looks like a working
   * search and is not.
   */
  search: (q: string, institutions: readonly string[] = []) => {
    const params = new URLSearchParams({ q });
    if (institutions.length > 0) params.set("institutions", institutions.join(","));
    return json<{ query: string; results: CourseSummary[] }>(`/api/courses?${params.toString()}`);
  },
  course: (institution: string, code: string) =>
    json<CourseDetail>(
      `/api/courses/${encodeURIComponent(institution)}/${encodeURIComponent(code)}`,
    ),
  /**
   * Which catalogues hold a bare code, for a link made before OPEN-48.
   *
   * Deliberately not a way to fetch a course: it answers with institutions and
   * nothing else, so a caller has to go to the real address afterwards.
   */
  locate: (code: string) =>
    json<{ code: string; institutions: string[] }>(`/api/locate/${encodeURIComponent(code)}`),
  faculties: () => json<{ faculties: FacultySummary[] }>("/api/faculties"),
  /** Every programme of the year, across faculties. */
  allProgrammes: () => json<{ programmes: ProgrammeSummary[] }>("/api/programmes"),
  programmes: (faculty: string) =>
    json<{ faculty: string; programmes: ProgrammeSummary[] }>(
      `/api/faculties/${encodeURIComponent(faculty)}/programmes`,
    ),
  coursesOfProgramme: (institution: string, programme: string) =>
    json<{ institution: string; programme: string; courses: CourseSummary[] }>(
      `/api/programmes/${encodeURIComponent(institution)}/${encodeURIComponent(programme)}/courses`,
    ),
  reviews: (institution: string, code: string, page = 1) =>
    json<{
      aggregate: Aggregate;
      reviews: PublishedReview[];
      sessionRequired: boolean;
      /** The page actually served, which is clamped: an out-of-range page in a
          URL lands on a real one rather than on an empty screen. */
      page: number;
      pages: number;
      total: number;
    }>(
      `/api/courses/${encodeURIComponent(institution)}/${encodeURIComponent(code)}/reviews` +
        (page > 1 ? `?page=${page}` : ""),
    ),
  /**
   * How many published reviews each course has, for the whole catalogue.
   *
   * One request for the lot rather than one per course: at launch 10 courses of
   * 547 have anything to read, so the answer is a few hundred bytes and it is
   * what makes "only courses with reviews" possible at all.
   *
   * Keyed `<institution>/<code>`, because a bare code is not a course
   * (OPEN-48). `courseKey` builds the key; nothing should build it by hand.
   */
  reviewCounts: () => json<{ counts: Record<string, number> }>("/api/reviews/counts"),
  /**
   * WHICH CATALOGUES THIS MEMBER WANTS IN FRONT OF THEM.
   *
   * A fact about the member, so the platform owns it and this module reads it
   * (FR-B11). It starts as the institution chosen at the first run, and an
   * empty answer means "everything": somebody who never said has not asked to
   * be narrowed.
   *
   * 401 is an ordinary answer, not an error. Browsing works signed out, and a
   * visitor with no account has no preference to honour.
   */
  myInstitutions: () => json<{ institutions: string[] }>("/api/me/institutions"),
  addInstitution: (code: string) =>
    json<{ institutions: string[] }>("/api/me/institutions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  removeInstitution: (code: string) =>
    json<{ institutions: string[] }>(`/api/me/institutions/${encodeURIComponent(code)}`, {
      method: "DELETE",
    }),
  /**
   * FR-E8: file a notice. Works signed in or not, which Article 16 requires.
   *
   * The kind is fixed here rather than asked of the caller: a reporter sees a
   * review, not a storage path, and the module knows what its own content is
   * called.
   */
  report: (input: {
    targetId: string;
    category: ReportCategory;
    detail: string;
    contactEmail?: string;
  }) =>
    json<ReportOutcome>("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetKind: "ryc.review", ...input }),
    }),
  reviewContext: (institution: string, code: string) =>
    json<ReviewContext>(
      `/api/courses/${encodeURIComponent(institution)}/${encodeURIComponent(code)}/review-context`,
    ),
  submitReview: submit,
};
