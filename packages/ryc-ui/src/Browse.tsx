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
  applyProgrammeFilter,
  programmeFacets,
  programmeFilterIsEmpty,
  titleWithoutSite,
  toggle,
  type ProgrammeFilter,
} from "./filters.js";

export function Browse({
  onOpen,
  reviewCounts,
}: {
  onOpen: (code: string) => void;
  reviewCounts: Record<string, number>;
}) {
  const t = useT();
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [programme, setProgramme] = useState<ProgrammeSummary | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [filter, setFilter] = useState<ProgrammeFilter>(NO_PROGRAMME_FILTER);

  useEffect(() => {
    api.allProgrammes().then((r) => setProgrammes(r.programmes));
  }, []);

  useEffect(() => {
    if (!programme) {
      setCourses([]);
      return;
    }
    api.coursesOfProgramme(programme.code).then((r) => setCourses(r.courses));
  }, [programme]);

  const shown = useMemo(() => applyProgrammeFilter(programmes, filter), [programmes, filter]);
  const facets = useMemo(() => programmeFacets(programmes, filter), [programmes, filter]);

  if (programme) {
    return (
      <section>
        <button type="button" className="back" onClick={() => setProgramme(null)}>
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
          <CourseFilters
            courses={courses}
            reviewCounts={reviewCounts}
            onOpen={onOpen}
            emptyLabel={t("ryc.browse.noneInProgramme")}
          />
        )}
      </section>
    );
  }

  return (
    <section>
      {programmes.length === 0 ? (
        <p className="meta">{t("ryc.browse.noProgrammes")}</p>
      ) : (
        <>
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
                legend={t("ryc.filter.faculty")}
                facets={facets.faculties}
                chosen={filter.faculties}
                onToggle={(v) => setFilter({ ...filter, faculties: toggle(filter.faculties, v) })}
              />
            )}
            {facets.domains.length > 1 && (
              <FilterGroup
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
            <ul className="results">
              {shown.map((p) => (
                <li key={p.code}>
                  <button type="button" onClick={() => setProgramme(p)}>
                    <span className="code">{p.code.toUpperCase()}</span>
                    <span className="title">{titleWithoutSite(p.title, p.site)}</span>
                    <span className="facts">
                      {kindLabel(t, p.kind)}
                      {p.credits ? ` [${p.credits}]` : ""}
                      {/* The site is a fact about the programme now, not a
                          parenthesis inside its name. Shown because two
                          programmes can carry the same title in two cities. */}
                      {p.site ? ` · ${p.site}` : ""}
                      {p.courses === 0
                        ? ` · ${t("ryc.browse.noCourseList.flag")}`
                        : ` · ${t("ryc.browse.courses", { count: p.courses })}`}
                    </span>
                    <span className="facts faint">
                      {p.facultyName}
                      {p.domain ? ` · ${p.domain}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
