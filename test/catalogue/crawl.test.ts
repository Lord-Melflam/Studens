/**
 * The crawl, against a fake site. No test touches the network.
 *
 * These are the checks in docs/design/catalogue-ingestion.md section 6:
 * nothing is hardcoded, the chain still works, parse failures are loud, ECTS is
 * present and numeric, and a broken run cannot corrupt the live catalogue.
 */
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { crawl, PoliteFetcher, promote, load, SnapshotInvalid, type Snapshot, ParseError } from "@studens/ref";

const YEAR = 2025;

function coursePage(title: string, ects = "5.00"): string {
  return `<html><body><h1>${title}</h1>
    <div class="row fa_row_1"><div class="fa_cell_0">${ects} cr&eacute;dits</div>
    <div class="fa_cell_0">15.0 h</div><div class="fa_cell_0">Q1</div></div>
    <div class="row fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">x</div></div>
  </body></html>`;
}

/**
 * A fake UCLouvain with THREE faculties, one programme each, two courses each.
 * The faculty codes are invented on purpose: if the crawl had a real list of
 * faculties baked in, it would find none of these and the test would fail.
 * That is what makes this a behavioural check of the no-hardcoding rule rather
 * than a source-text one.
 */
function fakeSite(overrides: Record<string, string | number> = {}) {
  const pages: Record<string, string | number> = {
    [`https://uclouvain.be/fr/catalogue-formations/formations-par-faculte-${YEAR}`]: `
      <a href="/fr/catalogue-formations/faculte-${YEAR}-zzz">Zeta</a>
      <a href="/fr/catalogue-formations/faculte-${YEAR}-yyy">Ypsilon</a>
      <a href="/fr/catalogue-formations/faculte-${YEAR}-xxx">Xi</a>`,
    [`https://uclouvain.be/fr/catalogue-formations/faculte-${YEAR}-zzz`]: `<a href="/prog-${YEAR}-zprog">Z</a>`,
    [`https://uclouvain.be/fr/catalogue-formations/faculte-${YEAR}-yyy`]: `<a href="/prog-${YEAR}-yprog">Y</a>`,
    [`https://uclouvain.be/fr/catalogue-formations/faculte-${YEAR}-xxx`]: `<a href="/prog-${YEAR}-xprog">X</a>`,
    [`https://uclouvain.be/prog-${YEAR}-zprog-programme`]: `<a href="cours-${YEAR}-zaaa1000">a</a><a href="/cours-${YEAR}-zbbb1001">b</a>`,
    [`https://uclouvain.be/prog-${YEAR}-yprog-programme`]: `<a href="cours-${YEAR}-yaaa2000">c</a>`,
    // A course shared between two faculties: many-to-many, verified below.
    [`https://uclouvain.be/prog-${YEAR}-xprog-programme_annual_blocks`]: `<a href="cours-${YEAR}-yaaa2000">c</a><a href="cours-${YEAR}-xaaa3000">d</a>`,
    [`https://uclouvain.be/cours-${YEAR}-zaaa1000`]: coursePage("Course A"),
    [`https://uclouvain.be/cours-${YEAR}-zbbb1001`]: coursePage("Course B", "3.00"),
    [`https://uclouvain.be/cours-${YEAR}-yaaa2000`]: coursePage("Course C"),
    [`https://uclouvain.be/cours-${YEAR}-xaaa3000`]: coursePage("Course D"),
    ...overrides,
  };

  let calls = 0;
  const fetchImpl = (async (url: string | URL) => {
    calls += 1;
    const body = pages[String(url)];
    if (body === undefined) return new Response("nope", { status: 404 });
    if (typeof body === "number") return new Response("boom", { status: body });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;

  return {
    fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl }),
    get calls() {
      return calls;
    },
  };
}

describe("the chain is discovered, not configured", () => {
  it("finds faculties it could not possibly have had a list of", async () => {
    const site = fakeSite();
    const snap = await crawl({ year: YEAR, fetcher: site.fetcher });
    // Names come from the link text, which ref.Faculty needs.
    expect(snap.faculties.find((f) => f.code === "zzz")?.name).toBe("Zeta");
    expect(snap.faculties.map((f) => f.code).sort()).toEqual(["xxx", "yyy", "zzz"]);
  });

  it("walks through to the offerings", async () => {
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    expect(snap.programmes).toHaveLength(3);
    expect(snap.offerings.map((o) => o.code).sort()).toEqual([
      "xaaa3000",
      "yaaa2000",
      "zaaa1000",
      "zbbb1001",
    ]);
  });

  it("records a course reached through more than one faculty (many-to-many)", async () => {
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    const shared = snap.reachedVia.filter((r) => r.code === "yaaa2000").map((r) => r.faculty);
    expect(shared.sort()).toEqual(["xxx", "yyy"]);
  });

  it("reads ECTS as a number on every offering", async () => {
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    for (const o of snap.offerings) expect(typeof o.ects).toBe("number");
    expect(snap.offerings.find((o) => o.code === "zbbb1001")!.ects).toBe(3);
  });

  it("can be scoped to one faculty without hardcoding which", async () => {
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher, onlyFaculties: ["zzz"] });
    expect(snap.faculties.map((f) => f.code)).toEqual(["zzz"]);
    expect(snap.offerings).toHaveLength(2);
  });

  it("refuses a scope that matches nothing, rather than crawling everything", async () => {
    await expect(
      crawl({ year: YEAR, fetcher: fakeSite().fetcher, onlyFaculties: ["nosuchfaculty"] }),
    ).rejects.toThrow(/none of the requested faculties/);
  });

  it("matches course hrefs with and without a leading slash", async () => {
    // Reality is inconsistent: the faculty index links "/prog-2025-x" while a
    // programme listing links "cours-2025-x" with no slash. The fake site
    // deliberately serves both forms, because a fixture that only used the
    // tidy form is what let this bug reach a live run.
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    expect(snap.offerings.map((o) => o.code).sort()).toEqual([
      "xaaa3000",
      "yaaa2000",
      "zaaa1000",
      "zbbb1001",
    ]);
  });

  it("falls back to the bachelor-only listing suffix when the first is absent", async () => {
    // xprog is served ONLY on -programme_annual_blocks in the fake site, so the
    // course it lists can be reached only if the fallback works.
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    expect(snap.offerings.map((o) => o.code)).toContain("xaaa3000");
  });

  it("is serial, never parallel", async () => {
    const site = fakeSite();
    await crawl({ year: YEAR, fetcher: site.fetcher });
    // 1 index + 3 faculties + 4 programme listing attempts (xprog needs two)
    // + 4 courses
    expect(site.fetcher.requestCount).toBe(12);
  });
});

describe("failures are loud", () => {
  it("fails the run when a course page cannot be parsed", async () => {
    const site = fakeSite({
      [`https://uclouvain.be/cours-${YEAR}-zaaa1000`]:
        '<html><body><h1>No credits here</h1><div class="fa_cell_0">Q1</div>' +
        '<div class="row fa_row"><div class="fa_cell_1">Contenu</div><div class="fa_cell_2">x</div></div></body></html>',
    });
    await expect(crawl({ year: YEAR, fetcher: site.fetcher })).rejects.toThrow(ParseError);
  });

  it("fails when the faculty index yields nothing", async () => {
    const site = fakeSite({
      [`https://uclouvain.be/fr/catalogue-formations/formations-par-faculte-${YEAR}`]:
        "<html><body>site redesigned</body></html>",
    });
    await expect(crawl({ year: YEAR, fetcher: site.fetcher })).rejects.toThrow(/faculty links/);
  });
});

describe("a broken run cannot corrupt the live catalogue", () => {
  async function livePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "studens-live-"));
    return join(dir, "catalogue.json");
  }

  it("promotes a good snapshot", async () => {
    const path = await livePath();
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    await promote(snap, path);
    expect((await load(path)).offerings).toHaveLength(4);
  });

  it("leaves the previous snapshot untouched when the new one is invalid", async () => {
    const path = await livePath();
    const good = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    await promote(good, path);

    const broken: Snapshot = { ...good, offerings: [] };
    await expect(promote(broken, path)).rejects.toThrow(SnapshotInvalid);

    // The live file must still be the good one, not empty and not half written.
    const still = await load(path);
    expect(still.offerings).toHaveLength(4);
    expect(JSON.parse(await readFile(path, "utf8")).takenAt).toBe(good.takenAt);
  });

  it("refuses a snapshot whose offering year disagrees with the run", async () => {
    const path = await livePath();
    const good = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    const mismatched: Snapshot = {
      ...good,
      offerings: good.offerings.map((o) => ({ ...o, year: 1999 })),
    };
    await expect(promote(mismatched, path)).rejects.toThrow(/does not match the snapshot year/);
  });

  it("refuses a snapshot with an implausible course code", async () => {
    const path = await livePath();
    const good = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    const bad: Snapshot = {
      ...good,
      offerings: [{ ...good.offerings[0]!, code: "not a code" }],
    };
    await expect(promote(bad, path)).rejects.toThrow(/not a plausible course code/);
  });

  it("refuses a file that cannot be re-read as a snapshot", async () => {
    const path = await livePath();
    await writeFile(path, "{ not json", "utf8");
    await expect(load(path)).rejects.toThrow();
  });
});
