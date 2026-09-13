/**
 * Browsing by programme (FR-D24, FR-D25).
 *
 * This exists because search only helps a student who already knows the code,
 * and 1.1's problem is choosing electives blind, which is a discovery problem.
 * See docs/requirements.md 3.4.
 *
 * Two lists, each filtered: 43 programmes, and then up to a few hundred courses
 * inside one. Both were unfiltered scrolls, which is fine for a demonstration
 * and useless for the thing it is for: nobody reads 200 courses looking for the
 * Q2 ones worth five credits that somebody has written about.
 */
import { useEffect, useMemo, useState } from "react";
import { useT } from "@studens/i18n";
import { api, type CourseSummary, type FacultySummary, type ProgrammeSummary } from "./api.js";
import { CourseFilters } from "./CourseFilters.js";
import { FilterBar, FilterGroup, FilterText, kindLabel } from "./Filters.js";
import {
  NO_PROGRAMME_FILTER,
  applyProgrammeFilter,
  programmeFacets,
  programmeFilterIsEmpty,
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
  const [faculties, setFaculties] = useState<FacultySummary[]>([]);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [programme, setProgramme] = useState<ProgrammeSummary | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [filter, setFilter] = useState<ProgrammeFilter>(NO_PROGRAMME_FILTER);

  useEffect(() => {
    api.faculties().then((r) => {
      setFaculties(r.faculties);
      // One faculty is the normal case for now: v1 serves UCLouvain and the
      // module launches scoped to EPL, so skip a choice with one option.
      if (r.faculties.length === 1) setFaculty(r.faculties[0]!.code);
    });
  }, []);

  useEffect(() => {
    if (!faculty) return;
    api.programmes(faculty).then((r) => setProgrammes(r.programmes));
  }, [faculty]);

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
        <CourseFilters
          courses={courses}
          reviewCounts={reviewCounts}
          onOpen={onOpen}
          emptyLabel={t("ryc.browse.noneInProgramme")}
        />
      </section>
    );
  }

  return (
    <section>
      {faculties.length > 1 && (
        <label className="picker">
          {t("ryc.browse.faculty")}
          <select value={faculty ?? ""} onChange={(e) => setFaculty(e.target.value || null)}>
            <option value="">{t("ryc.browse.choose")}</option>
            {faculties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

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
          </FilterBar>

          {shown.length === 0 ? (
            <p className="empty">{t("ryc.browse.noMatch")}</p>
          ) : (
            <ul className="results">
              {shown.map((p) => (
                <li key={p.code}>
                  <button type="button" onClick={() => setProgramme(p)}>
                    <span className="code">{p.code.toUpperCase()}</span>
                    <span className="title">{p.title}</span>
                    <span className="facts">
                      {kindLabel(t, p.kind)}
                      {p.credits ? ` [${p.credits}]` : ""}
                      {` · ${t("ryc.browse.courses", { count: p.courses })}`}
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
