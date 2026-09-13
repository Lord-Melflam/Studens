/** A list of courses, used by both search results and programme browsing. */
import { useT } from "@studens/i18n";
import type { CourseSummary } from "./api.js";

export function CourseList({
  courses,
  onOpen,
  reviewCounts = {},
}: {
  courses: CourseSummary[];
  onOpen: (code: string) => void;
  reviewCounts?: Record<string, number>;
}) {
  const t = useT();
  return (
    <ul className="results">
      {courses.map((c) => {
        const reviews = reviewCounts[c.code] ?? 0;
        return (
          <li key={c.code}>
            <button type="button" onClick={() => onOpen(c.code)}>
              <span className="code">{c.code.toUpperCase()}</span>
              <span className="title">{c.title}</span>
              <span className="facts">
                {t("ryc.course.ects", { n: c.ects })}
                {c.quarter ? ` · ${c.quarter}` : ""}
                {c.mainLanguage ? ` · ${c.mainLanguage}` : ""}
                {c.external ? ` · ${t("ryc.course.external")}` : ""}
              </span>
              {/*
                A count, never a rating. Ten courses of 547 have anything at
                all, so a score in a list would rank coverage and read as
                quality. And FR-D15 keeps per-review numbers off the anonymous
                path entirely, so for many courses there is no number to show.
              */}
              {reviews > 0 && (
                <span className="badge">{t("ryc.course.reviews", { count: reviews })}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
