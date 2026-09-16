/**
 * The course page parser, against real captured pages from both eras.
 *
 * Fixtures are committed on purpose: the tests must be deterministic and must
 * run offline, and a captured page is the only true record of what the
 * layout was on the day it was read.
 *
 *   modern-era.html  modern era, fetched 2026-09-10
 *   archive-era.html  archive era, fetched 2026-09-10 via the redirect
 *                             to sites.uclouvain.be/archives-portail/cdc2012
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blocksToText, detectEra, parseOffering, ParseError } from "@studens/ref";

const dir = join(new URL("../..", import.meta.url).pathname, "test/fixtures/catalogue");
const modern = readFileSync(join(dir, "modern-era.html"), "utf8");
const archive = readFileSync(join(dir, "archive-era.html"), "utf8");

describe("era detection", () => {
  it("recognises the modern layout", () => {
    expect(detectEra(modern)).toBe("modern");
  });
  it("recognises the archive layout", () => {
    expect(detectEra(archive)).toBe("archive");
  });
  it("refuses an unrecognised layout rather than guessing", () => {
    expect(() => detectEra("<html><body>nothing familiar</body></html>")).toThrow(
      /unrecognised course page layout/,
    );
  });
});

describe("modern era: cours-2025-lepl1503", () => {
  const o = parseOffering(modern, "lepl1503", 2025, "https://uclouvain.be/cours-2025-lepl1503");

  it("reads the title without the code", () => {
    expect(o.title).toBe("Projet Exemple");
  });

  it("reads ECTS as a number", () => {
    expect(o.ects).toBe(5);
  });

  it("reads the quarter", () => {
    expect(o.quarter).toBe("Q2");
  });

  it("reads contact hours, and keeps them distinct from student effort", () => {
    expect(o.contactHours).toBe("30.0 h + 30.0 h");
  });

  it("reads the language", () => {
    expect(o.language).toBe("Français");
  });

  it("reads the teachers, stripping the parenthetical roles", () => {
    expect(o.teachers).toContain("Dupont Alice");
    expect(o.teachers.join(" ")).not.toMatch(/coordinateur/);
  });

  it("reads the assessment method with its weightings (FR-D19)", () => {
    expect(o.assessment).toBeTruthy();
    // Structured now, not a string: the weightings are still there, and so is
    // the shape they were written in. test/catalogue/rich.test.ts covers the
    // model itself; this only checks the field arrives through the parser.
    const text = blocksToText(o.assessment!);
    expect(text).toMatch(/35%/);
    expect(text).toMatch(/55%/);
    expect(o.assessment!.every((b) => ["p", "h", "list", "table"].includes(b.kind))).toBe(true);
  });

  it("reads the owning faculty, which is not the faculty it was reached through", () => {
    expect(o.owningFaculty).toBeTruthy();
  });
});

describe("archive era: cours-2012-lfsa2995", () => {
  const o = parseOffering(archive, "lfsa2995", 2012, "https://uclouvain.be/cours-2012-lfsa2995");

  it("strips the bracketed code from the heading", () => {
    expect(o.title).toBe("Stage en entreprise");
  });

  it("reads ECTS, which is required in every era", () => {
    expect(o.ects).toBe(10);
  });

  it("reads contact hours", () => {
    expect(o.contactHours).toBe("30.0 h");
  });

  it("returns null for the quarter, because the era has no such field", () => {
    expect(o.quarter).toBeNull();
  });

  it("still reads the labelled fields from the table layout", () => {
    expect(o.themes ?? o.content).toBeTruthy();
  });
});

describe("failing loudly rather than storing nulls", () => {
  const url = "https://example.invalid/cours-2025-test";

  it("refuses a page with no credits cell", () => {
    const html = '<html><body><div class="fa_cell_0">Q1</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    expect(() => parseOffering(html, "x", 2025, url)).toThrow(ParseError);
    expect(() => parseOffering(html, "x", 2025, url)).toThrow(/ECTS is required in every era/);
  });

  it("refuses an implausible ECTS value", () => {
    const html = '<html><body><div class="fa_cell_0">999 crédits</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    expect(() => parseOffering(html, "x", 2025, url)).toThrow(/implausible value/);
  });

  it("refuses a page with a header but no labelled fields", () => {
    const html = '<html><body><div class="fa_cell_0">5.00 crédits</div><h1>X</h1></body></html>';
    expect(() => parseOffering(html, "x", 2025, url)).toThrow(/the layout changed/);
  });

  /**
   * THIS ASSERTED THE OPPOSITE UNTIL 2026-09-16, and a real page settled it.
   *
   * The rule was that a label with an empty value means the layout changed, so
   * the parser threw. Then `cours-2025-lcems2066` turned up on the second
   * faculty ever crawled: UCLouvain publishes its evaluation label with a
   * literal `<div></div>` under it, and a crawl of 969 courses died on that one
   * page. Published-and-empty is a third state, and it is an absence.
   *
   * What the old rule was guarding has not been dropped, it has moved to
   * `snapshot.ts`, which is the only place the evidence exists: a selector that
   * stops matching empties a field on EVERY page, not on one.
   */
  it("treats a present label with an empty value as an absence, not a failure", () => {
    const html = '<html><body><div class="fa_cell_0">5.00 crédits</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Langue d\'enseignement</div><div class="fa_cell_2"></div></div>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    const parsed = parseOffering(html, "x", 2025, url);
    expect(parsed.language).toBeNull();
    // And the page is still parsed: the rest of it was never in doubt.
    expect(parsed.ects).toBe(5);
    expect(parsed.content).not.toBeNull();
  });

  it("still refuses a page whose fields cannot be found at all", () => {
    // The difference that matters: nothing labelled anywhere is a layout
    // change, and that check is unchanged.
    const html = '<html><body><div class="fa_cell_0">5.00 crédits</div><h1>X</h1></body></html>';
    expect(() => parseOffering(html, "x", 2025, url)).toThrow(/the layout changed/);
  });
});
