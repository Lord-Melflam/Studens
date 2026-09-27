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
import { parseEnglish, parseOffering } from "@studens/ref";

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
