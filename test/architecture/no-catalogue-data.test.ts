/**
 * THE CRAWL'S RESULTS DO NOT GO IN THE REPOSITORY.
 *
 * The repository is public and now AGPL, which is a deliberate choice about
 * the CODE (requirements.md 7, OPEN-18). The catalogue is a different thing:
 * it is derived from two universities' websites, it took weeks of crawler
 * defects to make reliable, and it goes stale. François, asking for this
 * check: "crawler took too much time and logic, so we won't want the results
 * of it to just be there for everyone."
 *
 * `data/` is in .gitignore, which is the intent. This is the mechanism, for
 * the same reason the shrink guard exists: a rule nobody enforces is a rule
 * that holds until the first `git add -f` or the first person who moves a
 * snapshot somewhere .gitignore does not cover.
 *
 * WHAT IS ALLOWED, and it is the whole subtlety: a handful of SMALL fixtures
 * of real pages, because a parser test against invented HTML tests the
 * invention. They are capped here by size and by how many courses they carry,
 * so a fixture cannot quietly grow into a copy of the catalogue.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const root = new URL("../..", import.meta.url).pathname;

function tracked(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((f) => f !== "");
}

/** Course codes, in either university's shape: LEPL1503 or info-f101. */
const COURSE_CODE = /\b([A-Za-z]{4}\d{4}|[a-z]{3,5}-[a-z]\d{3})\b/g;

/** A fixture may hold a page or two, never a catalogue. */
const MAX_FIXTURE_BYTES = 60_000;
const MAX_FIXTURE_COURSES = 40;

describe("no crawled catalogue reaches the public repository", () => {
  const files = tracked();

  it("tracks nothing under data/", () => {
    expect(files.filter((f) => f.startsWith("data/"))).toEqual([]);
  });

  it("tracks no snapshot, cache or dump, whatever it is called", () => {
    const shapes = /(catalogue.*\.json|snapshot.*\.json|page-cache|\.ndjson$|\.dump$|\.sql\.gz$)/i;
    // Migrations are SQL we wrote and must stay.
    const found = files.filter((f) => shapes.test(f) && !f.startsWith("prisma/migrations/"));
    expect(found, "the crawl's output belongs in data/, which is ignored").toEqual([]);
  });

  it("keeps the page fixtures small enough to be examples", () => {
    const big: string[] = [];
    for (const f of files.filter((f) => f.endsWith(".html"))) {
      const size = statSync(root + f).size;
      if (size > MAX_FIXTURE_BYTES) big.push(`${f} is ${Math.round(size / 1024)}KB`);
    }
    expect(big, "a fixture this size has stopped being an example").toEqual([]);
  });

  it("keeps the page fixtures to a couple of courses each", () => {
    const crowded: string[] = [];
    for (const f of files.filter((f) => f.endsWith(".html"))) {
      const text = readFileSync(root + f, "utf8");
      const codes = new Set([...text.matchAll(COURSE_CODE)].map((m) => m[1]!.toLowerCase()));
      if (codes.size > MAX_FIXTURE_COURSES) crowded.push(`${f} carries ${codes.size} course codes`);
    }
    expect(crowded, "this is a slice of the catalogue, not a fixture").toEqual([]);
  });

  it("names no real person in a fixture", () => {
    // requirements.md 5.1: the GDPR exposure here is the lecturers, not the
    // students. The fixtures use invented names on purpose, and a real one
    // was nearly committed once (LESSONS.md section 3), which is why this is
    // checked rather than remembered.
    const real: string[] = [];
    for (const f of files.filter((f) => f.endsWith(".html"))) {
      const text = readFileSync(root + f, "utf8");
      for (const [, address] of text.matchAll(
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]*(?:uclouvain|ulb|ugent|kuleuven)[A-Za-z0-9.-]*\.[a-z]{2,})/gi,
      )) {
        // The placeholder pattern this project already uses is fine.
        if (!/^pr[eé]nom\.nom@/i.test(address)) real.push(`${f}: ${address}`);
      }
    }
    expect(real, "use prenom.nom@ulb.be, never somebody's address").toEqual([]);
  });
});
