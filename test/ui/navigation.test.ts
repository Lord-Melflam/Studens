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
import { readFileSync } from "node:fs";
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
    // A programme is an address now. It was component state, so it could not be
    // linked to, a refresh lost it, and Back left the app instead of stepping
    // out of the programme.
    expect(parseView("/p/gest2m")).toEqual({ kind: "programme", code: "gest2m" });
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
    expect(parseView("/p/GEST2M")).toMatchObject({ kind: "programme", code: "gest2m" });
    expect(parseView("/p/gest2m/")).toMatchObject({ kind: "programme", code: "gest2m" });
    // `/p` with nothing after it is the list, not a programme with no code.
    expect(parseView("/p")).toEqual({ kind: "browse" });
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

describe("the account panel exists and promises nothing it cannot do", () => {
  it("is a shell screen, not a module", () => {
    // /app/moi resolves to no module: the shell renders it itself. A module
    // claiming that id would simply never mount.
    expect(activeModuleFor("/fr/app/moi")).toBeNull();
  });

  it("has every string it needs, in every language", () => {
    const keys = [
      "settings.title", "settings.account", "settings.domain", "settings.domain.hint",
      "settings.stored", "settings.stored.value", "settings.stored.hint",
      "settings.language", "settings.language.hint",
      "settings.sessions", "settings.sessions.hint", "settings.sessions.this",
      "settings.sessions.other", "settings.sessions.end", "settings.sessions.endthis",
      "settings.profile", "settings.username", "settings.username.hint",
      "settings.save", "settings.saved", "settings.unset",
      "settings.institution", "settings.institution.hint",
      "settings.studies", "settings.studies.hint", "settings.redo",
      "settings.soon", "settings.soon.contributions",
    ];
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      for (const k of keys) expect(t(k), `${locale}:${k}`).not.toBe(k);
    }
  });

  it("says the domain is evidence, never proof of enrolment (FR-A10)", () => {
    // The panel is the one screen that shows the domain on its own, so it is
    // the one most likely to be read as a credential.
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      expect(t("settings.domain.hint").length).toBeGreaterThan(10);
      expect(t("settings.domain.hint")).not.toBe("settings.domain.hint");
    }
  });

  it("what is not built is listed as not built, not mocked up", () => {
    // FR-D28's rule, applied one screen further: a disabled input that looks
    // like a setting is a promise the product has not made.
    const t = createTranslator(bundle, DEFAULT_LOCALE);
    expect(t("settings.soon")).not.toBe("settings.soon");
    expect(t("settings.soon.contributions")).not.toBe("settings.soon.contributions");
  });

  /**
   * The other half of the same rule, and the one that is easy to forget: when
   * something ships, its "not built yet" line has to GO. A panel that still
   * lists a feature the screen above it now offers is wrong in the opposite
   * direction, and it is wrong quietly.
   *
   * The username and the institution shipped with the first run (FR-F6,
   * FR-F13), so their entries must no longer resolve to anything.
   */
  it("nothing that shipped is still listed as missing", () => {
    const panel = readFileSync(
      new URL("../../apps/web/src/Settings.tsx", import.meta.url).pathname,
      "utf8",
    );
    for (const key of ["settings.soon.username", "settings.soon.institution"]) {
      expect(panel, `${key} still renders on a screen that now does the thing`).not.toContain(key);
      for (const locale of LOCALES) {
        // Gone from the catalogues too, so nobody re-adds the line by finding
        // a translation already sitting there waiting for it.
        expect(createTranslator(bundle, locale)(key), `${locale}:${key}`).toBe(key);
      }
    }
  });
});
