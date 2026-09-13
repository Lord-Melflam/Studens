/**
 * The same rules as the server, in the browser.
 *
 * A MIRROR, NOT THE AUTHORITY. `packages/platform/src/text.ts` decides; this
 * exists so a mistake is visible while it is being made rather than after the
 * button is pressed. `test/kernel/text.test.ts` runs both over the same corpus
 * and fails if they ever disagree, because a client check that has drifted is
 * worse than none: it tells somebody their input is fine and the save fails
 * anyway.
 *
 * DUPLICATED RATHER THAN SHARED, for the same reason `loadDotEnv` is. The
 * platform package imports Prisma and `node:crypto`, so the browser cannot
 * import it, and a new workspace package for sixty lines of pure string rules
 * would cost a tier in the boundary gate that a pure utility has no business
 * having. Sixty duplicated lines with a test pinning them together is the
 * cheaper of the two wrongs.
 */

export type TextProblem = "long" | "control" | "bidi" | "invisible";

/** Kept identical to the server's, character for character. */
// Refusing control characters is what this pattern is FOR. The rule exists to
// catch one that arrived in a regex by accident, and there is no way to express
// this without naming them.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/u;
const BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const INVISIBLE = /[\u00AD\u200B\u200C\u2060-\u2064\uFEFF]/u;

export const TEXT_LIMITS = { studies: 120, interests: 120 } as const;

/** What a person would say the length is: graphemes, not UTF-16 units. */
export function countGraphemes(text: string): number {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (typeof Segmenter === "function") {
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return [...text].length;
}

/**
 * What is wrong with this value, or null if nothing is.
 *
 * Returns the problem rather than throwing: this runs on every keystroke, and
 * an exception per character is the wrong shape for something that is usually
 * answering "nothing yet".
 */
export function textProblem(raw: string, max: number): TextProblem | null {
  // Same order as the server, and the order matters: checking after collapsing
  // whitespace lets the byte order mark through, because JavaScript counts
  // U+FEFF as whitespace.
  if (CONTROL.test(raw)) return "control";
  if (BIDI.test(raw)) return "bidi";
  if (INVISIBLE.test(raw)) return "invisible";
  const text = raw.replace(/\s+/gu, " ").trim();
  if (text === "") return null;
  if (countGraphemes(text) > max) return "long";
  return null;
}
