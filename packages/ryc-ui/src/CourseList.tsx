/** A list of courses, used by both search results and programme browsing. */
import { useT } from "@studens/i18n";
import type { CourseSummary } from "./api.js";
import { courseKey } from "./Ryc.js";

export function CourseList({
  courses,
  onOpen,
  reviewCounts = {},
}: {
  courses: CourseSummary[];
  /** Given the whole summary, because an address needs the institution too. */
  onOpen: (course: CourseSummary) => void;
  reviewCounts?: Record<string, number>;
}) {
  const t = useT();
  return (
    <ul className="results">
      {courses.map((c) => {
        const reviews = reviewCounts[courseKey(c)] ?? 0;
        return (
          <li key={c.code}>
            <button type="button" onClick={() => onOpen(c)}>
              <span className="code">{c.code.toUpperCase()}</span>
              <span className="title">{c.title}</span>
              <span className="facts">
                {c.ects === null ? t("ryc.course.ects.unstated") : t("ryc.course.ects", { n: c.ects })}
                {c.quarter ? ` · ${c.quarter}` : ""}
                {c.mainLanguage ? ` · ${c.mainLanguage}` : ""}
                {c.external ? ` · ${t("ryc.course.external")}` : ""}
                {c.offeredThisYear ? "" : ` · ${t("ryc.course.notOffered.flag")}`}
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
