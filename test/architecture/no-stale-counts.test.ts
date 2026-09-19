/**
 * A COUNT MAY NOT BE WRITTEN INTO A TRANSLATED STRING.
 *
 * The module's public page said "546 cours" and "43 programmes" while the
 * database held 12,154 and 1,055. Nobody had lied: the numbers were true when
 * they were typed, and then the crawl widened to a second university and
 * nothing updates a sentence. A figure held in one place and read from there
 * cannot go stale; a figure typed into a sentence always can.
 *
 * The version of that which cannot rot is to fetch the number rather than to
 * keep it anywhere, which is what `CatalogueFacts` does. This stops the next
 * one being typed back in.
 *
 * A YEAR IS NOT A COUNT, which is why the exception below exists rather than a
 * looser rule: "un avis date de 2019" is an example in a sentence about why
 * dates matter, and it ages without ever becoming false.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url).pathname;

/** Four digit numbers between 1900 and 2100, which are years and not counts. */
const YEAR = /^(19|20|21)\d{2}$/;

describe("the interface states no catalogue figure it cannot refresh", () => {
  for (const file of [
    "packages/ryc-ui/src/strings.ts",
    "apps/web/src/strings/index.ts",
  ]) {
    it(`${file} writes no count into a string`, () => {
      const text = readFileSync(root + file, "utf8");
      const offenders: string[] = [];
      for (const [, literal] of text.matchAll(/"((?:[^"\\]|\\.){4,})"/g)) {
        for (const [digits] of literal.matchAll(/\b\d{3,}\b/g)) {
          if (YEAR.test(digits)) continue;
          offenders.push(`${digits} in "${literal.slice(0, 70)}..."`);
        }
      }
      expect(
        offenders,
        "a number in a sentence is stale the moment the crawler runs again. " +
          "Fetch it instead: /api/catalogue reports the courses, the programmes " +
          "and the institutions, and packages/ryc-ui/src/CatalogueFacts.tsx " +
          "renders them",
      ).toEqual([]);
    });
  }
});
