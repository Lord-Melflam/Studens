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
  assessment: string | null;
  themes: string | null;
  content: string | null;
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
  faculties: () => json<{ faculties: FacultySummary[] }>("/api/faculties"),
  programmes: (faculty: string) =>
    json<{ faculty: string; programmes: ProgrammeSummary[] }>(
      `/api/faculties/${encodeURIComponent(faculty)}/programmes`,
    ),
  coursesOfProgramme: (programme: string) =>
    json<{ programme: string; courses: CourseSummary[] }>(
      `/api/programmes/${encodeURIComponent(programme)}/courses`,
    ),
};
