/** A list of courses, used by both search results and programme browsing. */
import type { CourseSummary } from "./api.js";

export function CourseList({
  courses,
  onOpen,
}: {
  courses: CourseSummary[];
  onOpen: (code: string) => void;
}) {
  return (
    <ul className="results">
      {courses.map((c) => (
        <li key={c.code}>
          <button type="button" onClick={() => onOpen(c.code)}>
            <span className="code">{c.code.toUpperCase()}</span>
            <span className="title">{c.title}</span>
            <span className="facts">
              {c.ects} ECTS
              {c.quarter ? ` · ${c.quarter}` : ""}
              {c.teachers.length ? ` · ${c.teachers[0]}` : ""}
              {c.external ? " · autre institution" : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
