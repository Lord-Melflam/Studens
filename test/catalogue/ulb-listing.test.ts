/**
 * ULB's programme listing, against a captured response.
 *
 * The fixture is a real one, trimmed: `test/fixtures/catalogue/ulb-programme-listing.html`,
 * which is the `html` field of what `/api/formation` answers for `BA-TECN`.
 * Offline on purpose, like every other parser test here: a test that needs a
 * university to be up tells you about the university.
 *
 * What is being pinned is that ULB's listing is a richer source than its course
 * pages. Everything a course row needs except the long prose is in it, which is
 * why the crawl is one request per programme and not one per course.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  defaultYearFrom,
  isPlaceholderCode,
  parseCredits,
  parseListing,
  parseListingFully,
} from "@studens/ref";

const html = readFileSync(
  new URL("../fixtures/catalogue/ulb-programme-listing.html", import.meta.url).pathname,
  "utf8",
);

describe("a ULB programme listing", () => {
  const courses = parseListing(html, 2025);

  it("finds every course item, and each one once", () => {
    expect(courses.map((c) => c.code)).toEqual(["comm-b1010", "comm-b1020", "comm-b3010"]);
  });

  it("reads the whole row, not just the code", () => {
    // The point of the listing: this is one request's worth of a course, and
    // only the long prose is missing from it.
    expect(courses[0]).toEqual({
      code: "comm-b1010",
      title: "Cultures numériques",
      language: "fr",
      quarter: "premier quadrimestre",
      teachers: ["Nom Prenom"],
      ects: 5,
      contactHours: "cours magistral: 24h",
    });
  });

  it("keeps the quadrimester out of the contact hours", () => {
    // ULB prints it twice, once as its own element and once inside the credits
    // line. Read naively, the second copy lands in the teaching hours.
    expect(courses[0]?.contactHours).not.toMatch(/quadrimestre/);
    expect(courses[1]?.quarter).toBe("deuxième quadrimestre");
  });

  it("skips a row ULB lists with no title and no other field", () => {
    // NOT the same as a course with no credits, which is kept (design 12.8).
    // Dropping one of those loses the thirty fields the source does publish;
    // here the source publishes nothing at all. Keeping it would put a course
    // in the catalogue that no reader can identify and no reviewer can
    // recognise. 134 such rows in the full 2025 crawl, 42 distinct, out of
    // 62,707, and not one carries a credit, an hour, a language or a lecturer.
    //
    // It failed the whole crawl before this: the snapshot validator refused
    // "edph-i9206: empty title" after 286 programmes had been fetched.
    expect(courses.map((c) => c.code)).not.toContain("edph-i9206");
  });

  it("says which codes it skipped, and why, rather than dropping them in silence", () => {
    expect(parseListingFully(html, 2025).skipped).toEqual([
      { code: "edph-i9206", reason: "no title" },
    ]);
  });

  it("skips a slot that is not a course", () => {
    // `HULB-0000` is "Cours externe à l'Université" and `TEMP-0000` is "Cours
    // extérieurs au programme": allowances, a way of saying "spend this many
    // credits outside the programme". 374 rows across the 2025 crawl, with
    // credits from 5 to 60 depending on where they sit.
    //
    // They cannot be kept. A code is unique within a catalogue, so 374 rows
    // would collapse into one course carrying whichever credit figure was
    // written last, and nobody can review a thing nobody took.
    expect(isPlaceholderCode("hulb-0000")).toBe(true);
    expect(isPlaceholderCode("temp-0000")).toBe(true);
    expect(isPlaceholderCode("comm-b1010")).toBe(false);
    expect(isPlaceholderCode("lepl1503")).toBe(false);
  });

  it("keeps a course ULB names no lecturer for", () => {
    // 13 of the 34 courses in this programme have a `prg-coursTitulaires`
    // element that is present and empty: ULB states nobody. That is the source
    // saying "none", not a parse finding nothing, and the difference is the
    // one this project keeps insisting on. The course stays, with everything
    // else the row publishes.
    const none = courses.find((c) => c.code === "comm-b3010");
    expect(none?.teachers).toEqual([]);
    expect(none?.ects).not.toBeNull();
    expect(none?.title).not.toBe("");
  });

  it("drops the role and keeps the name", () => {
    // ULB writes "Name (Coordonnateur)". The role belongs to the programme,
    // not to the person, and the same cut is made on UCLouvain's pages.
    expect(courses[0]?.teachers).toEqual(["Nom Prenom"]);
  });
});

describe("the credits line", () => {
  it("reads both halves, and either without the other", () => {
    expect(parseCredits("5 crédits [cours magistral: 24h]")).toEqual({
      ects: 5,
      contactHours: "cours magistral: 24h",
    });
    expect(parseCredits("10 crédits")).toEqual({ ects: 10, contactHours: null });
    expect(parseCredits("[travaux pratiques: 12h]")).toEqual({
      ects: null,
      contactHours: "travaux pratiques: 12h",
    });
  });

  it("states no credits rather than inventing zero", () => {
    // A field the source omits is a fact to record, never a course to lose and
    // never a zero to show as if it were published. Design 12.8, and it is the
    // same rule whichever university the page came from.
    expect(parseCredits("").ects).toBeNull();
    expect(parseCredits("quelques crédits").ects).toBeNull();
  });

  it("accepts a decimal written with a comma, as a French page writes it", () => {
    expect(parseCredits("2,5 crédits").ects).toBe(2.5);
  });
});

describe("a listing that holds more than one academic year", () => {
  const both = readFileSync(
    new URL("../fixtures/catalogue/ulb-listing-two-years.html", import.meta.url).pathname,
    "utf8",
  );

  it("takes only the year asked for", () => {
    // The endpoint answers with every year it has. Read without filtering,
    // 48 course items for 2025-2026 and 42 for 2026-2027 were all filed as one
    // year, and a code in both kept whichever came first.
    const y2025 = parseListing(both, 2025);
    const y2026 = parseListing(both, 2026);
    expect(y2025).toHaveLength(1);
    expect(y2026).toHaveLength(1);
    expect(y2025[0]?.code).not.toBe("");
    // The same course in both years is one row per year, not one row.
    expect(parseListing(both, 2024)).toHaveLength(0);
  });

  it("reads ULB's own answer to which year is current", () => {
    // From the metadata beside the HTML: {"default":"a2026",...}. Read rather
    // than worked out from a date, and rather than taken from the sitemap,
    // which lists only the 2025 URLs while the responses behind them already
    // carry 2026.
    expect(defaultYearFrom('{"default":"a2026","anacs":[]}')).toBe(2026);
    expect(defaultYearFrom(undefined)).toBeNull();
    expect(defaultYearFrom("{}")).toBeNull();
  });
});

