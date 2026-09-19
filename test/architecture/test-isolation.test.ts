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
const FIXTURE_ID = /['"`](?:0{8}-0{4}-0{4}-0{4}-0{10}[a-z0-9]{2}|ztst[a-z0-9.-]+)['"`]/g;

/**
 * A fixture name BUILT from a template, and the prefix it builds them under.
 *
 * `` `ztst.${subject}` `` is not a literal, so the rule above never saw it, and
 * three files spent months each generating usernames in one shared namespace.
 * Two of them used the subject "author" and two used "reporter": the same
 * username, on a column that is globally unique, from files whose cleanup is
 * scoped by provider and therefore never noticed.
 *
 * It went red on 2026-09-19 on a change that touched none of them, which is
 * the signature this whole file exists to stop: adding one test file altered
 * which files overlap, and the failure landed on the wrong person. The gate
 * caught the shape it knew and missed the shape one character away from it.
 *
 * So a template prefix is a namespace, and a namespace has one owner.
 */
const FIXTURE_PREFIX = /['"`]?`(ztst[a-z0-9.-]*)\$\{/g;

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

  it("no fixture name is BUILT under a prefix two files share", () => {
    const owners = new Map<string, string[]>();
    for (const file of files) {
      const rel = file.slice(root.length);
      const code = stripComments(readFileSync(file, "utf8"));
      const prefixes = new Set([...code.matchAll(FIXTURE_PREFIX)].map((m) => m[1]!));
      for (const p of prefixes) owners.set(p, [...(owners.get(p) ?? []), rel]);
    }
    const shared = [...owners.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([p, who]) => `${p}* is built by ${who.join(" and ")}`);
    expect(
      shared,
      "two test files generate names under the same prefix. Whether they " +
        "collide depends on the argument each happens to pass, which is not a " +
        "thing to leave to luck on a unique column. Give each file its own " +
        "prefix, as ztst.acct, ztst.mod and ztst.rep do.",
    ).toEqual([]);
  });

  /**
   * And a generated name must not be able to land on another file's literal
   * one. `ztst.` as a prefix plus the subject "one" is exactly the name
   * profile.db.test.ts writes by hand, and neither rule above would see it.
   */
  it("no built prefix can produce another file's literal fixture id", () => {
    const literals = new Map<string, string>();
    const prefixes = new Map<string, string>();
    for (const file of files) {
      const rel = file.slice(root.length);
      const code = stripComments(readFileSync(file, "utf8"));
      for (const m of code.matchAll(FIXTURE_ID)) literals.set(m[0].slice(1, -1), rel);
      for (const m of code.matchAll(FIXTURE_PREFIX)) prefixes.set(m[1]!, rel);
    }
    const reachable: string[] = [];
    for (const [prefix, owner] of prefixes) {
      for (const [id, holder] of literals) {
        if (holder !== owner && id.startsWith(prefix)) {
          reachable.push(`${owner} can generate ${id}, which ${holder} writes by hand`);
        }
      }
    }
    expect(reachable).toEqual([]);
  });
});
