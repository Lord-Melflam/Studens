/**
 * NO TWO TEST FILES MAY SHARE A FIXTURE ROW.
 *
 * Vitest runs test FILES in parallel workers. Two files seeding the same row
 * with `upsert` both find nothing and both insert, and one gets a unique
 * violation. It is not deterministic: it depends on which files happen to
 * overlap, so it appears when somebody adds an unrelated test file and looks
 * like their fault.
 *
 * That is exactly how it was found. `test/auth/session.db.test.ts` and
 * `test/kernel/profile.db.test.ts` had shared tenant `...t2` for weeks without
 * colliding, and phase 33 added one file to the suite and CI went red on a
 * change that touched neither.
 *
 * A comment saying "give your file its own id" would be forgotten, and the
 * failure it prevents is intermittent and lands on the wrong person. So it is
 * checked instead.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;

/** The same rule the FR-B16 and prose gates use: a comment is not the thing. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...testFiles(p));
    else if (entry.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/**
 * The seeded ids these suites use, which are written to be recognisable rather
 * than random: a zero-filled uuid ending in two characters, or a `ztst` code.
 */
const FIXTURE_ID = /['"`](?:0{8}-0{4}-0{4}-0{4}-0{10}[a-z0-9]{2}|ztst[a-z0-9-]+)['"`]/g;

describe("parallel test files do not fight over the same row", () => {
  const files = testFiles(join(root, "test"));

  it("has files to check, so the gate is not vacuous", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no fixture id appears in two files", () => {
    const owners = new Map<string, string[]>();
    for (const file of files) {
      const rel = file.slice(root.length);
      // Comments stripped first: a file explaining which id it owns, or this
      // one quoting an example, is describing a row rather than seeding it.
      const code = stripComments(readFileSync(file, "utf8"));
      const ids = new Set([...code.matchAll(FIXTURE_ID)].map((m) => m[0].slice(1, -1)));
      for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), rel]);
    }
    const shared = [...owners.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([id, who]) => `${id} is seeded by ${who.join(" and ")}`);
    expect(
      shared,
      "these fixture rows are seeded by more than one test file. Vitest runs " +
        "files in parallel, so both will insert and one will fail, on whichever " +
        "day the two happen to overlap. Give each file its own id.",
    ).toEqual([]);
  });
});
