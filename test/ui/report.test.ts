/**
 * The report control, which is the half of Article 16 a person actually meets.
 *
 * ARTICLE 16 ASKS FOR A MECHANISM THAT IS "EASILY ACCESSIBLE AND USER-FRIENDLY".
 * That is a design obligation, not only an endpoint, so these check the things
 * that make it one: it is on the contribution, it works without an account, it
 * says what each category does before the choice is made, and it promises no
 * deadline it has not measured.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider, LOCALES, createTranslator, type Locale } from "@studens/i18n";
import { ReportForm, REPORT_CATEGORIES, REPORT_DETAIL_MIN, rycStrings } from "@studens/ryc-ui";
import { DETAIL_MIN, REPORT_CATEGORIES as SERVER_CATEGORIES } from "@studens/platform";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url).pathname, "utf8");

function draw(children: ReactNode, locale: Locale): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, { locale, bundle: rycStrings, children }),
  );
}

const form = (locale: Locale) =>
  draw(createElement(ReportForm, { targetId: "a-review-id", onClose: () => {} }), locale);

/**
 * The same text as React would have written it.
 *
 * Rendered markup escapes an apostrophe to `&#x27;`, so comparing French copy
 * against the raw catalogue fails on the punctuation rather than on anything
 * that matters. Every earlier test dodged this by matching a class name; here
 * the words are the point, so they are escaped instead.
 */
function asRendered(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

describe("the browser offers what the server accepts", () => {
  it("has the same categories", () => {
    // A category the server refuses would be a control that cannot work; one it
    // accepts and the form omits is a report nobody can file.
    expect([...REPORT_CATEGORIES]).toEqual([...SERVER_CATEGORIES]);
  });

  it("states the same minimum explanation", () => {
    expect(REPORT_DETAIL_MIN).toBe(DETAIL_MIN);
  });
});

describe("the form says what it is doing", () => {
  for (const locale of LOCALES) {
    const t = createTranslator(rycStrings, locale);

    it(`names every category and explains it [${locale}]`, () => {
      const html = form(locale);
      for (const c of REPORT_CATEGORIES) {
        expect(html, `${locale}:${c}`).toContain(asRendered(t(`ryc.report.cat.${c}`)));
        expect(t(`ryc.report.cat.${c}.hint`), `${locale}:${c}.hint`).not.toBe(
          `ryc.report.cat.${c}.hint`,
        );
      }
    });

    /**
     * FR-E11: two of the five hide the review the moment the notice arrives.
     * Somebody choosing between "illegal" and "inaccurate" has to know that,
     * both so they use the first when it applies and so they do not when it
     * does not. Hiding it would make the strong option look free.
     */
    it(`warns that two categories hide the review at once [${locale}]`, () => {
      expect(form(locale)).toContain(asRendered(t("ryc.report.cat.immediate")));
    });

    /**
     * FR-E13. The standard is acting expeditiously once we know, which names no
     * number. Naming one here would create an obligation the law did not
     * impose, and a missed promise is evidence against us at the moment
     * somebody is complaining.
     */
    it(`promises no deadline it has not measured [${locale}]`, () => {
      const html = form(locale);
      expect(html).not.toMatch(/\b(24|48|72)\s*(h|hours?|heures?|uur|uren)\b/i);
      expect(html).not.toMatch(/\bwithin \d+|\bdans les \d+|\bbinnen \d+/i);
    });

    it(`leaves no untranslated key [${locale}]`, () => {
      expect(form(locale)).not.toMatch(/ryc\.[a-z0-9.]+/);
    });
  }
});

describe("the mechanism is reachable by anyone (FR-E8, Article 16)", () => {
  const reviews = read("packages/ryc-ui/src/Reviews.tsx");
  const reportForm = read("packages/ryc-ui/src/ReportForm.tsx");
  const route = read("apps/api/src/routes/reports.ts");

  it("the control sits on the contribution, not behind a contact page", () => {
    expect(reviews).toContain("ReportForm");
    expect(reviews).toContain("ryc.report.open");
  });

  /**
   * Article 16 says "any individual or entity". The person most likely to
   * notice that a review names them is the lecturer it names, who has no
   * reason to hold an account here.
   */
  it("the endpoint does not require a session", () => {
    // `identifyIfAny` answers "nobody" rather than refusing, and nothing in the
    // handler turns a missing session into a 401.
    expect(route).toContain("identifyIfAny");
    expect(route).not.toMatch(/sign in required/);
  });

  it("asks for a real explanation rather than a category alone", () => {
    // Article 16(2)(a) wants a substantiated explanation.
    expect(reportForm).toContain("ryc.report.detail");
    expect(REPORT_DETAIL_MIN).toBeGreaterThan(10);
  });

  /**
   * Article 16(2)(c) and 16(4): an address is optional, and it is the only way
   * somebody without an account can be told what was decided. Asking for it
   * without saying why is how a form gets abandoned.
   */
  it("asks for a contact address as optional, and says what it is for", () => {
    const t = createTranslator(rycStrings, "fr");
    expect(t("ryc.report.contact.hint")).not.toBe("ryc.report.contact.hint");
    expect(form("fr")).toContain(asRendered(t("ryc.report.contact.hint")));
  });

  /**
   * The control keeps its place in the layout and in the tab order. Hiding it
   * behind a hover would make it unreachable by keyboard, which is the opposite
   * of what "easily accessible" asks for.
   */
  it("the control is dimmed rather than hidden", () => {
    const css = read("packages/ryc-ui/src/ryc.css");
    const block = /\.report-link \{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(block).not.toMatch(/display:\s*none/);
    expect(block).not.toMatch(/visibility:\s*hidden/);
    expect(css).toContain(".report-link:focus-visible");
  });
});

describe("nothing here claims a removal (FR-E10)", () => {
  it("the form never says the review will be deleted", () => {
    // Removal is always a human act. A form promising it would be both untrue
    // and an invitation to use reports as a deletion button.
    for (const locale of LOCALES) {
      const t = createTranslator(rycStrings, locale);
      for (const key of ["ryc.report.sent.held", "ryc.report.sent.queued", "ryc.report.lede"]) {
        const text = t(key).toLowerCase();
        for (const word of ["supprim", "verwijder", "delete", "removed"]) {
          expect(text, `${locale}:${key} promises a removal`).not.toContain(word);
        }
      }
    }
  });

  it("says a person reads it, since nothing is automatic", () => {
    const t = createTranslator(rycStrings, "fr");
    expect(t("ryc.report.lede")).toMatch(/personne|jamais trait/i);
  });
});
