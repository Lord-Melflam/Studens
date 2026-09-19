/**
 * A SCREEN'S SETTINGS LIVE IN THE URL.
 *
 * Reported by François: "when I select filters then go to a course, when I go
 * back I lose the filters I've selected." The filters were component state, so
 * the component unmounting took them with it.
 *
 * Three things fail when a setting is held in state, and only the first is
 * obvious. Back cannot restore what was never written down. A refresh cannot
 * either. And a link to a filtered list shows its reader a different list,
 * which fails silently: the link works.
 *
 * What is checked here is the round trip, because that is the part no browser
 * test would catch cheaply: a filter that encodes and decodes to something
 * else is a link that lies. The writing half is one function, `settingsRoute`,
 * and it is checked directly rather than through a rendered click.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LOCALE, I18nProvider } from "@studens/i18n";
import {
  CourseFilters,
  COURSE_FILTER_KEYS,
  NO_COURSE_FILTER,
  OPEN_KEY,
  PAGE_KEY,
  NO_PROGRAMME_FILTER,
  PROGRAMME_FILTER_KEYS,
  UNSTATED,
  courseFilterFromQuery,
  courseFilterToQuery,
  openSectionsFrom,
  openSectionsQuery,
  reviewPageFrom,
  reviewPageQuery,
  programmeFilterFromQuery,
  programmeFilterToQuery,
  pruneCourseFilter,
  pruneProgrammeFilter,
  queryOf,
  replaceKeys,
  toggleSection,
  settingsRoute,
  withQuery,
  type CourseFilter,
  type CourseSummary,
  type ProgrammeFilter,
  type ProgrammeSummary,
} from "@studens/ryc-ui";
import { bundle, moduleRoute, navigationTarget, splitQuery } from "@studens/web";

const course = (o: Partial<CourseSummary>): CourseSummary => ({
  institution: "uclouvain",
  code: "lepl1503",
  title: "Projet 3",
  year: 2026,
  offeredThisYear: true,
  ects: 5,
  quarter: "Q2",
  teachers: [],
  external: false,
  mainLanguage: "Français",
  owningEntity: "BTCI",
  campuses: [],
  ...o,
});

const programme = (o: Partial<ProgrammeSummary>): ProgrammeSummary => ({
  institution: "uclouvain",
  code: "sinf1ba",
  title: "Bachelier en sciences informatiques",
  faculty: "epl",
  facultyName: "Ecole polytechnique de Louvain",
  courses: 46,
  kind: "bachelier",
  credits: 180,
  site: "Louvain-la-Neuve",
  domain: "Sciences",
  officialUrl: "https://uclouvain.be/prog-2026-sinf1ba",
  ...o,
});

describe("a filter survives the address bar", () => {
  it("an empty filter writes no query string at all", () => {
    // A clean list has a clean URL. Otherwise every link carries the shape of
    // a filter nobody set, and "did I filter this?" has no visible answer.
    expect(courseFilterToQuery(NO_COURSE_FILTER).toString()).toBe("");
    expect(programmeFilterToQuery(NO_PROGRAMME_FILTER).toString()).toBe("");
    expect(withQuery("/p/sinf1ba", courseFilterToQuery(NO_COURSE_FILTER))).toBe("/p/sinf1ba");
  });

  it("a course filter comes back exactly as it went in", () => {
    const f: CourseFilter = {
      text: "algo",
      quarters: ["Q1", "Q2"],
      languages: ["Français"],
      ects: [5, null],
      entities: ["BTCI"],
      campuses: ["Solbosch"],
      reviewedOnly: true,
    };
    expect(courseFilterFromQuery(courseFilterToQuery(f))).toEqual(f);
  });

  it("a programme filter comes back exactly as it went in", () => {
    const f: ProgrammeFilter = {
      text: "info",
      kinds: ["bachelier", null],
      sites: ["Louvain-la-Neuve"],
      faculties: ["epl"],
      domains: ["Sciences"],
      institutions: ["uclouvain"],
    };
    expect(programmeFilterFromQuery(programmeFilterToQuery(f))).toEqual(f);
  });

  it("'the page does not state it' is a value, not the absence of one", () => {
    // Null is a real group in three dimensions: a course whose page publishes
    // no credits, a programme whose kind nothing matched. Encoding it as an
    // absent parameter would make "unstated only" indistinguishable from "no
    // filter", which is the one pair that must not collapse.
    const q = courseFilterToQuery({ ...NO_COURSE_FILTER, ects: [null] });
    expect(q.getAll("credits")).toEqual([UNSTATED]);
    expect(courseFilterFromQuery(q).ects).toEqual([null]);
  });

  it("a value with a comma in it survives, because the list is not comma-joined", () => {
    const f = { ...NO_PROGRAMME_FILTER, sites: ["Bruxelles Woluwe, site A"] };
    expect(programmeFilterFromQuery(programmeFilterToQuery(f)).sites).toEqual([
      "Bruxelles Woluwe, site A",
    ]);
  });

  it("a hand-edited credit value that is not a number is dropped", () => {
    // Kept, it would match nothing and could not be unclicked, because a chip
    // is only drawn for a value the data has.
    const f = courseFilterFromQuery(new URLSearchParams("credits=cinq&credits=5"));
    expect(f.ects).toEqual([5]);
  });
});

describe("a link outlives the catalogue it was made from", () => {
  it("drops a chosen value nothing in the list has any more", () => {
    // The point of a shareable link is that it is opened later, and later the
    // catalogue has been crawled again. A faculty renamed between the two
    // would otherwise empty the screen with no chip left to press.
    const courses = [course({ quarter: "Q2", mainLanguage: "Français" })];
    const stale = courseFilterFromQuery(new URLSearchParams("quad=Q1&quad=Q2&langue=Zzz"));
    expect(pruneCourseFilter(stale, courses)).toMatchObject({
      quarters: ["Q2"],
      languages: [],
    });
  });

  it("keeps everything while the list has not arrived yet", () => {
    // An empty array here means "not loaded", not "nothing matches". Pruning
    // against it would wipe the filter on the first render, every time.
    const f = courseFilterFromQuery(new URLSearchParams("quad=Q1"));
    expect(pruneCourseFilter(f, []).quarters).toEqual(["Q1"]);
  });

  it("prunes programmes the same way, including the unstated group", () => {
    const list = [programme({ kind: null, faculty: "epl" })];
    const stale = programmeFilterFromQuery(new URLSearchParams(`type=${UNSTATED}&fac=lsm`));
    expect(pruneProgrammeFilter(stale, list)).toMatchObject({ kinds: [null], faculties: [] });
  });
});

describe("one screen's settings do not erase another's", () => {
  it("filtering search results keeps the search that produced them", () => {
    // `q` asks the server a question, `f` narrows what came back, and the
    // search screen shows both. Writing the filter as a whole new query string
    // would drop `q` and empty the list the filter was narrowing.
    const route = settingsRoute(
      "/recherche",
      "?q=algo",
      COURSE_FILTER_KEYS,
      courseFilterToQuery({ ...NO_COURSE_FILTER, quarters: ["Q2"] }),
    );
    const params = queryOf(splitQuery(route).search);
    expect(params.get("q")).toBe("algo");
    expect(params.getAll("quad")).toEqual(["Q2"]);
  });

  it("clearing a filter removes only its own parameters", () => {
    const route = settingsRoute("/recherche", "?q=algo&quad=Q2", COURSE_FILTER_KEYS, new URLSearchParams());
    expect(route).toBe("/recherche?q=algo");
  });

  it("replaceKeys leaves a parameter it was not given", () => {
    const out = replaceKeys(
      new URLSearchParams("q=algo&fac=epl"),
      PROGRAMME_FILTER_KEYS,
      new URLSearchParams("fac=lsm"),
    );
    expect(out.get("q")).toBe("algo");
    expect(out.getAll("fac")).toEqual(["lsm"]);
  });
});

describe("the shell carries a query string it may not read", () => {
  it("splits a route into a path and a query, and neither touches the other", () => {
    expect(splitQuery("/p/sinf1ba?f=algo")).toEqual({ path: "/p/sinf1ba", search: "?f=algo" });
    expect(splitQuery("/p/sinf1ba")).toEqual({ path: "/p/sinf1ba", search: "" });
  });

  it("the language goes in front of the path, never in front of the query", () => {
    // `localePath` and `splitLocale` both work on paths and both trim the end
    // of what they are given. Handed a whole URL they would put the prefix in
    // front of a query string and trim the wrong thing off it.
    expect(navigationTarget("/app/ryc/p/sinf1ba?f=algo", "en")).toBe(
      "/en/app/ryc/p/sinf1ba?f=algo",
    );
    expect(navigationTarget("/app/ryc", "nl")).toBe("/nl/app/ryc");
    expect(navigationTarget("/?f=algo", "fr")).toBe("/fr?f=algo");
  });

  it("the module root with a filter on it does not grow a trailing slash", () => {
    // `/?f=algo` is the module's root, filtered. Joined naively it becomes
    // `/app/ryc/?f=algo`, a path that no longer equals where the module is
    // mounted, so the module would not render.
    expect(moduleRoute("/app/ryc", "/?f=algo")).toBe("/app/ryc?f=algo");
    expect(moduleRoute("/app/ryc", "/")).toBe("/app/ryc");
    expect(moduleRoute("/app/ryc", "/c/lepl1503")).toBe("/app/ryc/c/lepl1503");
  });
});

describe("changing a setting is not going somewhere", () => {
  it("every filter write replaces the history entry rather than pushing one", () => {
    // Pushing would make Back walk backwards through the visitor's own
    // filtering instead of leaving the screen, which is worse than the bug
    // this change fixes. Read from the source because the alternative is a
    // browser, and this is the one property a reviewer must not have to infer.
    for (const file of [
      "packages/ryc-ui/src/CourseFilters.tsx",
      "packages/ryc-ui/src/Browse.tsx",
      "packages/ryc-ui/src/Ryc.tsx",
    ]) {
      const text = readFileSync(new URL(`../../${file}`, import.meta.url).pathname, "utf8");
      const calls = text.split("settingsRoute(").slice(1);
      expect(calls.length, `${file} should write settings through settingsRoute`).toBeGreaterThan(0);
      // PAIRED, not counted. It used to compare the number of `settingsRoute`
      // calls against the number of `replace: true` occurrences, which says
      // the right thing only while every replace in the file is a settings
      // write. A legacy link forwarding itself replaces too, and is not a
      // setting, so the count went to two and an honest file failed.
      for (const [i, after] of calls.entries()) {
        expect(
          after.slice(0, 200),
          `${file}: settingsRoute call ${i + 1} is not paired with replace: true`,
        ).toContain("replace: true");
      }
    }
  });
});

describe("what is on screen is what is in the URL", () => {
  /**
   * The codec tests above prove the round trip. They do not prove the
   * component uses it, and a component keeping its own copy beside the URL is
   * exactly the bug this change removes.
   */
  const draw = (search: string): string =>
    renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: DEFAULT_LOCALE,
        bundle,
        children: createElement(CourseFilters, {
          courses: [
            course({ code: "lepl1503", quarter: "Q2" }),
            course({ code: "lepl1402", title: "Informatique 2", quarter: "Q1" }),
          ],
          reviewCounts: {},
          onOpen: () => {},
          emptyLabel: "none",
          search,
          here: "/p/sinf1ba",
          navigate: () => {},
        }),
      }),
    );

  it("a chip named in the query renders pressed", () => {
    expect(draw("?quad=Q1")).toContain('aria-pressed="true"');
    expect(draw("")).not.toContain('aria-pressed="true"');
  });

  it("the list is narrowed by the query, with no click involved", () => {
    const one = draw("?quad=Q1");
    expect(one).toContain("LEPL1402");
    expect(one).not.toContain("LEPL1503");
    expect(draw("")).toContain("LEPL1503");
  });

  it("the text box shows what the query says", () => {
    expect(draw("?f=informatique")).toContain('value="informatique"');
  });
});

describe("what is not published does not go in the address", () => {
  /**
   * The second half of FR-B21, and the half that is a guarantee rather than a
   * convenience. A URL is read by browser history, by the back button's list,
   * by whatever syncs bookmarks and by anybody who can see the screen. FR-C9
   * makes an anonymous contribution unlinkable to its author inside our
   * database; none of those four is inside our database.
   *
   * So the rule is not "be careful with the review form", it is that the form
   * may not touch the address bar at all. Checked as text because the failure
   * would be somebody adding a draft-restoring convenience later, and a
   * convenience is added by writing a line, not by changing a behaviour a test
   * already watches.
   */
  for (const file of [
    "packages/ryc-ui/src/ReviewForm.tsx",
    "packages/ryc-ui/src/SubmitFlow.tsx",
    "packages/ryc-ui/src/PathChoice.tsx",
  ]) {
    it(`${file} never reads or writes the URL`, () => {
      const text = readFileSync(new URL(`../../${file}`, import.meta.url).pathname, "utf8");
      for (const forbidden of ["window.location", "URLSearchParams", "settingsRoute", "queryOf"]) {
        expect(text, `a draft must never reach the address bar`).not.toContain(forbidden);
      }
    });
  }
});

describe("the address wins over the member's own preference", () => {
  /**
   * RYC defaults its university filter to the catalogues a member asked for,
   * which is what François wanted: the catalogue follows the university chosen
   * at registration, and a control widens it.
   *
   * The rule that makes that safe is the ORDER. A link that names institutions
   * shows those; only a link that names none falls back to the profile. Doing
   * it the other way, or writing the preference into the URL on arrival, would
   * break the property FR-B21 exists for: a shared link must show its reader
   * the list it names, not the list their own account would have produced.
   *
   * Checked against the source, because the alternative is a browser with two
   * different signed-in members in it.
   */
  const browse = readFileSync(
    new URL("../../packages/ryc-ui/src/Browse.tsx", import.meta.url).pathname,
    "utf8",
  );

  it("scopes the catalogue to the member before any filter is applied", () => {
    // The preference used to be a fallback INSIDE the filter, which put it in
    // two places at once. François rejected the shape it produced: a chip
    // preselected inside a list of every institution, which treats all of them
    // as the default and yours as a narrowing, and which is a wall at ten.
    //
    // The scope owns it now. Every count below is computed inside it, so the
    // panel says 690 rather than 976 with one chip lit, and the filter is back
    // to being purely what the address asked for.
    expect(browse).toContain("const inScope");
    expect(browse).toContain("applyProgrammeFilter(inScope, filter)");
    expect(browse).toContain("programmeFacets(inScope, filter)");
  });

  it("never writes the preference into the address", () => {
    // `settingsRoute` is how this screen writes the URL. The preference must
    // not travel through it, or arriving on somebody's link would quietly
    // rewrite what they sent.
    const writes = browse.split("settingsRoute(").slice(1);
    for (const after of writes) {
      expect(after.slice(0, 160)).not.toContain("mine");
    }
  });

  it("tells 'not answered' apart from 'answered, everything'", () => {
    // null and [] are different states: nobody has told us, against told us
    // and the answer is no narrowing. Collapsed into one, a signed-out visitor
    // would be narrowed to nothing or a member's choice would be ignored.
    //
    // The state is declared in Ryc, which owns it, and read in Browse. It used
    // to live in Browse alone, and the line above the tabs, which is drawn
    // outside Browse, therefore reported the whole catalogue whatever was
    // selected.
    const ryc = readFileSync(
      new URL("../../packages/ryc-ui/src/Ryc.tsx", import.meta.url).pathname,
      "utf8",
    );
    expect(ryc).toContain("useState<string[] | null>(null)");
    expect(browse).toContain("mine === null");
    expect(ryc).toContain("mine === null");
  });
});


/**
 * WHICH SECTIONS OF A COURSE ARE UNFOLDED TRAVELS IN THE ADDRESS.
 *
 * It was component state for a day. That lost it on every refresh, and it
 * meant there was no way to send somebody the bibliography of a course rather
 * than the course, which is the same three failures this file opens with,
 * one screen further in.
 */
describe("the unfolded sections of a course page", () => {
  it("reads an empty address as nothing open", () => {
    // Not one empty string. `"".split(",")` gives `[""]`, and that would open
    // a section whose slug is the empty string, which is every `includes`
    // check on the page answering wrongly.
    expect(openSectionsFrom("")).toEqual([]);
    expect(openSectionsFrom("?ouvert=")).toEqual([]);
    expect(openSectionsFrom("?f=info")).toEqual([]);
  });

  it("round trips a set of sections", () => {
    for (const open of [["evaluation"], ["evaluation", "biblio"], []]) {
      const back = openSectionsFrom(`?${openSectionsQuery(open).toString()}`);
      expect(back).toEqual(open);
    }
  });

  it("says nothing at all when nothing is open", () => {
    // A trailing `?ouvert=` on every course link would be noise in a URL that
    // is read by people.
    expect(openSectionsQuery([]).toString()).toBe("");
  });

  it("keeps the reader's order rather than sorting", () => {
    // Sorting would rewrite the address on a press that changed nothing about
    // the screen, so two identical screens would produce two different links.
    expect(toggleSection(["biblio"], "evaluation")).toEqual(["biblio", "evaluation"]);
  });

  it("closes one that is already open", () => {
    expect(toggleSection(["biblio", "evaluation"], "biblio")).toEqual(["evaluation"]);
  });

  it("leaves the rest of the query alone", () => {
    // The course page carries `avis` and anything a screen behind it added.
    const route = settingsRoute("/c/ulb/proj-p5314", "?q=archi", [OPEN_KEY], openSectionsQuery(["biblio"]));
    expect(route).toContain("q=archi");
    expect(route).toContain("ouvert=biblio");
  });
});

/**
 * WHICH PAGE OF THE REVIEWS IS ALSO IN THE ADDRESS.
 *
 * Reviews are paged rather than scrolled forever, and the page is a setting
 * like the filters: a refresh keeps it, Back leaves the course, and page 7 of
 * a long course can be linked to. "Load more" was the alternative and cannot
 * do any of those, because the number of times somebody pressed a button is
 * not a thing a URL can hold.
 */
describe("the page of reviews on screen", () => {
  it("is 1 when the address says nothing", () => {
    expect(reviewPageFrom("")).toBe(1);
    expect(reviewPageFrom("?f=info")).toBe(1);
  });

  it("is 1 when the address says nonsense, rather than NaN", () => {
    // It arrives from a URL somebody may have edited by hand.
    for (const q of ["?avis=", "?avis=abc", "?avis=0", "?avis=-3", "?avis=1"]) {
      expect(reviewPageFrom(q)).toBe(1);
    }
  });

  it("round trips a page", () => {
    for (const page of [2, 7, 130]) {
      expect(reviewPageFrom(`?${reviewPageQuery(page).toString()}`)).toBe(page);
    }
  });

  it("says nothing for page one, because that is the default", () => {
    expect(reviewPageQuery(1).toString()).toBe("");
  });

  it("does not disturb the folded sections, and they do not disturb it", () => {
    // The two settings live on the same screen and own different keys.
    const withBoth = settingsRoute("/c/ulb/proj-p5314", "?ouvert=biblio", [PAGE_KEY], reviewPageQuery(3));
    expect(withBoth).toContain("ouvert=biblio");
    expect(withBoth).toContain("avis=3");
    expect(openSectionsFrom("?ouvert=biblio&avis=3")).toEqual(["biblio"]);
    expect(reviewPageFrom("?ouvert=biblio&avis=3")).toBe(3);
  });
});
