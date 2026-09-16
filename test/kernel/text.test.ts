/**
 * What a person may type, and the two implementations agreeing about it.
 *
 * FOUND BY USING IT, 2026-09-13. François was stuck on the last screen of the
 * first run and reasonably suspected the emoji he had typed. They were not the
 * cause, but probing the endpoint to find out turned up what was: the free text
 * fields accepted control characters, bidirectional overrides and zero-width
 * characters, counted emoji as two characters each against a limit of 120, and
 * said nothing on screen about any of it. His words: "Input sanitization and
 * clear visual warning should be visible for bad inputs."
 *
 * TWO IMPLEMENTATIONS, ONE BEHAVIOUR. The server decides and the browser
 * mirrors, so a mistake is visible while it is made. A mirror that has drifted
 * is worse than no mirror: it tells somebody their input is fine and then the
 * save fails anyway. Every case below runs through both.
 */
import { describe, expect, it } from "vitest";
import { TEXT_LIMITS, TextInvalid, checkFreeText, countGraphemes } from "@studens/platform";
import {
  TEXT_LIMITS as WEB_LIMITS,
  countGraphemes as webCount,
  textProblem,
} from "@studens/web";

/** Every case, with what both sides must say about it. */
const CASES: Array<{ label: string; input: string; problem: string | null }> = [
  { label: "ordinary text", input: "bachelier ingenieur civil", problem: null },
  { label: "accents", input: "bachelier ing\u00e9nieur civil, orientation \u00e9lectricit\u00e9", problem: null },
  { label: "emoji", input: "ing\u00e9nieur civil \u{1F393}\u{1F680}", problem: null },
  // Held together by U+200D, which is allowed for exactly this reason.
  { label: "compound emoji", input: "famille \u{1F468}\u200D\u{1F469}\u200D\u{1F467}", problem: null },
  { label: "empty", input: "", problem: null },
  { label: "only whitespace", input: "    ", problem: null },
  { label: "collapsible whitespace", input: "a    b", problem: null },

  { label: "exactly at the limit", input: "x".repeat(120), problem: null },
  { label: "one over the limit", input: "x".repeat(121), problem: "long" },
  // 61 emoji is 122 UTF-16 units and 61 characters to whoever typed them.
  // This is the case that made the old limit feel arbitrary.
  { label: "61 emoji, under the limit", input: "\u{1F393}".repeat(61), problem: null },
  { label: "121 emoji, over it", input: "\u{1F393}".repeat(121), problem: "long" },

  // Written as escapes throughout. An invisible character pasted into a test
  // file is invisible to the reviewer too, and does not survive every editor:
  // the first version of this corpus used literals and two cases silently
  // became plain "ab".
  { label: "bell", input: "a\u0007b", problem: "control" },
  { label: "null byte", input: "a\u0000b", problem: "control" },
  { label: "newline in a one-line field", input: "a\u000Ab", problem: "control" },
  { label: "tab", input: "a\u0009b", problem: "control" },
  { label: "C1 control", input: "a\u009Bb", problem: "control" },

  { label: "right-to-left override", input: "a\u202Eb", problem: "bidi" },
  { label: "left-to-right embedding", input: "a\u202Ab", problem: "bidi" },
  { label: "first strong isolate", input: "a\u2068b", problem: "bidi" },
  { label: "arabic letter mark", input: "a\u061Cb", problem: "bidi" },

  { label: "zero-width space", input: "a\u200Bb", problem: "invisible" },
  { label: "zero-width non-joiner", input: "a\u200Cb", problem: "invisible" },
  { label: "byte order mark", input: "a\uFEFFb", problem: "invisible" },
  { label: "soft hyphen", input: "a\u00ADb", problem: "invisible" },
  { label: "word joiner", input: "a\u2060b", problem: "invisible" },
];

describe("the rules", () => {
  for (const { label, input, problem } of CASES) {
    it(`${problem ?? "accepts"}: ${label}`, () => {
      if (problem === null) {
        expect(() => checkFreeText(input, 120)).not.toThrow();
      } else {
        let thrown: unknown;
        try {
          checkFreeText(input, 120);
        } catch (e) {
          thrown = e;
        }
        expect(thrown, label).toBeInstanceOf(TextInvalid);
        expect((thrown as TextInvalid).reason).toBe(problem);
      }
    });
  }

  it("collapses whitespace rather than refusing it", () => {
    // Nobody means the difference between one space and three, and the length
    // somebody is told about should be the length of what is stored.
    expect(checkFreeText("a    b", 120)).toBe("a b");
    expect(checkFreeText("  padded  ", 120)).toBe("padded");
  });

  it("returns null for nothing, rather than an empty string", () => {
    expect(checkFreeText("", 120)).toBeNull();
    expect(checkFreeText("   ", 120)).toBeNull();
  });

  /**
   * The rules REJECT rather than strip. Quietly removing a character means what
   * somebody sees saved is not what they wrote, which is its own kind of wrong.
   */
  it("never silently removes a character it objects to", () => {
    for (const bad of ["a\u202Eb", "a\u200Bb", "a\u0007b"]) {
      expect(() => checkFreeText(bad, 120)).toThrow(TextInvalid);
    }
  });

  it("says which limit was exceeded, so the message can name it", () => {
    let thrown: TextInvalid | undefined;
    try {
      checkFreeText("x".repeat(200), 120);
    } catch (e) {
      thrown = e as TextInvalid;
    }
    expect(thrown?.max).toBe(120);
  });
});

describe("counting what a person sees", () => {
  it("counts an emoji as one character", () => {
    expect("\u{1F393}".length, "JavaScript counts UTF-16 units").toBe(2);
    expect(countGraphemes("\u{1F393}")).toBe(1);
  });

  it("counts a compound emoji as one character", () => {
    expect(countGraphemes("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}")).toBe(1);
  });

  it("counts ordinary text the ordinary way", () => {
    expect(countGraphemes("abc")).toBe(3);
    expect(countGraphemes("")).toBe(0);
  });
});

/**
 * The property that keeps the warning truthful. If these ever disagree, the
 * browser tells somebody their input is fine and the server refuses it, which
 * is the shape of the bug this whole change exists to remove.
 */
describe("the browser mirror agrees with the server", () => {
  it("has the same limits", () => {
    expect(WEB_LIMITS).toEqual(TEXT_LIMITS);
  });

  it("counts the same way", () => {
    for (const { input } of CASES) {
      expect(webCount(input), JSON.stringify(input)).toBe(countGraphemes(input));
    }
  });

  it("reaches the same verdict, with the same reason, on every case", () => {
    for (const { label, input, problem } of CASES) {
      expect(textProblem(input, 120), label).toBe(problem);
    }
  });
});
