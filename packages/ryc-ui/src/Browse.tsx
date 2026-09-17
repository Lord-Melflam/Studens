/**
 * Browsing by programme (FR-D24, FR-D25).
 *
 * This exists because search only helps a student who already knows the code,
 * and 1.1's problem is choosing electives blind, which is a discovery problem.
 * See docs/requirements.md 3.4.
 *
 * Two lists, each filtered: the programmes, and then up to a few hundred courses
 * inside one. Both were unfiltered scrolls, which is fine for a demonstration
 * and useless for the thing it is for: nobody reads 200 courses looking for the
 * Q2 ones worth five credits that somebody has written about.
 *
 * THE FACULTY IS A FILTER, NOT A GATE. It used to be a choice made before
 * anything appeared, which is fine while the catalogue is one faculty and wrong
 * the moment it is twenty-one: somebody looking for a minor does not know which
 * faculty owns it, and not knowing yet is what browsing is. UCLouvain's own
 * catalogue does not ask either. So every programme of the year is listed, and
 * the faculty joins the kind, the site and the field of study as something to
 * narrow by.
 */
import { useEffect, useMemo, useState } from "react";
import { useT } from "@studens/i18n";
import { api, type CourseSummary, type ProgrammeSummary } from "./api.js";
import { CourseFilters } from "./CourseFilters.js";
import { FilterBar, FilterGroup, FilterText, kindLabel } from "./Filters.js";
import {
  NO_PROGRAMME_FILTER,
  PROGRAMME_FILTER_KEYS,
  applyProgrammeFilter,
  groupByKind,
  programmeFacets,
  programmeFilterFromQuery,
  programmeFilterIsEmpty,
  programmeFilterToQuery,
  pruneProgrammeFilter,
  titleWithoutSite,
  toggle,
  type ProgrammeFilter,
} from "./filters.js";
import { queryOf, settingsRoute } from "./urlstate.js";
import { programmePath } from "./Ryc.js";

export function Browse({
  programme: openCode,
  legacyProgramme,
  onOpenProgramme,
  onOpen,
  reviewCounts,
  search,
  navigate,
}: {
  /**
   * The programme in the URL, or null for the list.
   *
   * It used to be component state, so a programme could not be linked to, a
   * refresh lost it, and Back left the app instead of stepping out of it.
   * Navigation that does not touch the URL is not navigation.
   */
  programme: { institution: string; code: string } | null;
  /**
   * A programme code from a link written before the institution was in the
   * path (OPEN-48).
   *
   * Resolved here rather than by an endpoint of its own, because this screen
   * already holds every programme of the year: the answer is in memory.
   */
  legacyProgramme: string | null;
  onOpenProgramme: (programme: { institution: string; code: string } | null) => void;
  onOpen: (course: CourseSummary) => void;
  reviewCounts: Record<string, number>;
  /** The query string, carried down unread from the shell. */
  search: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}) {
  const t = useT();
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  /**
   * The filter, in the URL for the same reason the programme is: it is part of
   * what you are looking at. Held here, opening a course and pressing Back
   * came back to an unfiltered list of 692 programmes.
   *
   * Derived, never copied into state. Pruned against the programmes actually
   * loaded, so a link kept across a crawl drops the faculty that was renamed
   * rather than showing nothing with nothing to unclick.
   */
  const filter = useMemo(
    () => pruneProgrammeFilter(programmeFilterFromQuery(queryOf(search)), programmes),
    [search, programmes],
  );
  const setFilter = (next: ProgrammeFilter): void => {
    navigate(settingsRoute("/", search, PROGRAMME_FILTER_KEYS, programmeFilterToQuery(next)), {
      replace: true,
    });
  };

  useEffect(() => {
    api.allProgrammes().then((r) => setProgrammes(r.programmes));
  }, []);

  /**
   * Forward a legacy link once the list it is resolved against has arrived.
   *
   * Exactly one match is sent to its real address, replacing the history entry
   * so Back does not land on the old one and bounce forward again. More than
   * one is genuinely ambiguous: two universities publishing the same programme
   * code, with nothing in the link to say which was meant, and picking would
   * send a reader somewhere they never asked to go.
   */
  const legacyMatches = useMemo(
    () => (legacyProgramme ? programmes.filter((p) => p.code === legacyProgramme) : []),
    [legacyProgramme, programmes],
  );
  useEffect(() => {
    if (!legacyProgramme || legacyMatches.length !== 1) return;
    const only = legacyMatches[0]!;
    // WITH THE QUERY STRING. Filters live in the URL since FR-B21, so an old
    // link to a filtered list carries them, and forwarding the path alone
    // would answer a shared link with a different list than it named.
    navigate(`${programmePath(only.institution, only.code)}${search}`, { replace: true });
  }, [legacyProgramme, legacyMatches, search]);

  // Derived from the URL rather than held beside it, so there is one answer to
  // "which programme am I looking at" and a refresh gives the same one.
  const programme = openCode
    ? (programmes.find(
        (p) => p.code === openCode.code && p.institution === openCode.institution,
      ) ?? null)
    : null;

  useEffect(() => {
    if (!openCode) {
      setCourses([]);
      return;
    }
    let live = true;
    setCourses([]);
    api
      .coursesOfProgramme(openCode.institution, openCode.code)
      .then((r) => live && setCourses(r.courses));
    return () => {
      live = false;
    };
  }, [openCode?.institution, openCode?.code]);

  const shown = useMemo(() => applyProgrammeFilter(programmes, filter), [programmes, filter]);
  const grouped = useMemo(() => groupByKind(shown), [shown]);
  const facets = useMemo(() => programmeFacets(programmes, filter), [programmes, filter]);

  // The list has arrived and the code in the URL is not in it. Said rather than
  // silently showing the whole list again, which would look like a lost click.
  if (openCode && programmes.length > 0 && !programme) {
    return (
      <section>
        <button type="button" className="back" onClick={() => onOpenProgramme(null)}>
          {t("ryc.browse.back")}
        </button>
        <p className="empty">{t("ryc.browse.noSuchProgramme", { code: openCode.code.toUpperCase() })}</p>
      </section>
    );
  }

  if (legacyProgramme) {
    if (programmes.length === 0) return <p className="meta">{t("ryc.loading")}</p>;
    if (legacyMatches.length === 0) {
      return (
        <p className="empty">
          {t("ryc.browse.noSuchProgramme", { code: legacyProgramme.toUpperCase() })}
        </p>
      );
    }
    if (legacyMatches.length === 1) return <p className="meta">{t("ryc.loading")}</p>;
    return (
      <section>
        <p className="notice">
          {t("ryc.legacy.ambiguous", { code: legacyProgramme.toUpperCase() })}
        </p>
        <ul className="plain">
          {legacyMatches.map((p) => (
            <li key={p.institution}>
              <button type="button" className="linkish" onClick={() => onOpenProgramme(p)}>
                {p.institution.toUpperCase()}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (openCode && !programme) return <p className="meta">{t("ryc.loading")}</p>;

  if (programme) {
    return (
      <section>
        <button type="button" className="back" onClick={() => onOpenProgramme(null)}>
          {t("ryc.browse.back")}
        </button>
        <h2 className="browse-title">{programme.title}</h2>
        {/*
          A programme with no course list is not a dead end and not a failure of
          ours: 247 of 690 publish none, mostly continuing education and joint
          programmes whose courses are hosted by a partner institution. They
          used to be hidden from the list entirely, which made the catalogue
          quietly smaller than the one it copies. So they are listed, and here
          the screen says what the institution does and does not publish, and
          points at the page that does.
        */}
        {programme.courses === 0 ? (
          <div className="programme-empty">
            <p>{t("ryc.browse.noCourseList")}</p>
            <p className="hint">{t("ryc.browse.noCourseList.why")}</p>
            <a
              className="official"
              href={programme.officialUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t("ryc.browse.officialProgramme")}
            </a>
          </div>
        ) : (
          // The same column as the programme list, and for the same reason: the
          // biggest programme holds 173 courses, so five filter groups stacked
          // above them push the list itself off the screen.
          <div className="browse-wide">
            <CourseFilters
              courses={courses}
              reviewCounts={reviewCounts}
              onOpen={onOpen}
              emptyLabel={t("ryc.browse.noneInProgramme")}
              search={search}
              here={programmePath(openCode!.institution, openCode!.code)}
              navigate={navigate}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      {programmes.length === 0 ? (
        <p className="meta">{t("ryc.browse.noProgrammes")}</p>
      ) : (
        <div className="browse-wide">
          <FilterBar
            active={!programmeFilterIsEmpty(filter)}
            onClear={() => setFilter(NO_PROGRAMME_FILTER)}
            summary={t("ryc.browse.count", { shown: shown.length, total: programmes.length })}
          >
            <FilterText
              id="prog-q"
              label={t("ryc.filter.search")}
              placeholder={t("ryc.browse.searchPlaceholder")}
              value={filter.text}
              onChange={(text) => setFilter({ ...filter, text })}
            />
            {/* First, because it is the widest question: which university.
                A dimension with one option is not rendered, so this control
                appears only once a second catalogue is loaded. */}
            <FilterGroup
              legend={t("ryc.filter.institution")}
              facets={facets.institutions}
              chosen={filter.institutions}
              onToggle={(v) =>
                setFilter({ ...filter, institutions: toggle(filter.institutions, v) })
              }
            />
            <FilterGroup
              legend={t("ryc.filter.kind")}
              facets={facets.kinds}
              chosen={filter.kinds}
              onToggle={(v) => setFilter({ ...filter, kinds: toggle(filter.kinds, v) })}
              labelFor={(f) => kindLabel(t, f.value)}
            />
            <FilterGroup
              legend={t("ryc.filter.site")}
              facets={facets.sites}
              chosen={filter.sites}
              onToggle={(v) => setFilter({ ...filter, sites: toggle(filter.sites, v) })}
            />
            {/* Both only appear once there is more than one to choose between:
                a filter with a single option filters nothing and costs a line
                of a screen somebody is trying to read. */}
            {facets.faculties.length > 1 && (
              <FilterGroup
                collapsed
                legend={t("ryc.filter.faculty")}
                facets={facets.faculties}
                chosen={filter.faculties}
                onToggle={(v) => setFilter({ ...filter, faculties: toggle(filter.faculties, v) })}
              />
            )}
            {facets.domains.length > 1 && (
              <FilterGroup
                collapsed
                legend={t("ryc.filter.domain")}
                facets={facets.domains}
                chosen={filter.domains}
                onToggle={(v) => setFilter({ ...filter, domains: toggle(filter.domains, v) })}
              />
            )}
          </FilterBar>

          {shown.length === 0 ? (
            <p className="empty">{t("ryc.browse.noMatch")}</p>
          ) : (
            /*
              GROUPED BY KIND, not one alphabetical run of 690.

              A flat list of that length is a wall: bachelors, masters, minors
              and 263 certificates interleaved by title, so finding "the
              masters" means reading past everything else. UCLouvain's own
              catalogue renders these as sections, and it is the shape somebody
              already has in their head. The order is the one the kind filter
              uses, so the two agree.

              One group draws no heading, because a heading over the whole list
              says nothing.
            */
            /*
              ONE CHILD, not one per kind. `.browse-wide` is a two column grid
              and a grid places children in order, so eight kind sections became
              eight grid items and the even ones were laid out in the filter
              column: programmes 272px wide, under the filters. Grouping the
              list changed how many children this returns, and the grid was
              written when it returned one.
            */
            <div className="browse-list">
              {grouped.map(([kind, rows]) => (
              <section className="prog-group" key={String(kind)}>
                {grouped.length > 1 && (
                  <h3 className="prog-group-title">
                    {kindLabel(t, kind)} <span className="n">{rows.length}</span>
                  </h3>
                )}
                <ul className="results">
                  {rows.map((p) => (
                    <li key={p.code}>
                      <button type="button" onClick={() => onOpenProgramme(p)}>
                        <span className="code">{p.code.toUpperCase()}</span>
                        <span className="title">{titleWithoutSite(p.title, p.site)}</span>
                        {/*
                          ONE LINE, AND FOUR FACTS FEWER THAN IT HAD.

                          At 690 rows every word is paid for 690 times. What
                          went, and why each one was safe to lose:

                          the KIND, because the row now sits under a heading
                          that says it; the CREDITS, because all 179 programmes
                          that state them state them in the title as well, so
                          "[120]" appeared twice on one row; the FACULTY'S FULL
                          NAME, replaced by the code it already ends with, which
                          is what students say out loud; and the FIELD OF STUDY,
                          which is a filter beside the list and was the longest
                          string on the row.

                          What stayed is what tells two rows apart: the site,
                          because two programmes carry the same title in two
                          cities, and the number of courses, because it is the
                          only clue about whether there is anything to read.
                        */}
                        <span className="facts">
                          {p.site ?? ""}
                          {p.courses === 0
                            ? `${p.site ? " · " : ""}${t("ryc.browse.noCourseList.flag")}`
                            : `${p.site ? " · " : ""}${t("ryc.browse.courses", { count: p.courses })}`}
                          {` · ${p.faculty.toUpperCase()}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
