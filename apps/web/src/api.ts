/**
 * The only place the frontend knows about the API. Types are declared here
 * rather than imported from @studens/ref on purpose: the browser must not
 * depend on a Node-only package, and the API response is a contract in its own
 * right (FR-B11).
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
  language: string | null;
  contactHours: string | null;
  assessment: string | null;
  themes: string | null;
  content: string | null;
  owningFaculty: string | null;
  reachedVia: string[];
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  catalogue: () => json<{ year: number; courses: number }>("/api/catalogue"),
  search: (q: string) =>
    json<{ query: string; results: CourseSummary[] }>(`/api/courses?q=${encodeURIComponent(q)}`),
  course: (code: string) => json<CourseDetail>(`/api/courses/${encodeURIComponent(code)}`),
};
