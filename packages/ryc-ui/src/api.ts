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
  ects: number;
  quarter: string | null;
  teachers: string[];
  external: boolean;
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
  courses: number;
}

/** FR-D15 and FR-C16: the nulls below are the server's answer, not a client choice. */
export interface PublishedReview {
  id: string;
  path: "named" | "anonymous" | "imported";
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

/** FR-D8, mirrored so the character counter can be honest as you type. */
export const MIN_BODY = 80;

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

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
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
  reviewContext: (code: string) =>
    json<ReviewContext>(`/api/courses/${encodeURIComponent(code)}/review-context`),
  submitReview: submit,
};
