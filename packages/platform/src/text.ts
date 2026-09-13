/**
 * What a person may type into a free text field, and what it costs them.
 *
 * THE AUTHORITY IS HERE, on the server. The browser mirrors these rules so a
 * mistake is visible while it is being made rather than after it is submitted,
 * and `test/kernel/text.test.ts` asserts the two agree on every case, because a
 * client check that has drifted from the server is worse than none: it tells
 * somebody their input is fine and then the save fails anyway.
 *
 * IT REJECTS, IT DOES NOT SILENTLY STRIP. Quietly removing characters is its own
 * dishonesty: somebody types their name with an invisible character pasted in
 * from a web page, we drop it, and what they see saved is not what they wrote.
 * The one exception is ordinary whitespace, which is collapsed, because nobody
 * means the difference between one space and three.
 *
 * WHAT IS REFUSED, AND WHY EACH ONE:
 *
 *   - CONTROL CHARACTERS. Nothing types them on purpose. They travel through
 *     logs, terminals and CSV exports as commands rather than as text.
 *   - BIDIRECTIONAL OVERRIDES. U+202E and its family reorder what is displayed
 *     without changing what is stored, so "annexe.txt" can be made to read
 *     "annexe.exe" and a sentence can be made to read as its opposite. A
 *     profile field is low stakes; the habit is not, and this is the module
 *     every other field will borrow from.
 *   - ZERO-WIDTH AND INVISIBLE characters. They make two different strings look
 *     identical, which is how one person passes for another, and they pad a
 *     length limit with nothing.
 *
 * EMOJI ARE FINE, and counted as what they look like. `"\u{1F393}".length` is 2
 * in JavaScript, so a limit of 120 measured that way refuses 61 emoji from
 * somebody who typed 61 characters and can count them. Graphemes are what a
 * person sees, so graphemes are what is counted.
 */

export class TextInvalid extends Error {
  constructor(
    readonly reason: "long" | "control" | "bidi" | "invisible",
    readonly max?: number,
  ) {
    super(`text: ${reason}`);
    this.name = "TextInvalid";
  }
}

/** C0 and C1 control characters, tab and newline included: these are one-line fields. */
// Refusing control characters is what this pattern is FOR. The rule exists to
// catch one that arrived in a regex by accident, and there is no way to express
// this without naming them.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/u;

/**
 * Bidirectional formatting characters.
 *
 * The overrides and embeddings (202A to 202E), the isolates (2066 to 2069), and
 * the marks (200E, 200F, 061C). All of them change how a string is displayed
 * without changing what it contains.
 */
const BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

/**
 * Zero-width and other invisibles.
 *
 * The zero-width space and non-joiner, the direction marks, the word joiner,
 * the invisible operators, the byte order mark, and the soft hyphen.
 *
 * U+200D, THE ZERO-WIDTH JOINER, IS DELIBERATELY ALLOWED. It is what holds a
 * compound emoji together: refusing it refuses the family and the flags, which
 * is a real cost to a person writing about themselves, for a small gain. What
 * it could otherwise buy an attacker is bounded from two directions. The
 * username is the only field that renders in public and it has its own strict
 * allowlist, which admits no joiner. And the length here is counted in
 * graphemes, so a joined sequence counts as the one character it looks like and
 * cannot be used to pad a limit with nothing.
 *
 * Written as escapes, not as literals: an invisible character sitting in source
 * is exactly the thing that should not be invisible.
 */
const INVISIBLE = /[\u00AD\u200B\u200C\u2060-\u2064\uFEFF]/u;

/**
 * How many characters a person would say this is.
 *
 * `Intl.Segmenter` where it exists, which is every current browser and Node 22.
 * Code points otherwise, which still beats `.length` for anything outside the
 * basic plane and is only wrong about compound emoji.
 */
export function countGraphemes(text: string): number {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (typeof Segmenter === "function") {
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return [...text].length;
}

/**
 * Clean and check one line of free text.
 *
 * Returns the value to store, or null where there is nothing left once the
 * whitespace is taken off. Throws `TextInvalid` with the reason, which the API
 * passes to the screen so it can say what is wrong rather than that something
 * is.
 */
export function checkFreeText(raw: string, max: number): string | null {
  // EVERY RULE LOOKS AT WHAT WAS TYPED, BEFORE ANY TIDYING.
  //
  // The first version collapsed whitespace first and then checked, which let
  // the byte order mark through: JavaScript counts U+FEFF as whitespace, so
  // "a<BOM>b" quietly became "a b" and was accepted. That is the silent
  // stripping this module says it does not do, arriving through the back door.
  if (CONTROL.test(raw)) throw new TextInvalid("control");
  if (BIDI.test(raw)) throw new TextInvalid("bidi");
  if (INVISIBLE.test(raw)) throw new TextInvalid("invisible");

  // Only now is it tidied, and the length is measured on what will be stored,
  // so the counter on screen and the limit here are talking about one string.
  const text = raw.replace(/\s+/gu, " ").trim();
  if (text === "") return null;
  if (countGraphemes(text) > max) throw new TextInvalid("long", max);

  return text;
}

/** The limits, exported so the screen can show a counter that agrees with this. */
export const TEXT_LIMITS = {
  studies: 120,
  interests: 120,
} as const;
