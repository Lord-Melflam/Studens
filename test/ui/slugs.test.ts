/**
 * The route slugs are translated, and the translation survives a round trip
 * (OPEN-49).
 *
 * WHAT THIS IS REALLY GUARDING. The visible half of translated slugs is easy
 * and would be noticed immediately if it broke. The half that breaks quietly
 * is the LANGUAGE SWITCHER: a reader on `/nl/privacy` presses FR and has to
 * arrive at `/fr/confidentialite`. Get it wrong and the URL still changes, the
 * page still renders, and the only symptom is a Dutch word sitting in a French
 * address, which nobody reports.
 *
 * The design that makes it hard to break is canonical-inside: every route in
 * the application is `/privacy`, and the slug exists only in the URL. These
 * tests pin that property rather than the individual words, so renaming a slug
 * is a one line change and dropping the translation is a failure.
 */
import { describe, expect, it } from "vitest";
import { LOCALES, localePath, splitLocale, type Locale } from "@studens/i18n";
import { fromSlugPath, toSlugPath } from "@studens/web";
import { fromSlugPath as rycFrom, toSlugPath as rycTo } from "@studens/ryc-ui";

const PAGES = ["/modules", "/privacy", "/about", "/signin", "/suspended", "/welcome"];

describe("a public route reads in the language of its prefix", () => {
  it("translates the slug and keeps the canonical form recoverable", () => {
    for (const page of PAGES) {
      for (const l of LOCALES) {
        const shown = toSlugPath(page, l);
        expect(fromSlugPath(shown), `${page} in ${l} did not round trip`).toBe(page);
      }
    }
  });

  it("stops showing one language's word to everybody", () => {
    // The defect was a French slug under every prefix, so the property to pin
    // is that French is no longer what an English reader gets. NOT that all
    // three differ: Dutch for "privacy" is "privacy", and inventing a
    // different word to satisfy a test would be worse than the bug.
    // `modules` is the same in all three languages and is excluded.
    for (const page of PAGES.filter((p) => p !== "/modules")) {
      expect(toSlugPath(page, "fr"), `${page} still shows French to English readers`).not.toBe(
        toSlugPath(page, "en"),
      );
    }
  });

  it("never gives two pages the same slug in one language", () => {
    // A collision would make one of them unreachable, and `fromSlugPath` would
    // answer with whichever was defined last.
    for (const l of LOCALES) {
      const slugs = PAGES.map((p) => toSlugPath(p, l));
      expect(new Set(slugs).size, `two pages collide in ${l}: ${slugs.join(", ")}`).toBe(
        PAGES.length,
      );
    }
  });

  it("leaves what follows the page name alone", () => {
    expect(toSlugPath("/welcome/3", "nl")).toBe("/welkom/3");
    expect(fromSlugPath("/welkom/3")).toBe("/welcome/3");
  });

  it("leaves a module's path alone, because it is the module's to translate", () => {
    // FR-B16. `ryc` is an id, and everything below it is the module's own
    // business: if the shell translated in there, it would be holding a list
    // of another package's screens.
    const deep = "/app/ryc/c/uclouvain/lepl1503";
    for (const l of LOCALES) expect(toSlugPath(deep, l)).toBe(deep);
    expect(fromSlugPath(deep)).toBe(deep);
    // Including a segment that happens to be one of the shell's own words.
    const collide = "/app/ryc/privacy";
    for (const l of LOCALES) expect(toSlugPath(collide, l)).toBe(collide);
  });

  it("translates the shell's own reserved screens inside /app", () => {
    expect(toSlugPath("/app/settings", "fr")).toBe("/app/mon-compte");
    expect(toSlugPath("/app/settings", "nl")).toBe("/app/mijn-account");
    expect(toSlugPath("/app/settings", "en")).toBe("/app/my-account");
    expect(toSlugPath("/app/moderation", "nl")).toBe("/app/moderatie");
    for (const page of ["/app/settings", "/app/moderation"]) {
      for (const l of LOCALES) expect(fromSlugPath(toSlugPath(page, l))).toBe(page);
    }
  });

  it("leaves the bare mount point alone", () => {
    for (const l of LOCALES) expect(toSlugPath("/app", l)).toBe("/app");
    expect(fromSlugPath("/app")).toBe("/app");
  });

  it("leaves the root alone", () => {
    for (const l of LOCALES) expect(toSlugPath("/", l)).toBe("/");
    expect(fromSlugPath("/")).toBe("/");
  });

  it("resolves a slug from another language rather than losing the page", () => {
    // A link written before the slugs were translated, or one where somebody
    // edited the prefix by hand. It names a real page and should open it.
    expect(fromSlugPath("/confidentialite")).toBe("/privacy");
    expect(fromSlugPath("/privacy")).toBe("/privacy");
    expect(fromSlugPath("/aanmelden")).toBe("/signin");
  });

  it("passes an unknown path through untouched, so it can fall to the landing page", () => {
    expect(fromSlugPath("/nothing-here")).toBe("/nothing-here");
    for (const l of LOCALES) expect(toSlugPath("/nothing-here", l)).toBe("/nothing-here");
  });
});

describe("the language switcher lands on the same page in the new language", () => {
  /** What `LanguageSwitcher` builds, in the one line that matters. */
  const target = (route: string, l: Locale): string => localePath(toSlugPath(route, l), l);

  it("changes the prefix AND the slug together", () => {
    expect(target("/privacy", "fr")).toBe("/fr/confidentialite");
    expect(target("/privacy", "nl")).toBe("/nl/privacy");
    expect(target("/privacy", "en")).toBe("/en/privacy");
    expect(target("/about", "nl")).toBe("/nl/over-ons");
  });

  it("round trips through the URL, which is what a reader actually does", () => {
    for (const page of PAGES) {
      for (const from of LOCALES) {
        for (const to of LOCALES) {
          const url = target(page, from);
          // Read the URL back the way the router does, then switch language.
          const back = fromSlugPath(splitLocale(url).rest);
          expect(back, `${page}: ${from} -> URL -> canonical`).toBe(page);
          expect(target(back, to)).toBe(target(page, to));
        }
      }
    }
  });
});

describe("a module translates its own slugs, and the shell never learns them", () => {
  const VIEWS = ["/search", "/my-reviews", "/c/uclouvain/lepl1503/review"];

  it("round trips every screen in every language", () => {
    for (const v of VIEWS) {
      for (const l of LOCALES) {
        expect(rycFrom(rycTo(v, l)), `${v} in ${l}`).toBe(v);
      }
    }
  });

  it("translates the writing suffix at the end of a course path", () => {
    expect(rycTo("/c/uclouvain/lepl1503/review", "fr")).toBe("/c/uclouvain/lepl1503/avis");
    expect(rycTo("/c/uclouvain/lepl1503/review", "nl")).toBe(
      "/c/uclouvain/lepl1503/beoordeling",
    );
  });

  it("leaves institution and course codes alone", () => {
    for (const l of LOCALES) {
      expect(rycTo("/c/uclouvain/lepl1503", l)).toBe("/c/uclouvain/lepl1503");
      expect(rycTo("/p/ulb/gest2m", l)).toBe("/p/ulb/gest2m");
    }
  });

  it("carries a query string through untouched", () => {
    expect(rycTo("/search?q=algo&f=q1", "fr")).toBe("/recherche?q=algo&f=q1");
    expect(rycFrom("/recherche?q=algo&f=q1")).toBe("/search?q=algo&f=q1");
  });

  it("does not translate the shell's pages, which are not its business", () => {
    // `privacy` belongs to the shell. A module asked to translate it must not,
    // or two tables would both claim the same word (FR-B16).
    for (const l of LOCALES) expect(rycTo("/privacy", l)).toBe("/privacy");
  });
});
