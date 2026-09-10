/**
 * Browsing by programme (FR-D24, FR-D25).
 *
 * This exists because search only helps a student who already knows the code,
 * and 1.1's problem is choosing electives blind, which is a discovery problem.
 * See docs/requirements.md 3.4.
 */
import { useEffect, useState } from "react";
import { api, type CourseSummary, type FacultySummary, type ProgrammeSummary } from "./api.js";
import { CourseList } from "./CourseList.js";

export function Browse({ onOpen }: { onOpen: (code: string) => void }) {
  const [faculties, setFaculties] = useState<FacultySummary[]>([]);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [programme, setProgramme] = useState<ProgrammeSummary | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);

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

  if (programme) {
    return (
      <section>
        <button type="button" className="back" onClick={() => setProgramme(null)}>
          retour aux programmes
        </button>
        <h2 className="browse-title">{programme.title}</h2>
        <p className="meta">
          {courses.length} cours dans le catalogue pour ce programme
        </p>
        <CourseList courses={courses} onOpen={onOpen} />
      </section>
    );
  }

  return (
    <section>
      {faculties.length > 1 && (
        <label className="picker">
          Faculté
          <select value={faculty ?? ""} onChange={(e) => setFaculty(e.target.value || null)}>
            <option value="">choisir</option>
            {faculties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {programmes.length === 0 ? (
        <p className="meta">Aucun programme chargé pour cette faculté.</p>
      ) : (
        <>
          <p className="meta">{programmes.length} programmes</p>
          <ul className="results">
            {programmes.map((p) => (
              <li key={p.code}>
                <button type="button" onClick={() => setProgramme(p)}>
                  <span className="code">{p.code.toUpperCase()}</span>
                  <span className="title">{p.title}</span>
                  <span className="facts">{p.courses} cours</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
