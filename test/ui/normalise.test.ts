/**
 * TWO UNIVERSITIES, ONE CHIP.
 *
 * The filter panel offered "premier quadrimestre" and "Q1" as separate
 * choices, and "Français" beside "fr". Picking one silently excluded the other
 * university's courses, which is a filter answering a question wrongly rather
 * than a cosmetic duplicate.
 */
import { describe, expect, it } from "vitest";
import { languageKey, quarterKey } from "@studens/ryc-ui";

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
