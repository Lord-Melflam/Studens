/**
 * The course filter bar plus the list beneath it.
 *
 * One component for both places a course list appears, so a filter that works
 * when browsing cannot be missing when searching. That is not a hypothetical:
 * the summary object these read was built three times in the reference module
 * and adding a field to two of the three would have produced exactly that.
 *
 * The filter state lives here rather than in the URL. A filter is a refinement
 * of a screen, not a screen, and the programme being browsed is itself not yet
 * in the URL (see Ryc.tsx). Putting filters in the URL before the programme is
 * would produce a link that restores the filter and not what it filtered.
 */
import { useMemo, useState } from "react";
import { useT } from "@studens/i18n";
import type { CourseSummary } from "./api.js";
import { CourseList } from "./CourseList.js";
import { FilterBar, FilterGroup, FilterText } from "./Filters.js";
import {
  NO_COURSE_FILTER,
  applyCourseFilter,
  courseFacets,
  courseFilterIsEmpty,
  groupByTerm,
  toggle,
  type CourseFilter,
} from "./filters.js";

export function CourseFilters({
  courses,
  reviewCounts,
  onOpen,
  emptyLabel,
}: {
  courses: CourseSummary[];
  reviewCounts: Record<string, number>;
  onOpen: (code: string) => void;
  /** What to say when the list itself is empty, before any filter is applied. */
  emptyLabel: string;
}) {
  const t = useT();
  const [filter, setFilter] = useState<CourseFilter>(NO_COURSE_FILTER);

  const shown = useMemo(
    () => applyCourseFilter(courses, filter, reviewCounts),
    [courses, filter, reviewCounts],
  );
  const facets = useMemo(
    () => courseFacets(courses, filter, reviewCounts),
    [courses, filter, reviewCounts],
  );

  if (courses.length === 0) return <p className="meta">{emptyLabel}</p>;

  return (
    <>
      <FilterBar
        active={!courseFilterIsEmpty(filter)}
        onClear={() => setFilter(NO_COURSE_FILTER)}
        summary={t("ryc.filter.count", { shown: shown.length, total: courses.length })}
      >
        <FilterText
          id="course-q"
          label={t("ryc.filter.search")}
          placeholder={t("ryc.filter.searchPlaceholder")}
          value={filter.text}
          onChange={(text) => setFilter({ ...filter, text })}
        />
        <FilterGroup
          legend={t("ryc.filter.quarter")}
          facets={facets.quarters}
          chosen={filter.quarters}
          onToggle={(v) => setFilter({ ...filter, quarters: toggle(filter.quarters, v) })}
        />
        <FilterGroup
          legend={t("ryc.filter.ects")}
          facets={facets.ects}
          chosen={filter.ects}
          onToggle={(v) => setFilter({ ...filter, ects: toggle(filter.ects, v) })}
        />
        <FilterGroup
          legend={t("ryc.filter.language")}
          facets={facets.languages}
          chosen={filter.languages}
          onToggle={(v) => setFilter({ ...filter, languages: toggle(filter.languages, v) })}
        />
        <FilterGroup
          legend={t("ryc.filter.entity")}
          facets={facets.entities}
          chosen={filter.entities}
          onToggle={(v) => setFilter({ ...filter, entities: toggle(filter.entities, v) })}
        />

        {/*
          Its own control rather than a chip group, because it is a yes or no
          and because it is the one filter that is about US rather than about
          the catalogue: it says where there is anything to read. Hidden when
          there is nothing, so it never offers an empty screen.
        */}
        {facets.reviewed > 0 && (
          <fieldset className="filter-group">
            <legend>{t("ryc.filter.reviews")}</legend>
            <div className="chips">
              <button
                type="button"
                className={filter.reviewedOnly ? "chip on" : "chip"}
                aria-pressed={filter.reviewedOnly}
                onClick={() => setFilter({ ...filter, reviewedOnly: !filter.reviewedOnly })}
              >
                {t("ryc.filter.reviewedOnly")}
                <span className="n">{facets.reviewed}</span>
              </button>
            </div>
          </fieldset>
        )}
      </FilterBar>

      {shown.length === 0 ? (
        <p className="empty">{t("ryc.filter.noMatch")}</p>
      ) : (
        // One child, for the same reason as the programme list: the parent may
        // be a two column grid, and a section per term would be laid out one
        // per column.
        <div className="browse-list">
          {groupByTerm(shown).map(([term, rows]) => (
          <section className="term-group" key={String(term)}>
            {term !== null && (
              <h3 className="term-group-title">
                {term} <span className="n">{rows.length}</span>
              </h3>
            )}
            {term === null && rows.length !== shown.length && (
              <h3 className="term-group-title">
                {t("ryc.filter.noTerm")} <span className="n">{rows.length}</span>
              </h3>
            )}
              <CourseList courses={rows} onOpen={onOpen} reviewCounts={reviewCounts} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
