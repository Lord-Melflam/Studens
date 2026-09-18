/**
 * A CLASS NAME DEFINED IN TWO STYLESHEETS IS ONE STYLESHEET SILENTLY EDITING
 * THE OTHER.
 *
 * `apps/web/src/main.tsx` imports the shell's three stylesheets and
 * `packages/ryc-ui/src/index.tsx` imports the module's own. All four end up in
 * one document, in one cascade, so a name declared in both is decided by
 * source order and by which properties each rule happens to leave unset.
 *
 * That is not a theory. `.chips` is declared by the public zone with
 * `margin: 1.6rem 0 0` and by the module with no margin at all, and the module
 * won every property it named while the public zone supplied the margin. The
 * result was a 1.6rem gap above every group of chips in the RYC filter panel,
 * which took a screenshot and three rounds of debug outlines to find, because
 * the rule producing it is in a file that has nothing to do with filters.
 *
 * It is also an FR-B16 problem and not only a cosmetic one. The shell may not
 * know what a module's screens look like, and a shell stylesheet that restyles
 * a module's components knows exactly that, by accident.
 *
 * WHY A FROZEN LIST RATHER THAN ZERO. Fifteen names already collide. Renaming
 * all of them, or scoping each zone's stylesheet under its own root, is a
 * change to four files and 2,100 lines of CSS with no visible result, and it
 * would land in the middle of unrelated work. A list that may shrink and may
 * not grow costs nothing, stops the next one, and states the debt out loud
 * instead of leaving it to be rediscovered the same expensive way.
 *
 * To fix one: rename it in the module, or give the module's rule an explicit
 * value for every property the shell's rule sets, then delete it from here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url).pathname;

const MODULE_CSS = "packages/ryc-ui/src/ryc.css";
const SHELL_CSS = [
  "apps/web/src/shell.css",
  "apps/web/src/public/public.css",
  "apps/web/src/firstrun/firstrun.css",
];

/**
 * Names declared by both the module and the shell as of 2026-09-18.
 *
 * Shared, not safe. `chips` is missing because it was the one that bit and it
 * was fixed properly: the module's is now `chipset`. The rest are untested
 * ground. They collide, and whether the collision shows today depends on
 * specificity and on the two rules never being rendered near each other.
 */
const KNOWN = new Set([
  "bad",
  "badge",
  "error",
  "facts",
  "field-label",
  "field-note",
  "ghost",
  "hint",
  "linkish",
  "notice",
  "on",
  "summary",
  "text-input",
  "wide",
]);

/** Class names a stylesheet declares. Comments are not declarations. */
function declared(relative: string): Set<string> {
  const text = readFileSync(root + relative, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Set<string>();
  // Every selector list, meaning the text before a `{` that is not an at-rule.
  for (const [, , selector] of text.matchAll(/(^|[};])([^@{};]+)\{/g)) {
    for (const [, name] of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(name);
  }
  return out;
}

describe("stylesheets loaded together", () => {
  it("declare no class name that is not already known to be shared", () => {
    const module = declared(MODULE_CSS);
    const shell = new Set(SHELL_CSS.flatMap((f) => [...declared(f)]));
    const shared = [...module].filter((name) => shell.has(name)).sort();
    const added = shared.filter((name) => !KNOWN.has(name));
    expect(added, `new class name in both ${MODULE_CSS} and a shell stylesheet`).toEqual([]);
  });

  it("lists nothing in KNOWN that has since been fixed", () => {
    const module = declared(MODULE_CSS);
    const shell = new Set(SHELL_CSS.flatMap((f) => [...declared(f)]));
    const gone = [...KNOWN].filter((name) => !(module.has(name) && shell.has(name))).sort();
    expect(gone, "no longer shared, delete from KNOWN").toEqual([]);
  });

  it("does not take the name `chips` back", () => {
    // The fix that started this file. The public zone still has a `.chips`
    // holding its own pills, and the module's row of toggles is `chipset`.
    // The first test would catch this too; it is here so that the failure
    // names the reason rather than a diff of one string.
    const text = readFileSync(root + MODULE_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(text, "renamed to chipset, see the comment on that rule").not.toMatch(/\.chips\b/);
  });
});
