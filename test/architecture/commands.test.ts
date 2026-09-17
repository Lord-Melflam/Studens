/**
 * Every npm script is documented, and nothing documented has disappeared.
 *
 * `docs/COMMANDS.md` is the file somebody opens to find out what to type, so it
 * is only worth opening while it is complete. A script added without a line
 * there is a command nobody knows exists; a line left behind after a script is
 * renamed sends somebody to a command that errors.
 *
 * Neither drifts noisily. The file keeps working, it is simply wrong in one
 * corner, which is the failure mode every documentation gate in this repository
 * exists for.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url).pathname;
const scripts = Object.keys(
  (JSON.parse(readFileSync(`${root}package.json`, "utf8")) as { scripts: Record<string, string> })
    .scripts,
);
const commands = readFileSync(`${root}docs/COMMANDS.md`, "utf8");

describe("docs/COMMANDS.md lists what exists", () => {
  it("has scripts to check, so the gate is not vacuous", () => {
    expect(scripts.length).toBeGreaterThan(10);
  });

  /**
   * npm's own lifecycle names, which are run without `run`.
   *
   * `npm start` is what a person types and what a service file holds, so
   * requiring the documentation to say `npm run start` would make the gate
   * force a spelling nobody uses. `npm run test` is also valid and is the form
   * already in the table, so both are accepted for both.
   */
  const LIFECYCLE = ["start", "test", "stop", "restart"];
  const documented = (s: string): boolean =>
    commands.includes(`npm run ${s}`) || (LIFECYCLE.includes(s) && commands.includes(`npm ${s}`));

  it("documents every script in package.json", () => {
    const undocumented = scripts.filter((s) => !documented(s));
    expect(
      undocumented,
      "these can be run and are written down nowhere. Add a row to the table in " +
        "docs/COMMANDS.md under 'Every script, and what it is for'.",
    ).toEqual([]);
  });

  it("mentions no script that does not exist", () => {
    // A renamed script leaves its old name behind in prose, and the next person
    // to follow the instructions gets "Missing script".
    const mentioned = [...commands.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]!);
    const ghosts = [...new Set(mentioned)].filter((m) => !scripts.includes(m));
    expect(ghosts, "documented, but running it would fail").toEqual([]);
  });

  /**
   * The launch order is the thing most people open this file for, and it is the
   * only part that has to be read top to bottom rather than searched.
   */
  it("opens with the order to start things in", () => {
    const first = commands.indexOf("## Start here, every time");
    expect(first, "the daily sequence should come before the reference").toBeGreaterThan(-1);
    expect(first).toBeLessThan(commands.indexOf("## First time on a machine"));
  });

  /**
   * Two scripts behave differently from how they read and have both cost time:
   * `test` passes with no database while skipping a hundred tests, and
   * `db:reset` destroys the catalogue and every review. The file has to say so
   * where somebody will see it, not only in a section further down.
   */
  it("warns about the two that surprise people", () => {
    const head = commands.slice(0, commands.indexOf("## First time on a machine"));
    expect(head, "npm run test skipping the database tests must be stated").toMatch(
      /silently skips|skipping/i,
    );
    expect(head, "npm run db:reset being destructive must be stated").toMatch(/destructive/i);
  });
});
