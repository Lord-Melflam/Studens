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
import { blocksToText, detectEra, parseOffering } from "@studens/ref";

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

  /**
   * A page with no credits KEEPS THE COURSE, and says the field is not stated.
   *
   * This asserted the opposite twice in one evening. First the parser refused
   * the page outright, which ended a crawl; then it refused it distinguishably
   * so the crawl could skip the course, which threw away every other field the
   * page does publish: losing every other field for the sake of a few missing
   * ones is the wrong trade.
   *
   * `cours-2026-wbcmm21021` is a real seminar with a title, a faculty, a
   * quarter and contact hours. We scrape a source we do not control, so a field
   * the source omits is a fact to record and state plainly, never a course to
   * lose.
   */
  it("keeps the course when the page states no credits, and returns null", () => {
    const html = '<html><body><div class="fa_cell_0">Q1</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    const parsed = parseOffering(html, "x", 2025, url);
    expect(parsed.ects).toBeNull();
    // Everything else on the page is still there, which is the entire point.
    expect(parsed.title).toBe("X");
    expect(parsed.quarter).toBe("Q1");
    expect(parsed.content).not.toBeNull();
  });

  /**
   * ZERO IS A REAL ANSWER, and refusing it ended a crawl of 6,654 pages after
   * 250. `cours-2026-bmeta1000` publishes "0.00 crédits" beside "18.0 h" and
   * "Q2": a taught course whose credits are counted somewhere other than on it.
   * A student takes it, so a student would look for it.
   */
  it("accepts 0 credits, which the university does publish", () => {
    const html = '<html><body><div class="fa_cell_0">0.00 crédits</div>' +
      '<div class="fa_cell_0">18.0 h</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    expect(parseOffering(html, "x", 2025, url).ects).toBe(0);
  });

  it("tells a stated zero apart from no statement at all", () => {
    // Both are kept, and they mean different things: 0.00 is the university
    // saying the course is worth nothing, null is the university not saying.
    const withZero = '<html><body><div class="fa_cell_0">0.00 crédits</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    const withNone = '<html><body><div class="fa_cell_0">18.0 h</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    expect(parseOffering(withZero, "x", 2025, url).ects).toBe(0);
    expect(parseOffering(withNone, "x", 2025, url).ects).toBeNull();
  });

  /**
   * THE COURSE NAMESPACE ALSO HOLDS BUNDLES, and one stopped a crawl at 5,000
   * pages of 6,654. `cours-2026-mcomu1000` is titled "Cours du bachelier en
   * technologies numériques..." and is worth 180 credits: a whole three year
   * bachelor, published as one entry.
   *
   * Measured over 6,028 cached pages of the year: 5,885 are 15 credits or
   * fewer, 142 are 16 to 30, none is between 31 and 120, and exactly one is
   * 180. The old ceiling of 120 protected nothing in the range it covered.
   */
  it("accepts a bundle entry worth a whole programme", () => {
    const html = '<html><body><div class="fa_cell_0">180.00 crédits</div><h1>X</h1>' +
      '<div class="fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">y</div></div></body></html>';
    expect(parseOffering(html, "x", 2025, url).ects).toBe(180);
  });

  it("refuses an implausible ECTS value", () => {
    // 999 is still nonsense: above a six year medicine programme, which is the
    // largest thing the bundle entries could stand for.
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
