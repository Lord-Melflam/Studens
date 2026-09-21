/**
 * The course filter bar plus the list beneath it.
 *
 * One component for both places a course list appears, so a filter that works
 * when browsing cannot be missing when searching. That is not a hypothetical:
 * the summary object these read was built three times in the reference module
 * and adding a field to two of the three would have produced exactly that.
 *
 * THE FILTER LIVES IN THE URL, and this component holds no state at all.
 *
 * It used to hold it here, on the ground that a filter is a refinement of a
 * screen rather than a screen, and that the programme being browsed was itself
 * not yet in the URL. The second half stopped being true when the programme
 * moved into the path, and the first half was answered by pressing Back
 * after opening a course and finding the filters gone. A refinement of a
 * screen is still part of what you are looking at.
 *
 * Derived on every render rather than copied into state, because a copy is
 * exactly the thing that falls out of step with the address bar.
 */
import { useMemo, useState } from "react";
import { useT } from "@studens/i18n";
import type { CourseSummary } from "./api.js";
import { CourseList } from "./CourseList.js";
import { FilterBar, FilterGroup, FilterText } from "./Filters.js";
import {
  COURSE_FILTER_KEYS,
  NO_COURSE_FILTER,
  applyCourseFilter,
  courseFacets,
  courseFilterFromQuery,
  courseFilterIsEmpty,
  courseFilterToQuery,
  groupByTerm,
  pruneCourseFilter,
  toggle,
  type CourseFilter,
} from "./filters.js";
import { queryOf, settingsRoute } from "./urlstate.js";

/** Rows drawn before the reader asks for more. About a screenful. */
const DRAWN_STEP = 25;

export function CourseFilters({
  courses,
  /** What the catalogue matched, where the list is a window over it. */
  matched,
  /** Lengthens that window. Absent on lists that are not windowed. */
  onShowMore,
  reviewCounts,
  onOpen,
  emptyLabel,
  textFilter = true,
  search,
  here,
  navigate,
}: {
  courses: CourseSummary[];
  matched?: number | undefined;
  onShowMore?: (() => void) | undefined;
  reviewCounts: Record<string, number>;
  onOpen: (course: CourseSummary) => void;
  /** What to say when the list itself is empty, before any filter is applied. */
  emptyLabel: string;
  /**
   * Whether to draw the filter's own "code or word in the title" box.
   *
   * Off on the search screen, where the box above it asks the server the same
   * question in almost the same words. Two inputs labelled "code ou mot du
   * titre", stacked, one narrowing what the other returned: nobody could tell
   * why there were two, and it was the first thing anybody called ugly.
   */
  textFilter?: boolean;
  /** The query string the shell handed the module. */
  search: string;
  /** The module-relative path of the screen this list is on, which the filter
      is written back onto. */
  here: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}) {
  const t = useT();
  const filter = useMemo(
    // Pruned against the courses actually here, so a link kept from before the
    // last crawl loses the options that no longer exist instead of emptying
    // the list with no chip left to unclick.
    () => pruneCourseFilter(courseFilterFromQuery(queryOf(search)), courses),
    [search, courses],
  );
  const setFilter = (next: CourseFilter): void => {
    // `replace`: pressing a chip is not going somewhere. Six chips must not be
    // six history entries, or Back walks back through your own filtering.
    navigate(settingsRoute(here, search, COURSE_FILTER_KEYS, courseFilterToQuery(next)), {
      replace: true,
    });
  };

  const shown = useMemo(
    () => applyCourseFilter(courses, filter, reviewCounts),
    [courses, filter, reviewCounts],
  );
  const facets = useMemo(
    () => courseFacets(courses, filter, reviewCounts),
    [courses, filter, reviewCounts],
  );

  if (courses.length === 0) return <p className="meta">{emptyLabel}</p>;

  /**
   * HOW MANY ROWS ARE DRAWN, and it is not the same question as how many the
   * server sent.
   *
   * This component draws two different lists: search results, which the
   * server already windows, and a programme's courses, which it does not.
   * `gest2m` has 349, measured 2026-09-21, and every one of them was being
   * rendered. NFR-O4: a list that can grow gets a strategy when it is
   * written, and the cheapest correct one is to draw a screenful and let the
   * reader ask for more.
   *
   * Local rather than in the address, because it is a rendering budget rather
   * than a description of what is on screen: the filters and the query, which
   * ARE that, stay in the URL.
   */
  const [drawn, setDrawn] = useState(DRAWN_STEP);
  const visible = shown.slice(0, drawn);
  /** More to draw from what is already here, before asking the server. */
  const moreLocally = shown.length > drawn;

  return (
    <>
      <FilterBar
        active={!courseFilterIsEmpty(filter)}
        onClear={() => setFilter(NO_COURSE_FILTER)}
        summary={
          /*
            TRUNCATED IS SAID DIFFERENTLY FROM FILTERED, because they are
            different facts and one number cannot carry both. The search
            window is 25, so a query matching 282 courses arrived here as 25
            and the line read "25 of 25": true about the array it was handed,
            false about the catalogue, and it told somebody the search was
            complete when it was not.

            `matched` is absent on the lists that are not windowed, and then
            this is the count it always was.
          */
          matched !== undefined && matched > courses.length
            ? t("ryc.filter.count.window", { shown: shown.length, total: matched })
            : t("ryc.filter.count", { shown: shown.length, total: courses.length })
        }
      >
        {textFilter && (
          <FilterText
            id="course-q"
            label={t("ryc.filter.search")}
            placeholder={t("ryc.filter.searchPlaceholder")}
            value={filter.text}
            onChange={(text) => setFilter({ ...filter, text })}
          />
        )}
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
          /* `FR` rather than `fr`: a two letter code in lower case reads as a
             typo next to a course row saying "Français", and in upper case it
             reads as what it is, a language tag. Anything longer is a value
             this normaliser did not recognise, so it is shown exactly as the
             university published it. */
          labelFor={(f) => (f.value.length <= 3 ? f.value.toUpperCase() : f.value)}
        />
        {/* Where the class is. Self-effacing like every other dimension: a
            filter with one option is not drawn, so this appears only for a
            catalogue whose source states a campus per course. */}
        <FilterGroup
          legend={t("ryc.filter.campus")}
          facets={facets.campuses}
          chosen={filter.campuses}
          onToggle={(v) => setFilter({ ...filter, campuses: toggle(filter.campuses, v) })}
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
            <div className="chipset">
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
          {groupByTerm(visible).map(([term, rows]) => (
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
          {/*
            LENGTHEN THE LIST, rather than telling somebody to search better.
            A student looking for a course often does not know its name, which
            is why they are searching, so "narrow it" is advice they cannot
            take. The step is the administrator's setting, and the button says
            how many are left so the number itself suggests filtering when it
            is large.
          */}
          {/*
            ONE BUTTON, TWO SOURCES. While there are rows here that are not
            drawn, it draws them. Once they are all drawn and the server says
            it holds more, it asks the server. A reader does not need to know
            which of the two is happening, and splitting it into two controls
            would make them learn.
          */}
          {moreLocally ? (
            <button
              type="button"
              className="browse-more"
              onClick={() => setDrawn(drawn + DRAWN_STEP)}
            >
              {t("ryc.filter.more", { n: shown.length - drawn })}
            </button>
          ) : (
            onShowMore &&
            matched !== undefined &&
            matched > courses.length && (
              <button type="button" className="browse-more" onClick={onShowMore}>
                {t("ryc.filter.more", { n: matched - courses.length })}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}
