/**
 * THE FRONTEND'S TYPES MIRROR THE READ MODULE'S BY HAND, AND DIVERGED.
 *
 * `packages/ref/src/read.ts` defines what the API answers with.
 * `packages/ryc-ui/src/api.ts` declares what the browser expects. Nothing
 * connects them: the values cross as JSON, so TypeScript checks each side
 * against its own declaration and neither against the other.
 *
 * On 2026-09-18 that cost a crash on a real screen. `institution` was added to
 * the frontend's `ProgrammeSummary` and not to the reference module's, so the
 * server sent programmes without it, the browse screen called `toUpperCase` on
 * `undefined`, and the error boundary replaced the page. Both typechecks
 * passed. Only opening the page found it.
 *
 * A generated client would remove the class of bug and is a bigger decision
 * than this. Comparing the field names costs nothing and catches the shape of
 * mistake that actually happened: a field added to one side.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url).pathname;
const read = readFileSync(`${root}packages/ref/src/read.ts`, "utf8");
const client = readFileSync(`${root}packages/ryc-ui/src/api.ts`, "utf8");

/**
 * The declared field names of one interface.
 *
 * Deliberately simple: it reads the block between `interface X {` and the
 * matching closing brace at column 0, strips comments, and takes what is left
 * of each `name:` or `name?:`. These files are hand-written and formatted by
 * Prettier, so the shape is stable.
 */
function fieldsOf(source: string, name: string): string[] {
  const start = source.indexOf(`export interface ${name} `);
  if (start < 0) throw new Error(`no interface ${name}`);
  const open = source.indexOf("{", start);
  const end = source.indexOf("\n}", open);
  if (end < 0) throw new Error(`interface ${name} is not closed at column 0`);
  const body = source
    .slice(open + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...body.matchAll(/^\s{2}([A-Za-z_][\w]*)\??:/gm)].map((m) => m[1]!).sort();
}

describe("what the API sends is what the browser expects", () => {
  it("has interfaces to compare, so the gate is not vacuous", () => {
    expect(fieldsOf(read, "CourseSummary").length).toBeGreaterThan(5);
  });

  for (const name of ["CourseSummary", "ProgrammeSummary", "FacultySummary"]) {
    it(`${name} declares the same fields on both sides`, () => {
      const server = fieldsOf(read, name);
      const browser = fieldsOf(client, name);
      const missingInBrowser = server.filter((f) => !browser.includes(f));
      const missingInServer = browser.filter((f) => !server.includes(f));
      expect(
        { missingInBrowser, missingInServer },
        `${name} has drifted between packages/ref/src/read.ts and ` +
          `packages/ryc-ui/src/api.ts. A field on one side only is sent and ` +
          `never read, or read and never sent, and both typechecks pass.`,
      ).toEqual({ missingInBrowser: [], missingInServer: [] });
    });
  }

  it("CourseDetail extends the summary on both sides, and adds the same fields", () => {
    // Checked apart from the three above because both sides declare it with
    // `extends`, so `fieldsOf` sees only what each adds.
    expect(fieldsOf(read, "CourseDetail")).toEqual(fieldsOf(client, "CourseDetail"));
  });
});
