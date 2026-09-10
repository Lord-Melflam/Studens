/**
 * RYC's screen: search or browse, then a course page.
 *
 * The module owns this. The shell mounts it and knows nothing about courses,
 * which is FR-B18.
 */
import { useEffect, useState } from "react";
import { api, type CourseDetail, type CourseSummary } from "./api.js";
import { CoursePage } from "./CoursePage.js";
import { CourseList } from "./CourseList.js";
import { Browse } from "./Browse.js";

type Tab = "browse" | "search";

export function Ryc() {
  const [meta, setMeta] = useState<{ year: number; courses: number } | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.catalogue().then(setMeta).catch(() => setError("le catalogue n'est pas chargé"));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .search(query)
        .then((r) => {
          setResults(r.results);
          setError(null);
        })
        .catch(() => setError("la recherche a échoué"))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  function open(code: string) {
    api
      .course(code)
      .then(setSelected)
      .catch(() => setError(`impossible de charger ${code.toUpperCase()}`));
  }

  if (selected) {
    return <CoursePage course={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <p className="module-intro">
        Ce que valent vraiment les cours, d&apos;après les étudiants qui les ont
        suivis. Parcourez un programme, ou cherchez un cours par son code.
      </p>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "browse" ? "on" : ""}
          onClick={() => setTab("browse")}
        >
          Parcourir un programme
        </button>
        <button
          type="button"
          className={tab === "search" ? "on" : ""}
          onClick={() => setTab("search")}
        >
          Chercher
        </button>
      </nav>

      {meta && (
        <p className="meta">
          {meta.courses} cours, année académique {meta.year}-{meta.year + 1}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {tab === "search" ? (
        <>
          <label className="search" htmlFor="q">
            Code ou mot du titre
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="LEPL1503, ou « mécanique »"
              autoComplete="off"
              autoFocus
            />
          </label>
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="empty">
              Aucun cours pour « {query} ».
            </p>
          )}
          <CourseList courses={results} onOpen={open} />
        </>
      ) : (
        <Browse onOpen={open} />
      )}
    </>
  );
}
