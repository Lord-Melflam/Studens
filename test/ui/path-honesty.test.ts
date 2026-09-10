/**
 * The fork may not promise what does not exist.
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
 * WHEN FR-C14 AND FR-D12 SHIP, this test is updated in the same change that
 * ships them, and not before. That coupling is the point.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnonymousConfirm, PathChoice, Steps } from "@studens/ryc-ui";

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

const fork = (): string =>
  renderToStaticMarkup(
    createElement(PathChoice, {
      ctx,
      draft,
      onNamed: noop,
      onAnonymous: noop,
      onBack: noop,
      busy: false,
    }),
  );

/** Just the two decision cards, which is where a claim does the damage. */
function cards(html: string): string {
  const start = html.indexOf('class="fork-cards"');
  const end = html.indexOf('class="fork-note"');
  expect(start, "the fork's cards should be findable").toBeGreaterThan(-1);
  return html.slice(start, end === -1 ? undefined : end);
}

/** Capabilities that are specified and NOT built, as they would be worded. */
const NOT_BUILT = [
  { phrase: "Mes avis", requirement: "FR-D12" },
  { phrase: "modifier plus tard", requirement: "FR-C14" },
  { phrase: "demander sa suppression", requirement: "FR-C14" },
  { phrase: "modifier votre avis", requirement: "FR-C14" },
];

describe("the decision cards claim only what is true today", () => {
  it("offers no unbuilt capability as a reason to choose a branch", () => {
    const html = cards(fork());
    for (const { phrase, requirement } of NOT_BUILT) {
      expect(
        html,
        `the fork's cards mention "${phrase}". ${requirement} is specified and ` +
          `not built, and this is the screen where the choice becomes permanent.`,
      ).not.toContain(phrase);
    }
  });

  it("still states the one thing that is permanently true, on the anonymous card", () => {
    // The asymmetry is real and must stay stated: FR-C9 is not a missing
    // feature, it is a structural consequence that will never change.
    expect(cards(fork())).toContain("Impossible à modifier ou à supprimer");
  });

  it("mentions the planned edit once, below both cards, not inside either", () => {
    const html = fork();
    expect(html).toContain("pas encore");
    expect(cards(html)).not.toContain("pas encore");
  });

  it("shows the counts FR-C21 requires before the choice", () => {
    const html = fork();
    expect(html).toContain("11 avis nommé");
    expect(html).toContain("aucun avis anonyme");
  });

  it("puts the draft back in view, so the choice is not made blind", () => {
    expect(fork()).toContain("Relire mon avis");
  });
});

describe("the step indicator shows the asymmetry rather than hiding it", () => {
  const steps = (current: "form" | "fork" | "confirm"): string =>
    renderToStaticMarkup(createElement(Steps, { current }));

  it("the named branch is two steps", () => {
    expect(steps("fork")).not.toContain("Confirmation");
  });

  it("the anonymous branch is three, and the third appears only there", () => {
    expect(steps("confirm")).toContain("Confirmation");
    expect(steps("form")).not.toContain("Confirmation");
  });

  it("marks the current step for a screen reader too, not only by colour", () => {
    expect(steps("fork")).toContain('aria-current="step"');
  });
});

describe("the confirmation says what cannot be undone", () => {
  const html = renderToStaticMarkup(
    createElement(AnonymousConfirm, { ctx, draft, onConfirm: noop, onBack: noop, busy: false }),
  );

  it("names the platform's own inability, not just the contributor's", () => {
    expect(html).toContain("Nous non plus");
  });

  it("offers a way back beside the irreversible button", () => {
    expect(html).toContain("Revenir en arrière");
  });

  it("does not claim the review can be recovered by anyone", () => {
    for (const { phrase } of NOT_BUILT) expect(html).not.toContain(phrase);
  });
});
