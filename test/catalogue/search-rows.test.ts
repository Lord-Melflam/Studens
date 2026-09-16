/**
 * Reading the catalogue search application's result rows.
 *
 * The fixture is a verbatim slice of
 * `catalogue-formations.uclouvain.be/fr/search` for EPL in 2025-2026, fetched
 * 2026-09-16. Five real rows, chosen because they are the cases that matter:
 * `sinc1ba` and `sinf1ba` are the SAME title in two different cities, which is
 * the whole reason the site has to be data, and `cyse2m` sits at "Autre site",
 * which is a published value and not a missing one.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSearchRows, slug } from "@studens/ref";

const html = readFileSync(
  new URL("../fixtures/catalogue/search-training.html", import.meta.url),
  "utf8",
);
const rows = parseSearchRows(html, "programme", 2025);
const by = (code: string) => rows.find((r) => r.code === code);

describe("the search rows", () => {
  it("finds every programme on the page, once", () => {
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.code)).size).toBe(5);
  });

  it("reads the site, which is the field no programme page states", () => {
    // The same bachelor, in two cities. Told apart by nothing else.
    expect(by("sinc1ba")?.site).toBe("Charleroi");
    expect(by("sinf1ba")?.site).toBe("Louvain-la-Neuve");
    expect(by("sinc1ba")?.title).toBe(by("sinf1ba")?.title);
  });

  it("keeps a published site that means 'not one of the eight'", () => {
    // "Autre site" is an answer UCLouvain publishes. Turning it into null would
    // lose the difference between a site we could not read and one they state.
    expect(by("cyse2m")?.site).toBe("Autre site");
  });

  it("reads the field of study, decoding what the markup escapes", () => {
    expect(by("fsa1ba")?.domain).toBe("Sciences de l'ingénieur et technologie");
    expect(by("sinf1ba")?.domain).toBe("Sciences");
  });

  it("reads the organising faculty and the language", () => {
    expect(by("fsa1ba")?.faculty).toBe("EPL");
    expect(by("fsa1ba")?.language).toBe("FR");
  });

  it("ignores links to another year, which the page chrome carries", () => {
    expect(parseSearchRows(html, "programme", 2024)).toEqual([]);
  });

  it("ignores rows of the other document type", () => {
    // One page holds one type. Asking for courses on a programme page must
    // return nothing rather than misreading the rows it does have.
    expect(parseSearchRows(html, "course", 2025)).toEqual([]);
  });

  /**
   * An empty page is not an error here, unlike the link extractor. A faculty
   * that offers no programme of a given type is a real answer, and the caller
   * knows what it asked for.
   */
  it("returns nothing for a page with no results, without throwing", () => {
    expect(parseSearchRows("<html><body>no results</body></html>", "programme", 2025)).toEqual([]);
  });
});

describe("the slug", () => {
  it("is stable, and folds the accents UCLouvain spells both ways", () => {
    expect(slug("Louvain-la-Neuve")).toBe("louvain-la-neuve");
    expect(slug("Bruxelles Saint-Louis")).toBe("bruxelles-saint-louis");
    expect(slug("Autre site")).toBe("autre-site");
    expect(slug("Sciences de l'ingénieur et technologie")).toBe(
      "sciences-de-l-ingenieur-et-technologie",
    );
    // The same label with and without its accent has to land on one row.
    expect(slug("Liège")).toBe(slug("Liege"));
  });
});
