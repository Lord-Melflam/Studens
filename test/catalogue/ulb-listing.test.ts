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
import { parseCredits, parseListing } from "@studens/ref";

const html = readFileSync(
  new URL("../fixtures/catalogue/ulb-programme-listing.html", import.meta.url).pathname,
  "utf8",
);

describe("a ULB programme listing", () => {
  const courses = parseListing(html);

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
