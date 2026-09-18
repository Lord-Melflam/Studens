/**
 * ULB's programme page, and the two things it is read for.
 *
 * Its faculties, which nothing else on the site indexes, and its organisers,
 * which mix those faculties with partner universities and hautes écoles.
 *
 * Every case here was found by running the crawl against the live site, not by
 * reading the markup. Three of them were wrong on the first try and none of
 * the three failed loudly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  facultyOf,
  kindFromCode,
  latestYearIn,
  listingUrl,
  normaliseName,
  parseFaculties,
  parseProgramme,
  programmeCodeFrom,
  programmeUrlsFrom,
} from "@studens/ref";

const page = readFileSync(
  new URL("../fixtures/catalogue/ulb-programme-page.html", import.meta.url).pathname,
  "utf8",
);

describe("ULB's faculties, discovered from ULB", () => {
  const faculties = parseFaculties(page);

  it("finds them all, with their own codes", () => {
    // The code is the subdomain each one links to: ULB's handle, not ours.
    expect(faculties).toHaveLength(12);
    expect(faculties.map((f) => f.code)).toContain("ltc");
    expect(faculties.find((f) => f.code === "ltc")?.name).toBe(
      "Faculté de Lettres, Traduction et Communication",
    );
  });

  it("costs no request, because every page carries the list", () => {
    // Stated as a test because it is the reason the crawl is one request per
    // programme rather than two.
    expect(parseFaculties(page).length).toBeGreaterThan(0);
  });
});

describe("telling an ULB faculty from a partner", () => {
  const faculties = parseFaculties(page);

  it("picks the faculty out of a list that also names other universities", () => {
    const p = parseProgramme(page, "ba-tecn", faculties);
    expect(p.organisers.length).toBeGreaterThan(1);
    expect(p.organisers).toContain("Université Catholique de Louvain");
    expect(p.faculty).toBe("ltc");
  });

  it("matches across a curly apostrophe and a capital letter", () => {
    // NOT TIDINESS. The footer writes "Sciences de l’Éducation" and the
    // programme page writes "Sciences de l'Education"; the footer writes
    // "Motricité humaine" and the page writes "motricité humaine". Without
    // normalising, two whole faculties matched nothing and twelve programmes
    // of eighty were filed under none, plausibly and wrongly.
    expect(facultyOf(["Faculté de Psychologie, des Sciences de l'Education et de Logopédie"], faculties)).toBe("psycho");
    expect(facultyOf(["Faculté des Sciences de la motricité humaine"], faculties)).toBe("fsm");
    expect(normaliseName("Faculté de Psychologie, des Sciences de l’Éducation")).toBe(
      normaliseName("Faculte de Psychologie, des Sciences de l'Education"),
    );
  });

  it("says none rather than guessing when no organiser is a faculty", () => {
    // "Pôle éducation" and the hautes écoles are real organisers and are not
    // ULB faculties. Null is the answer; inventing a faculty row for a haute
    // école would write something false to keep a column NOT NULL.
    expect(facultyOf(["Pôle éducation", "Haute Ecole Francisco Ferrer"], faculties)).toBeNull();
    expect(facultyOf([], faculties)).toBeNull();
  });
});

describe("which block the course list comes from", () => {
  it("takes the programme block, not the admission conditions", () => {
    // A programme page carries two `js-formation-ulb` blocks. Taking the first
    // fetched /ksup/accesscond, which answers 200 with good JSON containing no
    // courses, so all 286 programmes read as "empty" and nothing looked
    // broken. A wrong endpoint that succeeds is worse than one that fails.
    const p = parseProgramme(page, "ba-tecn", parseFaculties(page));
    expect(p.listingPath).toContain("/ksup/programme");
    expect(p.listingPath).not.toContain("accesscond");
  });

  it("builds the endpoint from what the page published, not from the code", () => {
    // Building `anet` from the programme code assumed `2025-ba-biolb` means
    // `BA-BIOLB`. Two programmes in a trial crawl answered 404 and lost their
    // course lists to that assumption.
    const url = listingUrl("/ksup/programme?gen=prod&anet=BA-TECN&lang=fr&");
    expect(url).toContain("/api/formation?path=");
    expect(decodeURIComponent(new URL(url).searchParams.get("path") ?? "")).toBe(
      "/ksup/programme?gen=prod&anet=BA-TECN&lang=fr&",
    );
  });
});

describe("what a ULB code says", () => {
  it("reads the kind out of the identifier, where ULB puts it", () => {
    // UCLouvain writes the kind into the name and has to be parsed out of it.
    // ULB writes it into the code.
    expect(kindFromCode("ba-tecn")).toEqual({ kind: "bachelier", credits: 180 });
    expect(kindFromCode("ma-inge")).toEqual({ kind: "master", credits: 120 });
    expect(kindFromCode("ma60-es3sh")).toEqual({ kind: "master", credits: 60 });
  });

  it("keeps a null for a prefix it does not know", () => {
    // `poli4` and `capaes` are real and this does not know what they are.
    // Guessing would put a word in a column a filter then offers as published.
    expect(kindFromCode("poli4-x")).toEqual({ kind: null, credits: null });
    expect(kindFromCode("capaes-y")).toEqual({ kind: null, credits: null });
  });
});

describe("finding the programmes at all", () => {
  const sitemap = `<urlset>
    <url><loc>https://www.ulb.be/fr/programme/2025-ba-tecn</loc></url>
    <url><loc>https://www.ulb.be/en/programme/2025-ba-tecn</loc></url>
    <url><loc>https://www.ulb.be/fr/programme/2026-ba-tecn</loc></url>
    <url><loc>https://www.ulb.be/fr/programme/fc-429</loc></url>
    <url><loc>https://www.ulb.be/fr/vie-sur-les-campus</loc></url>
  </urlset>`;

  it("takes one year and one language", () => {
    expect(programmeUrlsFrom(sitemap, 2025)).toEqual([
      "https://www.ulb.be/fr/programme/2025-ba-tecn",
    ]);
  });

  it("finds the most recent year rather than assuming today's", () => {
    // ULB publishes next year's programmes before the year starts, exactly as
    // UCLouvain does, so a date is not an answer.
    expect(latestYearIn(sitemap)).toBe(2026);
    expect(latestYearIn("<urlset></urlset>")).toBeNull();
  });

  it("reads the year and code out of a programme URL", () => {
    expect(programmeCodeFrom("https://www.ulb.be/fr/programme/2025-ma60-es3sh")).toEqual({
      year: 2025,
      code: "ma60-es3sh",
    });
    expect(programmeCodeFrom("https://www.ulb.be/fr/vie-sur-les-campus")).toBeNull();
  });
});
