/**
 * Navigation, in both directions.
 *
 * Two bugs sat here at once and had the same root: a screen that lives in
 * component state has no address, so it cannot be linked, refreshed, or
 * reached with the Back button, and nothing outside it can send you there.
 *
 *   RYC held its whole position in state. Back left the app entirely.
 *   The app had no route out. Once inside, the public site was unreachable.
 *
 * The second was reported; the first was found looking for the cause of the
 * first, which is the usual way.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LOCALE, I18nProvider, LOCALES, createTranslator } from "@studens/i18n";
import { bundle, activeModuleFor, PublicZone } from "@studens/web";
import { parseView } from "@studens/ryc-ui";

describe("a module owns the path below its own segment", () => {
  it("the shell resolves the module and leaves the rest alone", () => {
    // The shell must not parse "/c/lepl1503": that is RYC's business (FR-B16).
    expect(activeModuleFor("/fr/app/ryc/c/lepl1503")?.id).toBe("ryc");
    expect(activeModuleFor("/fr/app/ryc/c/lepl1503/avis")?.id).toBe("ryc");
  });

  it("every RYC screen has an address", () => {
    expect(parseView("/")).toEqual({ kind: "browse" });
    expect(parseView("")).toEqual({ kind: "browse" });
    expect(parseView("/recherche")).toEqual({ kind: "search" });
    expect(parseView("/c/lepl1503")).toEqual({
      kind: "course",
      code: "lepl1503",
      writing: false,
    });
    expect(parseView("/c/lepl1503/avis")).toEqual({
      kind: "course",
      code: "lepl1503",
      writing: true,
    });
  });

  it("a course code is case insensitive and a trailing slash is harmless", () => {
    // Because these arrive from links people paste, not only from our own code.
    expect(parseView("/c/LEPL1503")).toMatchObject({ code: "lepl1503" });
    expect(parseView("/c/lepl1503/")).toMatchObject({ code: "lepl1503", writing: false });
  });

  it("nonsense below the module falls back to its root rather than breaking", () => {
    expect(parseView("/quelque-chose")).toEqual({ kind: "browse" });
    expect(parseView("/c")).toEqual({ kind: "browse" });
  });

  /**
   * The property the whole change exists for: the review form is a URL, so the
   * Back button steps out of it rather than out of the app, and a half-written
   * review survives a refresh of the page it sits on.
   */
  it("writing a review is a place, not a flag", () => {
    const at = parseView("/c/lepl1503/avis");
    expect(at.kind === "course" && at.writing).toBe(true);
    // And the course underneath it is the same course, so Back has somewhere
    // to land that is not the module root.
    expect(at.kind === "course" && at.code).toBe("lepl1503");
  });
});

describe("the app is no longer one directional", () => {
  it("the shell's strings exist in every language", () => {
    // The app zone was French only until now: the i18n mechanism shipped with
    // the public zone and the app kept its hardcoded strings.
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      for (const key of ["app.home.lede", "app.modules", "app.home.more", "app.back"]) {
        expect(t(key), `${locale}:${key}`).not.toBe(key);
      }
    }
  });

  it("has a string for every destination its footer offers", () => {
    // A missing one renders as a key rather than vanishing, so the link would
    // still be there and would read as a bug on screen.
    const t = createTranslator(bundle, DEFAULT_LOCALE);
    for (const key of ["nav.home", "nav.privacy", "nav.about"]) {
      expect(t(key)).not.toBe(key);
    }
  });

  it("the public zone still renders after the shared controls moved", () => {
    // Guards the refactor that lifted Account and LanguageSwitcher out of the
    // public folder so both zones could use them.
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: DEFAULT_LOCALE,
        bundle,
        children: createElement(PublicZone, { path: "/" }),
      }),
    );
    expect(html).toContain('class="lang"');
    expect(html).toContain('class="account"');
  });
});
