/**
 * A MISSING WORD MUST NOT BLANK THE PAGE.
 *
 * The provider warned about a missing key by reading `process.env.NODE_ENV`.
 * `process` does not exist in a browser, so the one code path meant to soften a
 * missing string was the path that threw: `ReferenceError: process is not
 * defined`, caught by the error boundary, whole screen replaced by "Something
 * broke". Found on 2026-09-17 by typing in the search box against a dev server
 * whose catalogue had gone stale.
 *
 * Vite does substitute `process.env.NODE_ENV` at build time, but only in that
 * exact spelling, and the code used the bracket form, which survived untouched.
 *
 * So this renders with `process` genuinely deleted, which is what a browser is.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider, useT, type Bundle } from "@studens/i18n";

const bundle = {
  fr: { "a.present": "présent" },
  nl: { "a.present": "aanwezig" },
  en: { "a.present": "present" },
} as unknown as Bundle;

function Screen() {
  const t = useT();
  return createElement("p", null, t("a.missing"));
}

function draw(locale: "fr" | "nl" | "en") {
  return renderToStaticMarkup(
    createElement(I18nProvider, { locale, bundle, children: createElement(Screen) }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("a key that is not in the catalogue", () => {
  it("does not throw when there is no `process`, which is every browser", () => {
    const saved = globalThis.process;
    // @ts-expect-error deleting a global on purpose, to be a browser
    delete globalThis.process;
    try {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(() => draw("en")).not.toThrow();
    } finally {
      globalThis.process = saved;
    }
  });

  it("renders the key itself rather than nothing", () => {
    // A blank space in a page is invisible; a key on screen is a bug report.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(draw("en")).toContain("a.missing");
  });

  it("still warns, because that is the point of the branch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    draw("nl");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("a.missing"));
  });

  it("falls back to French when the key exists there and not in the locale asked for", () => {
    const partial = {
      fr: { "a.only.fr": "seulement en français" },
      nl: {},
      en: {},
    } as unknown as Bundle;
    function Only() {
      const t = useT();
      return createElement("p", null, t("a.only.fr"));
    }
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(
      createElement(I18nProvider, { locale: "en", bundle: partial, children: createElement(Only) }),
    );
    expect(html).toContain("seulement en français");
  });
});
