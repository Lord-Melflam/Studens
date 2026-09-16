/**
 * The crawl, against a fake site. No test touches the network.
 *
 * These are the checks in docs/design/catalogue-ingestion.md section 6:
 * nothing is hardcoded, the chain still works, parse failures are loud, ECTS is
 * present and numeric, and a broken run cannot corrupt the live catalogue.
 */
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  crawl,
  PoliteFetcher,
  promote,
  load,
  SnapshotInvalid,
  type Snapshot,
  BudgetExceeded,
  TooManyUnavailable,
} from "@studens/ref";

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
    /** Exposed so a test can build a fetcher with its own budget or cache. */
    fetchImpl,
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
    // 1 index + 1 search + 3 faculties + 4 programme listing attempts (xprog
    // needs two) + 4 courses.
    //
    // The search costs ONE request for the whole year, not one per faculty:
    // every programme of a year fits in a single response, so asking per
    // faculty would be 21 requests for the same answer. This number is the
    // politeness budget and it is asserted so that growth is deliberate.
    expect(site.fetcher.requestCount).toBe(13);
  });
});

/**
 * THE SECOND SOURCE, and what happens when the two disagree.
 *
 * The index says which programmes exist, because it lists the minors the search
 * drops. The search says what they are, because it publishes as fields what the
 * index only implies inside a title.
 */
describe("reconciling the index with the search application", () => {
  /** One search result row, in the markup the real application emits. */
  function row(code: string, title: string, site: string, domain: string): string {
    return `
      <div class="formation-item">
        <div class="formation-item__left">
          <h2 class="formation-item__title">
            <a href="https://uclouvain.be/prog-${YEAR}-${code}">${title}</a>
          </h2>
          <ul class="formation-item__list">
            <li><i class="bi bi-signpost-split-fill"></i>&nbsp;${site}</li>
            <li><i class="bi bi-mortarboard"></i> ${domain}</li>
          </ul>
        </div>
        <div class="formation-item__right">
          <p class="formation-item__school">Organisé par <strong>ZZZ</strong></p>
        </div>
      </div>`;
  }

  const SEARCH = `https://catalogue-formations.uclouvain.be/fr/search?form%5Bdocument_type%5D=Training&form%5Bacademic_year%5D=${YEAR}&form%5Bsubmit%5D=`;

  it("takes the site and the field of study from the search", async () => {
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite({
        [SEARCH]: row("zprog", "Bachelier en Z", "Charleroi", "Sciences"),
      }).fetcher,
    });
    const z = snap.programmes.find((p) => p.code === "zprog");
    expect(z?.site).toBe("Charleroi");
    expect(z?.domain).toBe("Sciences");
    expect(z?.siteSource).toBe("search");
  });

  it("records a disagreement instead of silently picking a winner", async () => {
    // The fake index titles a programme "Z" with no site; give the search one
    // and a title that states a different one, which is the real shape of the
    // conflict: two UCLouvain pages stating the same fact differently.
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite({
        [`https://uclouvain.be/fr/catalogue-formations/faculte-${YEAR}-zzz`]:
          `<a href="/prog-${YEAR}-zprog">Bachelier en Z (Mons)</a>`,
        [SEARCH]: row("zprog", "Bachelier en Z", "Charleroi", "Sciences"),
      }).fetcher,
    });
    expect(snap.conflicts).toEqual([
      { code: "zprog", field: "site", fromIndex: "Mons", fromSearch: "Charleroi" },
    ]);
    // The search still wins, because it publishes a field and the other is a
    // parse of a name. The losing value is kept rather than thrown away.
    expect(snap.programmes.find((p) => p.code === "zprog")?.site).toBe("Charleroi");
  });

  it("falls back to the title for a programme the search does not cover", async () => {
    // Every minor and every doctorate is in this position: the index lists it
    // and the search does not return it at all.
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite({
        [`https://uclouvain.be/fr/catalogue-formations/faculte-${YEAR}-yyy`]:
          `<a href="/prog-${YEAR}-yprog">Mineure en Y (Tournai)</a>`,
        [SEARCH]: row("zprog", "Bachelier en Z", "Charleroi", "Sciences"),
      }).fetcher,
    });
    const y = snap.programmes.find((p) => p.code === "yprog");
    expect(y?.site).toBe("Tournai");
    expect(y?.siteSource).toBe("title");
    // Nothing invents a field of study for it: the only source that publishes
    // one did not cover this programme.
    expect(y?.domain).toBeNull();
    expect(y?.kind).toBe("mineure");
  });

  /**
   * The search is a separate application on a separate host and can be down on
   * its own. Losing the whole catalogue over the field of study would be the
   * wrong trade, so the crawl continues on the titles alone, which is what it
   * did before the second source existed.
   */
  it("survives the search being unavailable, and says so", async () => {
    const said: string[] = [];
    // fakeSite 404s anything it does not know, and it does not know the search.
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite().fetcher,
      onProgress: (m) => said.push(m),
    });
    expect(snap.programmes).toHaveLength(3);
    expect(snap.programmes.every((p) => p.domain === null)).toBe(true);
    expect(said.some((m) => m.includes("search application could not be read"))).toBe(true);
  });
});

describe("failures are loud", () => {
  it("fails the run when a course page cannot be parsed", async () => {
    // A page whose layout is unrecognisable. NOT a page that merely states no
    // credits: that is understood, and is recorded rather than fatal, which is
    // asserted separately below.
    const site = fakeSite({
      [`https://uclouvain.be/cours-${YEAR}-zaaa1000`]:
        "<html><body><h1>Something else entirely</h1><p>no fields here</p></body></html>",
    });
    await expect(crawl({ year: YEAR, fetcher: site.fetcher })).rejects.toThrow(
      /unrecognised course page layout/,
    );
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

describe("course code validation", () => {
  /**
   * Real shapes, measured from 555 codes discovered on 2026-09-10. The
   * suffixed forms cost a complete 546-course crawl once, because the pattern
   * forbade them.
   */
  const real = ["enano2401", "lbir1111", "lbio1237b", "lbira2110b", "lepl2214a", "lmapr2019a"];
  const notCodes = ["", "x", "lepl", "1503", "not a code", "lepl-1503", "toolongprefix1234"];

  async function promoteWithCode(code: string): Promise<void> {
    const { mkdtemp } = await import("node:fs/promises");
    const dir = await mkdtemp(join(tmpdir(), "studens-code-"));
    const good = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    await promote(
      { ...good, offerings: [{ ...good.offerings[0]!, code }] },
      join(dir, "c.json"),
    );
  }

  it.each(real)("accepts the real code %s", async (code) => {
    await expect(promoteWithCode(code)).resolves.toBeUndefined();
  });

  it.each(notCodes)("rejects %j, which is not a course code", async (code) => {
    await expect(promoteWithCode(code)).rejects.toThrow(/not a plausible course code/);
  });
});

/**
 * THE CEILING ON WHAT THE UNIVERSITY IS ASKED FOR.
 *
 * One faculty is about 600 requests and all 21 are roughly 9,000, so the
 * difference between a scoped run and a full one is a factor of fifteen and the
 * way to discover it should not be a two-hour crawl somebody started by
 * forgetting a flag. robots.txt sets no crawl delay, so every restraint here is
 * self-imposed (design note section 4).
 */
describe("the request budget", () => {
  it("stops the run rather than quietly fetching less", async () => {
    const site = fakeSite();
    const fetcher = new PoliteFetcher({ delayMs: 0, fetchImpl: site.fetchImpl, maxRequests: 3 });
    await expect(crawl({ year: YEAR, fetcher })).rejects.toBeInstanceOf(BudgetExceeded);
    // Exactly the ceiling, never one more: the check runs before the request.
    expect(fetcher.requestCount).toBe(3);
  });

  it("does not count pages the cache served, because they cost nothing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "studens-budget-"));
    try {
      const warm = fakeSite();
      // Fill the cache with a complete run, then allow almost no requests at
      // all. A second run has to finish anyway, on the cache alone.
      await crawl({
        year: YEAR,
        fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: warm.fetchImpl, cacheDir: dir }),
      });
      const cold = fakeSite();
      const fetcher = new PoliteFetcher({
        delayMs: 0,
        fetchImpl: cold.fetchImpl,
        cacheDir: dir,
        maxRequests: 1,
      });
      const snap = await crawl({ year: YEAR, fetcher });
      expect(snap.offerings).toHaveLength(4);
      // The one request is the search, which the warm run could not cache
      // because the fake site answers it with a 404.
      expect(fetcher.requestCount).toBeLessThanOrEqual(1);
      expect(fetcher.cacheHits).toBeGreaterThan(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/**
 * THE GUARD THAT USED TO LIVE IN THE OFFERING PARSER.
 *
 * A selector that stops matching does not blank one course, it blanks the same
 * field on every one, so the evidence is the run and not the page. Checking it
 * per page failed a 969-course crawl over a single course UCLouvain publishes
 * with an empty evaluation field, and could say nothing at all about a field
 * that had quietly disappeared from all of them.
 */
describe("a field that went blank everywhere", () => {
  /** A snapshot of `n` offerings, each one complete unless `blank` names it. */
  function snapshotOf(n: number, blank?: string): Snapshot {
    const offerings = Array.from({ length: n }, (_, i) => ({
      code: `zzzz${1000 + i}`,
      year: YEAR,
      title: `Course ${i}`,
      ects: 5,
      era: "modern",
      language: "fr",
      quarter: "Q1",
      contactHours: "30h",
      owningFaculty: "ZZZ",
      teachers: ["A Teacher"],
      assessment: [{ kind: "text", text: "an exam" }],
      themes: [{ kind: "text", text: "a theme" }],
      content: [{ kind: "text", text: "some content" }],
    })) as unknown as Snapshot["offerings"];
    if (blank) {
      for (const o of offerings) {
        (o as unknown as Record<string, unknown>)[blank] = Array.isArray(
          (o as unknown as Record<string, unknown>)[blank],
        )
          ? []
          : null;
      }
    }
    return {
      version: 8,
      takenAt: new Date().toISOString(),
      year: YEAR,
      faculties: [{ code: "zzz", name: "Zeta" }],
      programmes: [
        {
          code: "zprog",
          faculty: "zzz",
          title: "Z",
          kind: null,
          credits: null,
          site: null,
          domain: null,
          siteSource: null,
          listing: "listed",
          courses: 1,
        },
      ],
      offerings,
      conflicts: [],
      unavailable: [],
      withoutEcts: [],
      reachedVia: [],
    };
  }

  it("is refused, naming the field", async () => {
    const path = await mkdtemp(join(tmpdir(), "studens-blank-"));
    try {
      await expect(promote(snapshotOf(30, "assessment"), join(path, "live.json"))).rejects.toThrow(
        /every one of the 30 offerings is missing "assessment"/,
      );
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });

  it("refuses a snapshot where every offering is worth zero credits", async () => {
    // One zero is a real course. All of them is a parser that has stopped
    // reading the header, and a catalogue of courses apparently worth nothing.
    const path = await mkdtemp(join(tmpdir(), "studens-blank-"));
    try {
      const snap = snapshotOf(30);
      for (const o of snap.offerings) (o as unknown as Record<string, unknown>)["ects"] = 0;
      await expect(promote(snap, join(path, "live.json"))).rejects.toThrow(
        /every one of the 30 offerings has 0 ECTS/,
      );
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });

  it("accepts a snapshot where one offering is worth zero credits", async () => {
    const path = await mkdtemp(join(tmpdir(), "studens-blank-"));
    try {
      const snap = snapshotOf(30);
      (snap.offerings[0] as unknown as Record<string, unknown>)["ects"] = 0;
      await promote(snap, join(path, "live.json"));
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });

  it("stays quiet on a small sample, which is allowed to miss anything", async () => {
    // `--max 10` takes a spread of ten courses. Ten that all happen to lack a
    // field is a sample, not a layout change, so the floor is 25.
    const path = await mkdtemp(join(tmpdir(), "studens-blank-"));
    try {
      await promote(snapshotOf(10, "assessment"), join(path, "live.json"));
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });

  it("accepts a real mixture, where a field is simply absent on some courses", async () => {
    // The normal case, and the one the per-page rule got wrong: in a real EPL
    // crawl the least populated field is filled on 84% of offerings.
    const path = await mkdtemp(join(tmpdir(), "studens-blank-"));
    try {
      const snap = snapshotOf(30);
      (snap.offerings[0] as unknown as Record<string, unknown>)["assessment"] = null;
      await promote(snap, join(path, "live.json"));
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });
});

/**
 * A SERVER HAVING A BAD MINUTE MUST NOT END A NINE-THOUSAND-PAGE CRAWL.
 *
 * `cours-2025-lcems2341` answered 503 three times and then 200, the first
 * attempt taking ten seconds. Nothing was wrong with the page and nothing was
 * wrong with us. Without a retry, one bad minute anywhere ends the run and the
 * catalogue is not updated at all.
 */
describe("transient failures", () => {
  /** Answers `fails` times with `status`, then serves the page. */
  function flaky(status: number, fails: number) {
    let seen = 0;
    const target = `https://uclouvain.be/cours-${YEAR}-zaaa1000`;
    const site = fakeSite();
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      if (String(url) === target) {
        seen += 1;
        if (seen <= fails) return new Response("later", { status });
      }
      return site.fetchImpl(url, init);
    }) as unknown as typeof fetch;
    return { fetchImpl, get attempts() { return seen; } };
  }

  it("asks again after a 503, and finishes", async () => {
    const f = flaky(503, 2);
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: f.fetchImpl, retries: 3 }),
    });
    expect(snap.offerings.map((o) => o.code)).toContain("zaaa1000");
    expect(f.attempts).toBe(3);
  });

  it("gives up once the retries are spent, rather than looping", async () => {
    const f = flaky(503, 99);
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: f.fetchImpl, retries: 2 }),
    });
    // Three attempts and then it stops: the retry is bounded, not a loop.
    expect(f.attempts).toBe(3);
    // And the course is recorded as unavailable rather than ending the run,
    // which is the other half of the same decision: a page we could not get is
    // a course missing, not a catalogue wrong.
    expect(snap.unavailable).toEqual(["zaaa1000"]);
  });

  /**
   * A TIMEOUT CARRIES NO STATUS, and that gap cost a twelve-minute crawl.
   *
   * `AbortSignal.timeout` throws a `TimeoutError`, so the first version of the
   * retry, which looked only at HTTP statuses, let it straight through: a run
   * of 969 course pages died after 750 of them because one page was slow.
   */
  it("asks again after a timeout, which has no status at all", async () => {
    let seen = 0;
    const target = `https://uclouvain.be/cours-${YEAR}-zaaa1000`;
    const site = fakeSite();
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      if (String(url) === target && seen++ < 2) {
        throw Object.assign(new Error("The operation was aborted due to timeout"), {
          name: "TimeoutError",
        });
      }
      return site.fetchImpl(url, init);
    }) as unknown as typeof fetch;

    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl, retries: 3 }),
    });
    expect(snap.offerings.map((o) => o.code)).toContain("zaaa1000");
    expect(seen).toBe(3);
  });

  it("does not ask again about a 404, which is an answer", async () => {
    // Asking twice about a page that is not there is noise, and the crawl
    // already treats a missing programme listing as ordinary.
    const f = flaky(404, 99);
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: f.fetchImpl, retries: 3 }),
    });
    expect(f.attempts).toBe(1);
    expect(snap.unavailable).toEqual(["zaaa1000"]);
  });

  it("counts every attempt against the request budget", async () => {
    // A retry is work the university did, so it is spent from the same purse.
    const f = flaky(503, 1);
    const fetcher = new PoliteFetcher({ delayMs: 0, fetchImpl: f.fetchImpl, retries: 3 });
    await crawl({ year: YEAR, fetcher });
    expect(fetcher.retryCount).toBe(1);
    expect(fetcher.requestCount).toBe(14);
  });
});

/**
 * A PAGE WE COULD NOT GET, AGAINST A PAGE WE COULD NOT UNDERSTAND.
 *
 * `cours-2025-mlsmm2219` answers 503 on every attempt while its 2024 edition is
 * served fine. A crawl of nine thousand pages meets several of those, so ending
 * the run over one means the catalogue can never be updated again. A course
 * missing is not a course wrong, which is what the strict rule is protecting.
 */
describe("courses the university will not serve", () => {
  /** A site where `dead` always answers 503, whatever the retries. */
  function withDead(dead: string[]) {
    const site = fakeSite();
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      if (dead.some((code) => String(url).endsWith(code))) {
        return new Response("gone", { status: 503 });
      }
      return site.fetchImpl(url, init);
    }) as unknown as typeof fetch;
    return fetchImpl;
  }

  it("skips one, records it, and finishes the rest", async () => {
    const said: string[] = [];
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: withDead(["zaaa1000"]), retries: 1 }),
      onProgress: (m) => said.push(m),
    });
    expect(snap.unavailable).toEqual(["zaaa1000"]);
    expect(snap.offerings.map((o) => o.code)).not.toContain("zaaa1000");
    // The other three are still there: one broken page is not a broken run.
    expect(snap.offerings).toHaveLength(3);
    // Written down AND said out loud. A loss nobody mentions is a loss nobody
    // notices.
    expect(said.some((m) => m.includes("would not serve"))).toBe(true);
  });

  it("fails when they are a pattern rather than a few", async () => {
    // Being blocked or rate limited fails everything at once, and a catalogue
    // quietly missing most of its courses is the wrong data the rules refuse.
    // Twenty courses, so the tolerance is a real number rather than the floor.
    const codes = Array.from({ length: 20 }, (_, i) => `zccc${2000 + i}`);
    const site = fakeSite({
      [`https://uclouvain.be/prog-${YEAR}-zprog-programme`]: codes
        .map((c) => `<a href="cours-${YEAR}-${c}">x</a>`)
        .join(""),
      ...Object.fromEntries(
        codes.map((c) => [`https://uclouvain.be/cours-${YEAR}-${c}`, coursePage(`Course ${c}`)]),
      ),
    });
    const dead = new Set(codes.slice(0, 8));
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      if ([...dead].some((c) => String(url).endsWith(c))) {
        return new Response("gone", { status: 503 });
      }
      return site.fetchImpl(url, init);
    }) as unknown as typeof fetch;

    await expect(
      crawl({ year: YEAR, fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl, retries: 0 }) }),
    ).rejects.toBeInstanceOf(TooManyUnavailable);
  });

  it("still refuses a page it fetched and could not read", async () => {
    // The line that matters: a page we could not GET is tolerated, a page we
    // could not UNDERSTAND is not, because that is how wrong data gets in.
    const site = fakeSite({
      [`https://uclouvain.be/cours-${YEAR}-zaaa1000`]: "<html><body>nothing at all</body></html>",
    });
    await expect(crawl({ year: YEAR, fetcher: site.fetcher })).rejects.toThrow(
      /unrecognised course page layout/,
    );
  });
});

/**
 * "NO COURSES" MEANT TWO DIFFERENT THINGS AND SAID NEITHER.
 *
 * 22 of 79 programmes in a real two-faculty crawl had no courses. One of them,
 * `prog-2025-cyse2m`, is a joint master whose courses are hosted by the partner
 * institutions: three pages, all legitimately empty. Another could have been a
 * page that failed to load, which means every one of its courses is missing
 * from Studens. Telling them apart meant opening the site by hand, and that
 * does not scale to 692 programmes.
 */
describe("what happened to a programme's course list", () => {
  it("records a list that was read", async () => {
    const snap = await crawl({ year: YEAR, fetcher: fakeSite().fetcher });
    const z = snap.programmes.find((p) => p.code === "zprog");
    expect(z?.listing).toBe("listed");
    expect(z?.courses).toBe(2);
  });

  it("separates a page that loaded with nothing on it from one that never loaded", async () => {
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite({
        // Loads, and has no course links. A joint programme looks exactly like
        // this, and it is not a problem.
        [`https://uclouvain.be/prog-${YEAR}-zprog-programme`]: "<html><body>nothing here</body></html>",
        [`https://uclouvain.be/prog-${YEAR}-zprog-programme_annual_blocks`]:
          "<html><body>nothing here either</body></html>",
      }).fetcher,
    });
    expect(snap.programmes.find((p) => p.code === "zprog")?.listing).toBe("empty");
    // yprog's pages are absent from the fake site entirely, so nothing loaded.
    // That is the one that means a student will not find their course.
    const y = snap.programmes.find((p) => p.code === "yprog");
    expect(y?.listing).toBe("listed");
  });

  it("marks a programme unreachable when no listing page loads at all", async () => {
    const said: string[] = [];
    const snap = await crawl({
      year: YEAR,
      fetcher: fakeSite({
        [`https://uclouvain.be/prog-${YEAR}-yprog-programme`]: 503,
        [`https://uclouvain.be/prog-${YEAR}-yprog-programme_annual_blocks`]: 503,
      }).fetcher,
      onProgress: (m) => said.push(m),
    });
    expect(snap.programmes.find((p) => p.code === "yprog")?.listing).toBe("unreachable");
    expect(snap.programmes.find((p) => p.code === "yprog")?.courses).toBe(0);
    // Said out loud as well as written down: a loss nobody mentions is a loss
    // nobody notices until a student does.
    expect(said.some((m) => m.includes("could not be read"))).toBe(true);
  });
});

/**
 * A COURSE THE CATALOGUE PUBLISHES WITH NO CREDITS AT ALL.
 *
 * `cours-2026-wbcmm21021`, "Séminaires de biologie clinique", is a real
 * post-graduate seminar whose page carries the word "crédit" nowhere. Ten of
 * the 6,654 courses in 2026-2027 are that family. The page is understood
 * perfectly, so this is not a parse failure, and RYC measures workload against
 * credits (FR-D6), so the course cannot carry the dimension the module exists
 * to collect. Skipped and recorded rather than stored with an invented zero.
 */
describe("courses published without credits", () => {
  function withoutCredits(codes: string[]) {
    const site = fakeSite();
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      if (codes.some((c) => String(url).endsWith(c))) {
        return new Response(
          '<html><body><div class="fa_cell_0">18.0 h</div><h1>A seminar</h1>' +
            '<div class="fa_row"><div class="fa_cell_1">Contenu</div>' +
            '<div class="fa_cell_2">y</div></div></body></html>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return site.fetchImpl(url, init);
    }) as unknown as typeof fetch;
    return fetchImpl;
  }

  it("records the course and finishes the run", async () => {
    const said: string[] = [];
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: withoutCredits(["zaaa1000"]) }),
      onProgress: (m) => said.push(m),
    });
    expect(snap.withoutEcts).toEqual(["zaaa1000"]);
    expect(snap.offerings.map((o) => o.code)).not.toContain("zaaa1000");
    expect(snap.offerings).toHaveLength(3);
    expect(said.some((m) => m.includes("without credits"))).toBe(true);
  });

  it("is not the same thing as a page that could not be served", async () => {
    // Three categories, deliberately: served and understood, served and not
    // understood, and not served at all. Only the middle one is fatal.
    const snap = await crawl({
      year: YEAR,
      fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl: withoutCredits(["zaaa1000"]) }),
    });
    expect(snap.unavailable).toEqual([]);
  });

  it("still fails on a page it fetched and could not read", async () => {
    const site = fakeSite({
      [`https://uclouvain.be/cours-${YEAR}-zaaa1000`]: "<html><body>nothing at all</body></html>",
    });
    await expect(crawl({ year: YEAR, fetcher: site.fetcher })).rejects.toThrow(
      /unrecognised course page layout/,
    );
  });
});
