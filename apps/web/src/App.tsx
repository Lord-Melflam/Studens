/**
 * Studens, first screen.
 *
 * Answers the pass test in docs/requirements.md 1.1: a student searches a
 * course by code and sees what they need in one place. Reviews are not here
 * yet, so this is the catalogue half of FR-D1 to FR-D3.
 *
 * Deliberately not here: any placeholder for a feature that does not exist.
 * An empty ratings panel would suggest the platform does something it cannot.
 */
import { useEffect, useState } from "react";
import { api, type CourseDetail, type CourseSummary } from "./api.js";
import { CoursePage } from "./CoursePage.js";

export function App() {
  const [meta, setMeta] = useState<{ year: number; courses: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.catalogue().then(setMeta).catch(() => setError("the catalogue is not loaded"));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    // Debounced so typing a course code does not fire a request per keystroke.
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .search(query)
        .then((r) => {
          setResults(r.results);
          setError(null);
        })
        .catch(() => setError("search failed"))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  function open(code: string) {
    api
      .course(code)
      .then(setSelected)
      .catch(() => setError(`could not load ${code.toUpperCase()}`));
  }

  return (
    <main>
      <header>
        <h1>Studens</h1>
        <p className="tagline">
          Rate Your Courses. Pour l&apos;instant, le catalogue seulement.
        </p>
      </header>

      <label className="search" htmlFor="q">
        Chercher un cours
        <input
          id="q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="LEPL1503, ou un mot du titre"
          autoComplete="off"
          autoFocus
        />
      </label>

      {meta && (
        <p className="meta">
          {meta.courses} cours, année académique {meta.year}-{meta.year + 1}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {selected ? (
        <CoursePage course={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="empty">
              Aucun cours pour « {query} ». Le catalogue actuel ne couvre qu&apos;un
              échantillon.
            </p>
          )}
          <ul className="results">
            {results.map((c) => (
              <li key={c.code}>
                <button type="button" onClick={() => open(c.code)}>
                  <span className="code">{c.code.toUpperCase()}</span>
                  <span className="title">{c.title}</span>
                  <span className="facts">
                    {c.ects} ECTS
                    {c.quarter ? ` · ${c.quarter}` : ""}
                    {c.external ? " · autre institution" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
