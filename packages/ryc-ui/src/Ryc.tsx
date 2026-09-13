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
import { useT } from "@studens/i18n";
import type { ModuleProps } from "./index.js";
import { api, type CourseDetail, type CourseSummary } from "./api.js";
import { CoursePage } from "./CoursePage.js";
import { CourseFilters } from "./CourseFilters.js";
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
  const t = useT();
  const view = parseView(path);
  const [meta, setMeta] = useState<{ year: number; courses: number } | null>(null);
  /**
   * How many published reviews each course has, fetched once for the module.
   *
   * Held here rather than in each list so the two screens agree and so browsing
   * between them costs no request. An empty object is a safe answer: every
   * count reads as zero and the "only with reviews" filter simply does not
   * appear, which is correct on a fresh installation.
   */
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.catalogue().then(setMeta).catch(() => setError(t("ryc.err.catalogue")));
    api
      .reviewCounts()
      .then((r) => setReviewCounts(r.counts))
      .catch(() => setReviewCounts({}));
    // Once. `t` is deliberately not a dependency: refetching the catalogue
    // because somebody switched language would be silly, and the only thing it
    // is used for here is the text of an error nobody has seen yet.
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
      .catch(() => live && setError(t("ryc.err.course", { code: code.toUpperCase() })));
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
        .catch(() => setError(t("ryc.err.search")))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  if (view.kind === "course") {
    if (error && !course) return <p className="error">{error}</p>;
    if (!course) return <p className="meta">{t("ryc.loading")}</p>;
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
      <p className="module-intro">{t("ryc.intro")}</p>

      <nav className="tabs">
        <button
          type="button"
          className={view.kind === "browse" ? "on" : ""}
          onClick={() => navigate("/")}
        >
          {t("ryc.tab.browse")}
        </button>
        <button
          type="button"
          className={view.kind === "search" ? "on" : ""}
          onClick={() => navigate("/recherche")}
        >
          {t("ryc.tab.search")}
        </button>
      </nav>

      {meta && (
        <p className="meta">
          {t("ryc.meta", { n: meta.courses, from: meta.year, to: meta.year + 1 })}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {view.kind === "search" ? (
        <>
          <label className="search" htmlFor="q">
            {t("ryc.search.label")}
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ryc.search.placeholder")}
              autoComplete="off"
              autoFocus
            />
          </label>
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="empty">{t("ryc.search.none", { query })}</p>
          )}
          {results.length > 0 && (
            <CourseFilters
              courses={results}
              reviewCounts={reviewCounts}
              onOpen={(c) => navigate(`/c/${c}`)}
              emptyLabel={t("ryc.search.none", { query })}
            />
          )}
        </>
      ) : (
        <Browse onOpen={(c) => navigate(`/c/${c}`)} reviewCounts={reviewCounts} />
      )}
    </>
  );
}
