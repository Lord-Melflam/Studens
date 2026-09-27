/**
 * TWO UNIVERSITIES, ONE CHIP.
 *
 * The filter panel offered "premier quadrimestre" and "Q1" as separate
 * choices, and "Français" beside "fr". Picking one silently excluded the other
 * university's courses, which is a filter answering a question wrongly rather
 * than a cosmetic duplicate.
 */
import { describe, expect, it } from "vitest";
import { languageKey, quarterKey, quarterTerms } from "@studens/ryc-ui";

describe("the term a course is taught in", () => {
  it("gives one key for both universities' words", () => {
    // Real values, counted in the loaded catalogue on 2026-09-19.
    expect(quarterKey("Q1")).toBe(quarterKey("premier quadrimestre"));
    expect(quarterKey("Q2")).toBe(quarterKey("deuxième quadrimestre"));
    expect(quarterKey("Q3")).toBe(quarterKey("troisième quadrimestre"));
  });

  it("survives the accents and the capitals the two sources disagree on", () => {
    expect(quarterKey("DEUXIÈME QUADRIMESTRE")).toBe("Q2");
    expect(quarterKey("  deuxieme  quadrimestre ")).toBe("Q2");
  });

  it("keeps the spans that are not a single term", () => {
    expect(quarterKey("1e et 2e quadrimestre")).toBe("Q1+Q2");
    expect(quarterKey("année académique")).toBe("Q1-Q3");
  });

  it("passes an unknown value through rather than dropping it", () => {
    // A third university publishing something new gets its own chip. A thing
    // we cannot classify is still a thing.
    expect(quarterKey("vierde kwartaal")).toBe("vierde kwartaal");
    expect(quarterKey(null)).toBeNull();
  });
});

describe("the language a course is taught in", () => {
  it("gives one key for a name and for a code", () => {
    expect(languageKey("Français")).toBe("fr");
    expect(languageKey("fr")).toBe("fr");
    expect(languageKey("Anglais")).toBe(languageKey("en"));
    expect(languageKey("Neerlandais")).toBe("nl");
  });

  it("takes the primary language when a source qualifies it", () => {
    // UCLouvain qualifies with `>`, ULB names a second with `/`. Both describe
    // one course in one primary language; the rest belongs on the page.
    expect(languageKey("Anglais > Facilités pour suivre le cours en français")).toBe("en");
    expect(languageKey("Français > English-friendly")).toBe("fr");
    expect(languageKey("en/fr")).toBe("en");
  });

  it("passes an unknown language through rather than dropping it", () => {
    expect(languageKey("Klingon")).toBe("Klingon");
    expect(languageKey(null)).toBeNull();
  });

  it("does not collapse two different languages onto one key", () => {
    // The whole point is fewer chips, and the way to get that wrong is to
    // merge things that are not the same.
    const keys = ["Français", "Anglais", "Neerlandais", "Allemand", "Espagnol"].map(languageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/**
 * A COURSE CAN TOUCH TWO TERMS, AND THE CATALOGUE SAYS SO IN FOUR WAYS.
 *
 * Reported from use: a programme listed courses as "term not stated" while
 * the official page plainly said `Q1 et Q2`. Measured across 10,268 cached
 * pages on 2026-09-27: 1,026 say `Q1 et Q2`, 351 `Q1 and Q2`, 143 `Q1 ou Q2`
 * and 55 `Q1 or Q2`. Fifteen hundred pages losing a field they published.
 */
describe("a term that spans or offers a choice", () => {
  it("maps all four spellings onto two canonical values", () => {
    expect(quarterKey("Q1 et Q2")).toBe("Q1+Q2");
    expect(quarterKey("Q1 and Q2")).toBe("Q1+Q2");
    expect(quarterKey("Q1 ou Q2")).toBe("Q1/Q2");
    expect(quarterKey("Q1 or Q2")).toBe("Q1/Q2");
  });

  /**
   * They are NOT the same fact. "Q1 et Q2" is one course running across the
   * year; "Q1 ou Q2" is a course given twice, of which a student takes one.
   * Collapsing them would throw away something the source publishes.
   */
  it("keeps spanning and choosing apart", () => {
    expect(quarterKey("Q1 et Q2")).not.toBe(quarterKey("Q1 ou Q2"));
  });

  it("is unmoved by case and accents, like every other key here", () => {
    expect(quarterKey("q1 ET q2")).toBe("Q1+Q2");
  });

  /**
   * The set is what the filter matches on: a student asking for Q1 courses
   * means every course they could attend in Q1.
   */
  it("reports the individual terms a course touches", () => {
    expect(quarterTerms("Q1")).toEqual(["Q1"]);
    expect(quarterTerms("Q1 et Q2")).toEqual(["Q1", "Q2"]);
    expect(quarterTerms("Q1 ou Q2")).toEqual(["Q1", "Q2"]);
    expect(quarterTerms(null)).toEqual([]);
  });

  it("expands a whole academic year to every term in it", () => {
    expect(quarterTerms("annee academique")).toEqual(["Q1", "Q2", "Q3"]);
  });

  it("never repeats a term", () => {
    expect(quarterTerms("Q2 et Q2")).toEqual(["Q2"]);
  });
});
