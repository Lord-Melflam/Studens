/**
 * What the messages say, and the one number they must not get wrong.
 *
 * THE LIFETIME IS STATED IN FOUR PLACES: the constant that enforces it, and
 * three translations that promise it. On 2026-09-13 the constant moved from one
 * hour to twenty-four; a message still promising one hour would have had people
 * abandoning a link that was in fact still good, which is the same class of
 * failure as the screen that claimed a message had been sent.
 *
 * These read the templates as source rather than rendering them, because the
 * renderer lives in the worker and importing it here would pull a Prisma client
 * into a test that needs no database.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONFIRM_MAX_AGE_SECONDS } from "@studens/platform";

const source = readFileSync(
  new URL("../../apps/worker/src/mail-templates.ts", import.meta.url).pathname,
  "utf8",
);

/**
 * A comment explaining a rule is not a breach of it.
 *
 * The same exemption the FR-B16 gate needs, and for the same reason: the header
 * of that file says a template "would need the same review any other guarantee
 * gets", and the first run of this test read the word "review" and failed.
 */
const templates = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the confirmation message promises the lifetime that is enforced", () => {
  const hours = CONFIRM_MAX_AGE_SECONDS / 3600;

  it("is a whole number of hours, so it can be said in words", () => {
    expect(Number.isInteger(hours)).toBe(true);
  });

  it("states that number in all three languages", () => {
    // Matched loosely on the digits: each language words the unit differently
    // and one of them may well change, but the number may not drift.
    const stated = [...templates.matchAll(/(\d+)\s*(?:heures?|uur|hours?)/g)].map((m) =>
      Number(m[1]),
    );
    expect(stated.length, "each language states the lifetime once").toBeGreaterThanOrEqual(3);
    for (const n of stated) {
      expect(n, `a template promises ${n} hours, the code enforces ${hours}`).toBe(hours);
    }
  });

  it("never promises 'one hour' in words after the change", () => {
    // The three phrasings that were there before, which would now be false.
    for (const phrase of ["une heure", "één uur", "one hour"]) {
      expect(templates, `"${phrase}" no longer matches the enforced lifetime`).not.toContain(
        phrase,
      );
    }
  });
});

describe("what a message may contain (FR-H3)", () => {
  /**
   * No template may be about a contribution. Naming one requires knowing whose
   * it is, which for the anonymous path is the link that does not exist, and
   * this file is where such a template would be written.
   */
  it("names no contribution", () => {
    for (const word of ["review", "avis", "beoordeling", "contribution", "bijdrage"]) {
      expect(templates.toLowerCase(), `a mail template mentions "${word}"`).not.toContain(word);
    }
  });

  /**
   * The warning to the old address deliberately carries no link. A message
   * saying "click here if this was not you" is the shape every phishing mail
   * takes, and this one goes to somebody who may be losing their account.
   */
  it("the warning to the previous address offers no link", () => {
    const block = /"email\.changed":\s*\{[\s\S]*?\n {2}\},/.exec(templates)?.[0] ?? "";
    expect(block, "email.changed template should be findable").not.toBe("");
    expect(block).not.toContain("http");
    expect(block).not.toContain("url");
  });
});
