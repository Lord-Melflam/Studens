/**
 * Reading the English edition of a course page (OPEN-47).
 *
 * Against the real HTML, saved from `en-cours-2026-lepl1503` on 2026-09-27,
 * because the labels are the whole difficulty and a fixture written by hand
 * would only prove that the parser matches labels somebody invented.
 *
 * THE LABELS WERE MEASURED, NOT GUESSED. Read off the live page:
 *
 *     Teacher(s)   Language   Prerequisites   Main themes   Learning outcomes
 *     Content      Teaching methods           Evaluation methods
 *     Bibliography Faculty or entity
 *
 * `Teacher(s)` is why the alias is `teacher` and not `teachers`: the lookup is
 * a substring match and "teacher(s)" does not contain "teachers". That one
 * character silently emptied the lecturer list on every English page.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hasEnglishProse, parseEnglish, parseOffering } from "@studens/ref";

const root = new URL("../..", import.meta.url).pathname;
const html = readFileSync(`${root}test/fixtures/en-cours-2026-lepl1503.html`, "utf8");

describe("the English edition parses with the same parser", () => {
  it("reads the translated title", () => {
    expect(parseOffering(html, "lepl1503", 2026, "x").title).toBe("Project 3");
  });

  it("finds the lecturers behind the Teacher(s) label", () => {
    // The bug: "teacher(s)" does not contain "teachers", so this was empty.
    expect(parseOffering(html, "lepl1503", 2026, "x").teachers.length).toBeGreaterThan(0);
  });

  it("reads the fields the English labels name", () => {
    const o = parseOffering(html, "lepl1503", 2026, "x");
    for (const field of ["themes", "content", "objectives", "prerequisites", "bibliography"] as const) {
      expect(o[field], `${field} was not found on the English page`).not.toBeNull();
    }
  });

  it("keeps the numbers, which are the same in both editions", () => {
    const o = parseOffering(html, "lepl1503", 2026, "x");
    expect(Number(o.ects)).toBe(5);
  });
});

describe("a deferral is not content", () => {
  /**
   * The English page of this very course says "See French document" under
   * Evaluation methods, where the French page has 1,855 characters. Keeping
   * it would replace the real text with a sentence telling the reader to find
   * the thing that was just discarded.
   */
  it("refuses the field that only points at the French page", () => {
    expect(parseEnglish(html, "lepl1503", 2026, "x")?.assessment).toBeNull();
    // And it really is there to be refused, so this test cannot pass because
    // the field was simply absent.
    expect(JSON.stringify(parseOffering(html, "lepl1503", 2026, "x").assessment)).toContain(
      "See French document",
    );
  });

  it("keeps a short field that is real English", () => {
    // 67 characters, and genuine. Length is not the signal; the sentence is.
    const en = parseEnglish(html, "lepl1503", 2026, "x");
    expect(JSON.stringify(en?.teachingMethods)).toContain("Project");
  });

  it("returns null when the edition published nothing at all", () => {
    const empty = "<div class='fa_row'><div class='fa_cell_1'>Language</div>" +
      "<div class='fa_cell_2'>English</div></div><h1>Nothing</h1><div class='fa_cell_0'>5 credits</div>";
    // No prose fields at all: the caller should store nothing rather than an
    // object of seven nulls, so its fallback is one check and not seven.
    expect(parseEnglish(empty, "x", 2026, "x")?.assessment ?? null).toBeNull();
  });
});

describe("a title is not an edition", () => {
  /**
   * WHAT THIS CAUGHT. The crawl reported "6,654 with an English edition, 0
   * whose English page had nothing" while the database held 4,860 rows with
   * English text. Both numbers were computed honestly and they described
   * different things.
   *
   * UCLouvain publishes an English title for every course, whether or not
   * anybody ever wrote the English sheet. So `parseEnglish` returns a non-null
   * record for all of them: `title` survived even when all seven prose fields
   * deferred to the French page. The crawler counted those records; the loader
   * counted the prose and stored nothing for a title-only page. 1,794 courses
   * fell in the gap and the log line claimed none did.
   *
   * The fix was one predicate rather than a corrected number, because a number
   * corrected in one of two places goes wrong again the next time somebody
   * adds a caller.
   */
  const titleOnly =
    "<h1>Software Engineering Project</h1>" +
    "<div class='fa_row'><div class='fa_cell_1'>Evaluation methods</div>" +
    "<div class='fa_cell_2'>See French document</div></div>" +
    "<div class='fa_cell_0'>5 credits</div>";

  it("parses a title-only page into a record, which is why the count was wrong", () => {
    const en = parseEnglish(titleOnly, "x", 2026, "x");
    expect(en, "the record exists, so `!== null` counts it as an edition").not.toBeNull();
    expect(en?.title).toBe("Software Engineering Project");
  });

  it("does not call that page an English edition", () => {
    expect(hasEnglishProse(parseEnglish(titleOnly, "x", 2026, "x"))).toBe(false);
  });

  it("calls a page with one real prose field an edition", () => {
    const en = parseEnglish(html, "lepl1503", 2026, "x");
    expect(hasEnglishProse(en)).toBe(true);
  });

  it("says no to nothing at all", () => {
    expect(hasEnglishProse(null)).toBe(false);
    expect(hasEnglishProse(undefined)).toBe(false);
  });
});
