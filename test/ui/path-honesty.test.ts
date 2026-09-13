/**
 * The fork may not promise what does not exist, in any language.
 *
 * This is the one screen where somebody makes a permanent, unprovable choice
 * (FR-C9) by reading two lists side by side. A claim on either list that is not
 * true today does not merely mislead: it biases the decision toward the branch
 * making it, and the bias runs toward the branch that is NOT anonymous.
 *
 * The named card used to offer three of them, all specified and none built:
 * editing an attributed review (FR-C14), "Mes avis" (FR-D12), and deletion on
 * request. A comment saying "do not do this" is not a mechanism, and LESSONS.md
 * section 9 records what happens to rules without one. This is the mechanism.
 *
 * EVERY ASSERTION RUNS IN EVERY LANGUAGE. Until 2026-09-13 this screen existed
 * only in French, so the test could match French sentences in the rendered
 * output and be complete. Now the screen is translated, and a promise that is
 * honest in French and wrong in Dutch is exactly as damaging: the person
 * reading the Dutch is the one making the permanent choice.
 *
 * WHEN FR-C14 AND FR-D12 SHIP, this test is updated in the same change that
 * ships them, and not before. That coupling is the point.
 */
import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider, LOCALES, createTranslator, type Locale } from "@studens/i18n";
import { AnonymousConfirm, PathChoice, Steps, rycStrings } from "@studens/ryc-ui";

const ctx = { course: "lepl1503", named: 11, anonymous: 0, quotaRemaining: 4 };
const draft = {
  academicYear: 2024,
  recommendation: 4,
  workloadVsEcts: 3,
  difficulty: 3,
  body: "x".repeat(120),
  completed: true,
};
const noop = () => undefined;

function draw(children: ReactNode, locale: Locale): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, { locale, bundle: rycStrings, children }),
  );
}

const fork = (locale: Locale): string =>
  draw(
    createElement(PathChoice, {
      ctx,
      draft,
      onNamed: noop,
      onAnonymous: noop,
      onBack: noop,
      busy: false,
    }),
    locale,
  );

const confirm = (locale: Locale): string =>
  draw(
    createElement(AnonymousConfirm, { ctx, draft, onConfirm: noop, onBack: noop, busy: false }),
    locale,
  );

/** Just the two decision cards, which is where a claim does the damage. */
function cards(html: string): string {
  const start = html.indexOf('class="fork-cards"');
  const end = html.indexOf('class="fork-note"');
  expect(start, "the fork's cards should be findable").toBeGreaterThan(-1);
  return html.slice(start, end === -1 ? undefined : end);
}

/**
 * Capabilities that are specified and NOT built, per language, as they would be
 * worded if somebody added them to a card.
 */
const NOT_BUILT: Record<Locale, Array<{ phrase: string; requirement: string }>> = {
  fr: [
    { phrase: "Mes avis", requirement: "FR-D12" },
    { phrase: "modifier plus tard", requirement: "FR-C14" },
    { phrase: "demander sa suppression", requirement: "FR-C14" },
    { phrase: "modifier votre avis", requirement: "FR-C14" },
  ],
  nl: [
    { phrase: "Mijn beoordelingen", requirement: "FR-D12" },
    { phrase: "later aanpassen", requirement: "FR-C14" },
    { phrase: "verwijdering vragen", requirement: "FR-C14" },
  ],
  en: [
    { phrase: "My reviews", requirement: "FR-D12" },
    { phrase: "edit it later", requirement: "FR-C14" },
    { phrase: "request its deletion", requirement: "FR-C14" },
    { phrase: "edit your review", requirement: "FR-C14" },
  ],
};

describe("the decision cards claim only what is true today", () => {
  for (const locale of LOCALES) {
    const t = createTranslator(rycStrings, locale);

    it(`offers no unbuilt capability as a reason to choose a branch [${locale}]`, () => {
      const html = cards(fork(locale));
      for (const { phrase, requirement } of NOT_BUILT[locale]) {
        expect(
          html,
          `the fork's cards mention "${phrase}". ${requirement} is specified and ` +
            `not built, and this is the screen where the choice becomes permanent.`,
        ).not.toContain(phrase);
      }
    });

    it(`states the one thing that is permanently true, on the anonymous card [${locale}]`, () => {
      // The asymmetry is real and must stay stated: FR-C9 is not a missing
      // feature, it is a structural consequence that will never change.
      expect(cards(fork(locale))).toContain(t("ryc.fork.anon.2"));
    });

    it(`mentions the planned edit once, below both cards, not inside either [${locale}]`, () => {
      const html = fork(locale);
      const note = t("ryc.fork.note");
      expect(note, "the footnote must exist in this language").not.toBe("ryc.fork.note");
      // Rendered text escapes apostrophes, so match on a distinctive run of
      // plain words rather than the whole sentence.
      const probe = note.split(/[.:]/)[0]!.split(" ").slice(-3).join(" ");
      expect(html).toContain(probe);
      expect(cards(html)).not.toContain(probe);
    });

    it(`shows the counts FR-C21 requires before the choice [${locale}]`, () => {
      const html = fork(locale);
      expect(html).toContain(t("ryc.counts.named", { count: 11 }));
      expect(html).toContain(t("ryc.counts.anon", { count: 0 }));
    });

    it(`puts the draft back in view, so the choice is not made blind [${locale}]`, () => {
      expect(fork(locale)).toContain(t("ryc.draft.reread"));
    });

    it(`leaves no untranslated key on the fork [${locale}]`, () => {
      // A missing string renders as its own key. On this screen that is not a
      // cosmetic problem: it is a blank in the list somebody is comparing.
      expect(fork(locale)).not.toMatch(/ryc\.[a-z0-9.]+/);
      expect(confirm(locale)).not.toMatch(/ryc\.[a-z0-9.]+/);
    });
  }
});

describe("the step indicator shows the asymmetry rather than hiding it", () => {
  for (const locale of LOCALES) {
    const t = createTranslator(rycStrings, locale);
    const steps = (current: "form" | "fork" | "confirm"): string =>
      draw(createElement(Steps, { current }), locale);

    it(`the named branch is two steps [${locale}]`, () => {
      expect(steps("fork")).not.toContain(t("ryc.steps.confirm"));
    });

    it(`the anonymous branch is three, and the third appears only there [${locale}]`, () => {
      expect(steps("confirm")).toContain(t("ryc.steps.confirm"));
      expect(steps("form")).not.toContain(t("ryc.steps.confirm"));
    });

    it(`marks the current step for a screen reader too, not only by colour [${locale}]`, () => {
      expect(steps("fork")).toContain('aria-current="step"');
    });
  }
});

describe("the confirmation says what cannot be undone", () => {
  for (const locale of LOCALES) {
    const t = createTranslator(rycStrings, locale);

    it(`names the platform's own inability, not just the contributor's [${locale}]`, () => {
      // "we will not know which one is yours" is the sentence that separates
      // this guarantee from every product that merely promises to forget.
      const em = t("ryc.confirm.2.em");
      expect(em).not.toBe("ryc.confirm.2.em");
      expect(confirm(locale)).toContain(em.split(/[.:]/)[0]!.split(" ").slice(0, 3).join(" "));
    });

    it(`offers a way back beside the irreversible button [${locale}]`, () => {
      expect(confirm(locale)).toContain(t("ryc.confirm.return"));
    });

    it(`does not claim the review can be recovered by anyone [${locale}]`, () => {
      const html = confirm(locale);
      for (const { phrase } of NOT_BUILT[locale]) expect(html).not.toContain(phrase);
    });
  }
});
