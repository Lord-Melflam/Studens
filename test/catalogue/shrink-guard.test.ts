/**
 * THE GUARD THAT STOPS A SAMPLED CRAWL EATING THE CATALOGUE.
 *
 * The hazard was real and every step of it succeeded: `--max 40` wrote
 * `data/catalogue.json`, the same file a full crawl writes and the one
 * `db:load` reads by default, and the load replaced 6,715 courses with 40 in
 * one clean transaction. Nothing was corrupt. Nothing failed.
 *
 * The fix first offered was a line in a runbook, and the right question about
 * it was how anything is actually prevented rather than left to good sense.
 * These are the two answers. The ingest stops producing the hazard, and the
 * load refuses to apply it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHRINK_LIMIT, shrinkMessage, shrinkVerdict } from "@studens/ref";

const root = new URL("../..", import.meta.url).pathname;

describe("replacing a catalogue with a much smaller one", () => {
  it("is refused when most of it would disappear", () => {
    // The case that prompted this: a sampled crawl over a full catalogue.
    const v = shrinkVerdict(6715, 40);
    expect(v.refuse).toBe(true);
    expect(v.lost).toBeGreaterThan(0.99);
  });

  it("is allowed when the catalogue moves the way a real crawl moves", () => {
    // UCLouvain's year on year movement is tens of courses out of thousands.
    for (const after of [6715, 6700, 6600, 6800, 13000]) {
      expect(shrinkVerdict(6715, after).refuse, `${after}`).toBe(false);
    }
  });

  it("never refuses growth, however large", () => {
    expect(shrinkVerdict(10, 100000).refuse).toBe(false);
  });

  it("does not refuse the first load of anything", () => {
    // Every catalogue, and every second institution, arrives against zero.
    expect(shrinkVerdict(0, 5439).refuse).toBe(false);
    expect(shrinkVerdict(0, 0).refuse).toBe(false);
  });

  it("refuses exactly at the stated limit and not before", () => {
    const before = 1000;
    const justUnder = Math.ceil(before * (1 - SHRINK_LIMIT));
    expect(shrinkVerdict(before, justUnder).refuse).toBe(false);
    expect(shrinkVerdict(before, justUnder - 1).refuse).toBe(true);
  });

  it("says the numbers and the way through, not just no", () => {
    // A refusal somebody cannot act on is a refusal they will work around by
    // deleting the check.
    const msg = shrinkMessage(shrinkVerdict(6715, 40), "uclouvain");
    expect(msg).toContain("6715");
    expect(msg).toContain("40");
    expect(msg).toContain("--shrink-ok");
    expect(msg).toContain("--max");
  });
});

describe("a partial crawl does not take the live filename", () => {
  const ingest = readFileSync(root + "apps/worker/src/ingest-catalogue.ts", "utf8");

  it("renames the output when the crawl is sampled or scoped", () => {
    expect(ingest).toContain("args.max !== undefined || args.faculties.length > 0");
    expect(ingest).toContain("-partial.json");
  });

  it("still obeys an explicit --out, which is somebody being deliberate", () => {
    expect(ingest).toContain("args.explicitOut");
  });
});

describe("the load applies the guard before it writes", () => {
  const loader = readFileSync(root + "apps/worker/src/load-catalogue.ts", "utf8");

  it("checks, and can be told the shrink is meant", () => {
    expect(loader).toContain("shrinkVerdict");
    expect(loader).toContain("--shrink-ok");
  });

  it("counts what is already there before replacing it", () => {
    // Against the DATABASE, not against the file it is about to overwrite: the
    // database is what a demonstration is reading from.
    expect(loader).toContain("courseOffering.count");
  });
});
