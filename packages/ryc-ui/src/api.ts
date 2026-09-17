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
  code: string;
  title: string;
  year: number;
  /** Null when the official page does not state it. Never 0 as a stand-in. */
  ects: number | null;
  quarter: string | null;
  teachers: string[];
  external: boolean;
  /** The teaching language without the accommodation note, for filtering. */
  mainLanguage: string | null;
  /** The school or institute that teaches it, not the faculty it is reached through. */
  owningEntity: string | null;
}

export interface CourseDetail extends CourseSummary {
  officialUrl: string;
  language: string | null;
  contactHours: string | null;
  /** FR-D19: scraped, and structured. See Prose.tsx for the model. */
  assessment: Block[] | null;
  themes: Block[] | null;
  content: Block[] | null;
  owningFaculty: string | null;
  reachedVia: string[];
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
  /** The faculty's own name, so a filter can be labelled with something readable. */
  facultyName: string;
  courses: number;
  /** Stored by the reference module. Null when nothing known matched. */
  kind: string | null;
  credits: number | null;
  /** Louvain-la-Neuve, Charleroi, and so on, as the institution publishes it. */
  site: string | null;
  /** The decree's field of study. Null where the source that publishes it does not cover the programme. */
  domain: string | null;
  /** The programme's page on the institution's site, so an empty one leads somewhere. */
  officialUrl: string;
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

/** FR-D8, mirrored so the character counter agrees with the server as you type. */
export const MIN_BODY = 80;
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
  code: string,
  draft: ReviewDraft,
  anonymous: boolean,
): Promise<{ anonymous: boolean; id?: string }> {
  const res = await fetch(`/api/courses/${encodeURIComponent(code)}/reviews`, {
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
  catalogue: () => json<{ year: number; courses: number }>("/api/catalogue"),
  search: (q: string) =>
    json<{ query: string; results: CourseSummary[] }>(`/api/courses?q=${encodeURIComponent(q)}`),
  course: (code: string) => json<CourseDetail>(`/api/courses/${encodeURIComponent(code)}`),
  faculties: () => json<{ faculties: FacultySummary[] }>("/api/faculties"),
  /** Every programme of the year, across faculties. */
  allProgrammes: () => json<{ programmes: ProgrammeSummary[] }>("/api/programmes"),
  programmes: (faculty: string) =>
    json<{ faculty: string; programmes: ProgrammeSummary[] }>(
      `/api/faculties/${encodeURIComponent(faculty)}/programmes`,
    ),
  coursesOfProgramme: (programme: string) =>
    json<{ programme: string; courses: CourseSummary[] }>(
      `/api/programmes/${encodeURIComponent(programme)}/courses`,
    ),
  reviews: (code: string) =>
    json<{ aggregate: Aggregate; reviews: PublishedReview[]; sessionRequired: boolean }>(
      `/api/courses/${encodeURIComponent(code)}/reviews`,
    ),
  /**
   * How many published reviews each course has, for the whole catalogue.
   *
   * One request for the lot rather than one per course: at launch 10 courses of
   * 547 have anything to read, so the answer is a few hundred bytes and it is
   * what makes "only courses with reviews" possible at all.
   */
  reviewCounts: () => json<{ counts: Record<string, number> }>("/api/reviews/counts"),
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
  reviewContext: (code: string) =>
    json<ReviewContext>(`/api/courses/${encodeURIComponent(code)}/review-context`),
  submitReview: submit,
};
