/**
 * ULB's course page: the three long fields, and the one deliberately left out.
 *
 * This is the second pass, and the expensive one: one request per course
 * against one per programme, about 5,400 against 286. Everything else a course
 * row carries comes from the listing, which is why a run without this is still
 * a whole catalogue rather than half of one.
 *
 * The fixture is the YEAR-LESS URL, which is the one that works. ULB's URL year
 * and its academic year are different numbers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { blocksToText, parseCourseProse, ulb } from "@studens/ref";

const page = readFileSync(
  new URL("../fixtures/catalogue/ulb-course-page.html", import.meta.url).pathname,
  "utf8",
);

describe("the long fields on a ULB course page", () => {
  const prose = parseCourseProse(page);

  it("reads the content, structured rather than flattened", () => {
    // Blocks, not a string. These are lists written in a rich text editor, and
    // a flattened list of a dozen items is unreadable at this length: the same
    // reasoning as UCLouvain's, and they share the renderer.
    expect(prose.content).not.toBeNull();
    expect(prose.content!.some((b) => b.kind === "list")).toBe(true);
    expect(blocksToText(prose.content!)).toContain("Python");
  });

  it("reads the evaluation, which ULB titles more plainly than UCLouvain", () => {
    expect(prose.assessment).not.toBeNull();
    expect(blocksToText(prose.assessment!)).toMatch(/valuation|examen|Examen/i);
  });

  it("reads the campus, which ULB states per course and UCLouvain does not", () => {
    // ULB is multi-site the way UCLouvain is: Solbosch, Plaine, Erasme,
    // Charleroi. It states it on the COURSE page, under an h3 inside "Autres
    // renseignements", so it is found among siblings and not by position.
    // François, who knows the university, is the reason this exists.
    //
    // A LIST, because a course is regularly taught on more than one. Measured
    // on a 149-course slice: five read "Solbosch, Flagey" and one lists five
    // campuses at once. Stored as one string, each combination becomes its own
    // site and a filter offers "Flagey, Hors campus ULB, Autre campus, Plaine,
    // Solbosch" as a place a student could go.
    expect(prose.campuses).toEqual(["Plaine"]);
  });

  it("leaves the objectives out, rather than putting them in themes", () => {
    // ULB publishes "Objectifs (et/ou acquis d'apprentissages spécifiques)".
    // `themes` is UCLouvain's "Thèmes abordés", the topics a course covers;
    // objectives are what a student should be able to do afterwards. Filing
    // one under the other would make a column mean two things depending on
    // which university the row came from, and nothing on screen would say so.
    //
    // The fixture keeps the section precisely so this can be asserted.
    expect(page).toContain("Objectifs");
    const everything = [prose.content, prose.assessment]
      .filter((b) => b !== null)
      .map((b) => blocksToText(b!))
      .join("\n");
    expect(everything).not.toContain("acquis d'apprentissages");
  });
});

describe("the official link", () => {
  it("carries no year, because ULB's URL year is not its academic year", () => {
    // The pages live under `2025-` while the courses they describe are
    // 2026-2027, so `/fr/programme/2026-info-f101` is a 404. Building the link
    // from the academic year gave every ULB course a link that was dead the
    // moment it shipped. Verified against the live site on info-f101,
    // comm-b1010 and ba-tecn.
    expect(ulb.courseUrl(2026, "info-f101")).toBe("https://www.ulb.be/fr/programme/info-f101");
    expect(ulb.programmeUrl(2026, "ba-tecn")).toBe("https://www.ulb.be/fr/programme/ba-tecn");
    // The year changes nothing, which is the property that survives a rollover.
    expect(ulb.courseUrl(2025, "info-f101")).toBe(ulb.courseUrl(2030, "info-f101"));
  });
});
