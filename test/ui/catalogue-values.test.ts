/**
 * A catalogue value on screen reads in the language of the page.
 *
 * NOT THE SAME AS A COURSE TITLE. A title is catalogue prose and there is
 * often no translation to be had, which is what OPEN-47 is about and why the
 * page marks the language of each field rather than pretending. A teaching
 * language and a term are different: both are closed sets, both mean the same
 * thing in every language, and the platform can already name one of them.
 * Printing them as the university published them put French words in a Dutch
 * sentence for no reason anybody chose.
 */
import { describe, expect, it } from "vitest";
import { LOCALES } from "@studens/i18n";
import { languageName, quarterKey } from "@studens/ryc-ui";

describe("a row speaks the reader's language, not the catalogue's", () => {
  /**
   * WHAT WAS ON SCREEN. A Dutch course list said "5 studiepunten · Q1 ·
   * Anglais", and an English one "5 ECTS · Q1 · Anglais". The chrome around
   * the value was translated and the value was not, which is the same shape as
   * the pass band: a fact stored as one language's words and printed raw.
   *
   * It is not the same as a course TITLE, which is catalogue prose with no
   * translation to be had. A teaching language is a closed set that the
   * platform can already name in any locale, and the filter beside the row was
   * already doing it.
   */
  it("names the teaching language in the language being read", () => {
    expect(languageName("Anglais", "nl")).toBe("Engels");
    expect(languageName("Anglais", "en")).toBe("English");
    expect(languageName("Anglais", "fr")).toBe("Anglais");
    expect(languageName("Français", "nl")).toBe("Frans");
    // ULB publishes a code where UCLouvain publishes a word. Same answer.
    expect(languageName("en", "nl")).toBe("Engels");
    expect(languageName("fr", "en")).toBe("French");
  });

  it("reads the primary language when the university qualifies it", () => {
    // 603 courses are published as "Anglais > Facilités pour suivre le cours
    // en français", and 320 as "Français > English-friendly".
    expect(languageName("Anglais > Facilités pour suivre le cours en français", "nl")).toBe(
      "Engels",
    );
    expect(languageName("Français > English-friendly", "en")).toBe("French");
    expect(languageName("en/fr", "nl")).toBe("Engels");
  });

  it("keeps the published words when there is no better name", () => {
    // Belgian French Sign Language has no name in Intl. Its own words beat a
    // bare code in front of a student.
    const signed = "Langue des signes de Belgique francophone";
    for (const l of LOCALES) expect(languageName(signed, l)).toBe(signed);
    expect(languageName("Klingon", "nl")).toBe("Klingon");
  });

  it("says nothing when the catalogue says nothing", () => {
    for (const l of LOCALES) expect(languageName(null, l)).toBeNull();
  });

  it("shows a term that names two of them without picking a language", () => {
    // "Q1 et Q2" is the French edition's wording and "Q1 and Q2" the English
    // one. Both are the same fact and neither belongs on a Dutch page.
    expect(quarterKey("Q1 et Q2")).toBe("Q1+Q2");
    expect(quarterKey("Q1 and Q2")).toBe("Q1+Q2");
    expect(quarterKey("Q1 ou Q2")).toBe("Q1/Q2");
    expect(quarterKey("Q1")).toBe("Q1");
    expect(quarterKey(null)).toBeNull();
  });
});
