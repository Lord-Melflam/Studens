/**
 * RYC's screens, driven by the URL.
 *
 * The module owns everything below `/app/ryc`. The shell hands it the rest of
 * the path and a navigate function and never parses either, which is FR-B18.
 *
 *   /              browse the programmes
 *   /p/:code       one programme, and its courses
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
import { queryOf, settingsRoute } from "./urlstate.js";

/**
 * The query key naming the unfolded sections of a course page.
 *
 * Exported because the shape of a URL is a contract: test/ui checks the round
 * trip, and a second spelling of it anywhere is the bug that test exists for.
 */
export const OPEN_KEY = "ouvert";

/**
 * Which page of a course's reviews is on screen.
 *
 * In the address like everything else (FR-B21), so a refresh keeps it, Back
 * leaves the course rather than walking back through it, and page 7 of a long
 * course can be linked to. "Load more" was the alternative and it cannot do
 * any of those: the number of times somebody pressed a button is not a thing a
 * URL can hold.
 */
export const PAGE_KEY = "avis";

/** The page named by an address, 1 when it says nothing or says nonsense. */
export function reviewPageFrom(search: string): number {
  const n = Number.parseInt(queryOf(search).get(PAGE_KEY) ?? "", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** What `?avis=` should say. Page one says nothing, because it is the default. */
export function reviewPageQuery(page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (page > 1) p.set(PAGE_KEY, String(page));
  return p;
}

/** The unfolded sections named by an address, in the order they were given. */
export function openSectionsFrom(search: string): string[] {
  return (queryOf(search).get(OPEN_KEY) ?? "").split(",").filter((x) => x !== "");
}

/**
 * Add a section to the set or take it out.
 *
 * Order is kept as the reader made it rather than sorted, because sorting
 * would rewrite the address on a press that changed nothing about the screen
 * and make two identical states produce two different links.
 */
export function toggleSection(open: readonly string[], slug: string): string[] {
  return open.includes(slug) ? open.filter((x) => x !== slug) : [...open, slug];
}

/** What `?ouvert=` should say for a set of sections, empty when there are none. */
export function openSectionsQuery(open: readonly string[]): URLSearchParams {
  const p = new URLSearchParams();
  if (open.length > 0) p.set(OPEN_KEY, open.join(","));
  return p;
}
import { CoursePage } from "./CoursePage.js";
import { CourseFilters } from "./CourseFilters.js";
import { Browse } from "./Browse.js";

/**
 * What the path inside the module means. Parsed in one place.
 *
 * THE INSTITUTION IS IN THE PATH (OPEN-48, decided 2026-09-18):
 * `/c/uclouvain/lepl1503`, `/p/uclouvain/sinf1ba`. A code is unique inside one
 * catalogue and nothing more, so a bare code in a link is a question with more
 * than one answer the day a second university is loaded, and the reader cannot
 * tell which one they were given.
 *
 * The cost is that links made before today carry no institution. They are not
 * abandoned: `legacyCourse` is what they parse as, and the screen sends them to
 * their real address rather than showing an error about a URL somebody else
 * wrote. It is the only kind that can be ambiguous, and when it is, it says so
 * instead of picking.
 */
export type RycView =
  | { kind: "browse" }
  | { kind: "programme"; institution: string; code: string }
  | { kind: "legacyProgramme"; code: string }
  | { kind: "search" }
  | { kind: "course"; institution: string; code: string; writing: boolean }
  | { kind: "legacyCourse"; code: string; writing: boolean };

export function parseView(path: string): RycView {
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const lower = (i: number): string => (parts[i] ?? "").toLowerCase();
  if (parts[0] === "recherche") return { kind: "search" };
  if (parts[0] === "p" && parts[1] && parts[2]) {
    return { kind: "programme", institution: lower(1), code: lower(2) };
  }
  // `/p/gest2m`: the shape links carried before the institution was in the
  // path. Resolved by Browse against the programme list it already has, so it
  // needs no endpoint of its own.
  if (parts[0] === "p" && parts[1]) return { kind: "legacyProgramme", code: lower(1) };
  if (parts[0] === "c" && parts[1] && parts[2] && parts[2] !== "avis") {
    return {
      kind: "course",
      institution: lower(1),
      code: lower(2),
      writing: parts[3] === "avis",
    };
  }
  // `/c/lepl1503` and `/c/lepl1503/avis`: the shape links carried before the
  // institution was in the path.
  if (parts[0] === "c" && parts[1]) {
    return { kind: "legacyCourse", code: lower(1), writing: parts[2] === "avis" };
  }
  return { kind: "browse" };
}

/** The address of a course, built in one place so no screen guesses at it. */
export function coursePath(institution: string, code: string, writing = false): string {
  return `/c/${institution}/${code}${writing ? "/avis" : ""}`;
}

export function programmePath(institution: string, code: string): string {
  return `/p/${institution}/${code}`;
}

/**
 * The key a course's review count is filed under.
 *
 * Exported and used everywhere rather than written inline, because the server
 * builds the same string and the two silently returning zero is what a mistake
 * here would look like.
 */
export function courseKey(c: { institution: string; code: string }): string {
  return `${c.institution}/${c.code}`;
}

export function Ryc({ path, search, navigate }: ModuleProps) {
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
  /**
   * What was typed in the search box, in the URL like everything else on screen.
   *
   * `q` and not `f`: this is the question put to the server, and `f` narrows
   * what came back. The search screen shows both at once, so they cannot share
   * a letter.
   *
   * Written with `replace` on every keystroke, so typing leaves one history
   * entry rather than one per letter, and Back from a course lands on the
   * search you actually ran.
   */
  const query = queryOf(search).get("q") ?? "";
  const setQuery = (next: string): void => {
    const asked = new URLSearchParams(next === "" ? [] : [["q", next]]);
    navigate(settingsRoute("/recherche", search, ["q"], asked), { replace: true });
  };
  /**
   * WHICH LONG FIELDS OF A COURSE ARE UNFOLDED, from the address.
   *
   * `?ouvert=evaluation,biblio`. Here rather than inside the course page for
   * the same reason `writing` is: the page renders what the URL says and owns
   * none of it, and the one file that knows how to build a course's address is
   * this one.
   *
   * `replace`, like a filter chip. Opening four sections while reading is not
   * four places you have been, and Back should leave the course rather than
   * walk you back through your own unfolding.
   */
  const openSections = openSectionsFrom(search);
  const reviewPage = reviewPageFrom(search);
  const goToReviewPage = (n: number): void => {
    const here = view.kind === "course" ? coursePath(view.institution, view.code) : "/";
    navigate(settingsRoute(here, search, [PAGE_KEY], reviewPageQuery(n)), { replace: true });
  };
  const onToggleSection = (slug: string): void => {
    const here = view.kind === "course" ? coursePath(view.institution, view.code) : "/";
    const next = openSectionsQuery(toggleSection(openSections, slug));
    navigate(settingsRoute(here, search, [OPEN_KEY], next), { replace: true });
  };

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
  const institution = view.kind === "course" ? view.institution : null;
  useEffect(() => {
    if (!code || !institution) {
      setCourse(null);
      return;
    }
    let live = true;
    setCourse(null);
    api
      .course(institution, code)
      .then((c) => live && setCourse(c))
      .catch(() => live && setError(t("ryc.err.course", { code: code.toUpperCase() })));
    return () => {
      live = false;
    };
  }, [code, institution]);

  /**
   * A link written before the institution was in the path.
   *
   * Asks where that code lives and goes there, replacing the history entry so
   * Back does not land on the old address and bounce forward again. Exactly one
   * answer is forwarded; several is a genuinely ambiguous link and is said
   * rather than guessed at, because guessing would send a reader to a course at
   * a university they never asked about.
   */
  const legacyCode = view.kind === "legacyCourse" ? view.code : null;
  const legacyWriting = view.kind === "legacyCourse" && view.writing;
  const [ambiguous, setAmbiguous] = useState<string[] | null>(null);
  useEffect(() => {
    if (!legacyCode) {
      setAmbiguous(null);
      return;
    }
    let live = true;
    api
      .locate(legacyCode)
      .then((r) => {
        if (!live) return;
        if (r.institutions.length === 1) {
          // With the query string, for the same reason as the programme
          // redirect: settings live in the URL (FR-B21) and a forward that
          // drops them answers a shared link with something else.
          const to = `${coursePath(r.institutions[0]!, legacyCode, legacyWriting)}${search}`;
          navigate(to, { replace: true });
          return;
        }
        setAmbiguous(r.institutions);
      })
      .catch(() => live && setAmbiguous([]));
    return () => {
      live = false;
    };
  }, [legacyCode, legacyWriting, search]);

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

  if (view.kind === "legacyCourse") {
    // Still asking, or forwarding. Nothing to say yet.
    if (ambiguous === null) return <p className="meta">{t("ryc.loading")}</p>;
    if (ambiguous.length === 0) {
      return <p className="error">{t("ryc.err.course", { code: view.code.toUpperCase() })}</p>;
    }
    // More than one university publishes this code, and the link does not say
    // which was meant. Offering the choice is the only honest answer.
    return (
      <div className="page-intro">
        <p className="notice">{t("ryc.legacy.ambiguous", { code: view.code.toUpperCase() })}</p>
        <ul className="plain">
          {ambiguous.map((inst) => (
            <li key={inst}>
              <button
                type="button"
                className="linkish"
                onClick={() => navigate(coursePath(inst, view.code, view.writing))}
              >
                {inst.toUpperCase()}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view.kind === "course") {
    if (error && !course) return <p className="error">{error}</p>;
    if (!course) return <p className="meta">{t("ryc.loading")}</p>;
    return (
      <CoursePage
        course={course}
        writing={view.writing}
        open={openSections}
        onToggleSection={onToggleSection}
        reviewPage={reviewPage}
        onReviewPage={goToReviewPage}
        onBack={() => navigate("/")}
        onWrite={() => navigate(coursePath(course.institution, course.code, true))}
        onCloseWriting={() => navigate(coursePath(course.institution, course.code))}
      />
    );
  }

  return (
    <>
      <p className="module-intro">{t("ryc.intro")}</p>

      <nav className="tabs">
        <button
          type="button"
          className={view.kind === "browse" || view.kind === "programme" ? "on" : ""}
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
              onOpen={(c) => navigate(coursePath(c.institution, c.code))}
              emptyLabel={t("ryc.search.none", { query })}
              search={search}
              here="/recherche"
              navigate={navigate}
            />
          )}
        </>
      ) : (
        <Browse
          programme={
            view.kind === "programme" ? { institution: view.institution, code: view.code } : null
          }
          legacyProgramme={view.kind === "legacyProgramme" ? view.code : null}
          onOpenProgramme={(p) => navigate(p === null ? "/" : programmePath(p.institution, p.code))}
          onOpen={(c) => navigate(coursePath(c.institution, c.code))}
          reviewCounts={reviewCounts}
          search={search}
          navigate={navigate}
        />
      )}
    </>
  );
}
