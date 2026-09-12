/**
 * RYC's screens, driven by the URL.
 *
 * The module owns everything below `/app/ryc`. The shell hands it the rest of
 * the path and a navigate function and never parses either, which is FR-B18.
 *
 *   /              browse a programme
 *   /recherche     search
 *   /c/:code       one course
 *   /c/:code/avis  writing a review of it
 *
 * It used to hold all of that in component state. That meant the browser Back
 * button left the app instead of stepping back, a course page could not be sent
 * to anyone, and a refresh lost your place. Navigation that does not touch the
 * URL is not navigation.
 */
import { useEffect, useState } from "react";
import type { ModuleProps } from "./index.js";
import { api, type CourseDetail, type CourseSummary } from "./api.js";
import { CoursePage } from "./CoursePage.js";
import { CourseList } from "./CourseList.js";
import { Browse } from "./Browse.js";

/** What the path inside the module means. Parsed in one place. */
export type RycView =
  | { kind: "browse" }
  | { kind: "search" }
  | { kind: "course"; code: string; writing: boolean };

export function parseView(path: string): RycView {
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts[0] === "recherche") return { kind: "search" };
  if (parts[0] === "c" && parts[1]) {
    return { kind: "course", code: parts[1].toLowerCase(), writing: parts[2] === "avis" };
  }
  return { kind: "browse" };
}

export function Ryc({ path, navigate }: ModuleProps) {
  const view = parseView(path);
  const [meta, setMeta] = useState<{ year: number; courses: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.catalogue().then(setMeta).catch(() => setError("le catalogue n'est pas chargé"));
  }, []);

  // The course comes from the URL, so arriving by link, by Back, or by a
  // refresh all load the same thing. Clearing first stops the previous course
  // showing under a new code while the fetch is in flight.
  const code = view.kind === "course" ? view.code : null;
  useEffect(() => {
    if (!code) {
      setCourse(null);
      return;
    }
    let live = true;
    setCourse(null);
    api
      .course(code)
      .then((c) => live && setCourse(c))
      .catch(() => live && setError(`impossible de charger ${code.toUpperCase()}`));
    return () => {
      live = false;
    };
  }, [code]);

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

  if (view.kind === "course") {
    if (error && !course) return <p className="error">{error}</p>;
    if (!course) return <p className="meta">chargement…</p>;
    return (
      <CoursePage
        course={course}
        writing={view.writing}
        onBack={() => navigate("/")}
        onWrite={() => navigate(`/c/${course.code}/avis`)}
        onCloseWriting={() => navigate(`/c/${course.code}`)}
      />
    );
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
          className={view.kind === "browse" ? "on" : ""}
          onClick={() => navigate("/")}
        >
          Parcourir un programme
        </button>
        <button
          type="button"
          className={view.kind === "search" ? "on" : ""}
          onClick={() => navigate("/recherche")}
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

      {view.kind === "search" ? (
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
            <p className="empty">Aucun cours pour « {query} ».</p>
          )}
          <CourseList courses={results} onOpen={(c) => navigate(`/c/${c}`)} />
        </>
      ) : (
        <Browse onOpen={(c) => navigate(`/c/${c}`)} />
      )}
    </>
  );
}
