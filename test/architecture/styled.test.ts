/**
 * A CLASS A COMPONENT RENDERS HAS A RULE SOMEWHERE, or it is recorded as
 * having no visual job.
 *
 * THE BUG THIS EXISTS FOR. "Mes avis" shipped with six class names and not one
 * rule for any of them: `.mine`, `.mine-list`, `.mine-head`, `.mine-body` and
 * the rest were invented in the component and never written into a stylesheet.
 * It drew as an unbroken wall of prose with nothing to say where one review
 * ended and the next began, and it reached somebody using the product before
 * anybody noticed. Nothing failed. Every test passed, the build was clean, and
 * the screen was unreadable.
 *
 * That is the shape of the failure: an unstyled class is not an error in any
 * language involved. TypeScript sees a string, the bundler sees a string, CSS
 * sees a selector nobody wrote. The only thing that catches it is looking at
 * the page, and looking at the page is exactly what does not happen on the
 * fourth screen of an evening.
 *
 * WHAT IT DOES NOT CHECK, and cannot. Whether the rule is any good, whether it
 * applies at the right breakpoint, or whether the screen looks right. This is a
 * gate against absence, not against ugliness. Absence is the failure that has
 * actually happened here twice.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;

/** Every stylesheet the app loads, from the two files that import them. */
const STYLESHEETS = [
  "packages/ryc-ui/src/ryc.css",
  "apps/web/src/shell.css",
  "apps/web/src/public/public.css",
  "apps/web/src/firstrun/firstrun.css",
];

const COMPONENT_ROOTS = ["packages/ryc-ui/src", "apps/web/src"];

/**
 * Class names that carry no style and are not meant to.
 *
 * ADDING A NAME HERE IS A CLAIM, not a way past the gate: that this class has
 * no visual job at all. A screen's own classes never belong here, which is
 * what makes the list readable in a diff. Each one says why.
 */
const NO_VISUAL_JOB: Record<string, string> = {
  // Set on every review alongside `review`, so a test can find one path's
  // sample in rendered HTML (test/ui/public-zone.test.ts slices on it). The
  // look of a path is carried by its chip, deliberately: see the two rules at
  // the top of the review section in ryc.css.
  "review-named": "a marker for the attributed path, found by tests, never painted",
  "review-anonymous": "a marker for the anonymous path, found by tests, never painted",
  // Named containers. They say what the box holds and hold no rule of their
  // own, because the children carry the layout.
  "browse-list": "a named wrapper around the grouped course rows",
  flow: "a named wrapper around the submission steps",
  "hero-text": "a named wrapper around the landing copy",
  "sources-inline": "a named wrapper around a module's sources block",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Every class name a stylesheet mentions, wherever it appears in a selector. */
function definedClasses(): Set<string> {
  const css = STYLESHEETS.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
  return new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!));
}

/**
 * Class names a file renders, and where.
 *
 * A `${...}` inside a template literal is replaced by a placeholder, and a
 * token holding one is skipped: `review-${path}` is a family of names this
 * cannot enumerate. String literals INSIDE the expression are kept, because
 * `${held ? "mine-held" : ""}` is a concrete name written by hand.
 */
function usedClasses(file: string): Map<string, number> {
  const text = readFileSync(file, "utf8");
  const found = new Map<string, number>();
  const line = (index: number) => text.slice(0, index).split("\n").length;

  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = m[1] ?? m[2] ?? "";
    const tokens: string[] = [];
    for (const expr of raw.matchAll(/\$\{([^}]*)\}/g)) {
      for (const lit of expr[1]!.matchAll(/["']([^"']*)["']/g)) {
        tokens.push(...lit[1]!.split(/\s+/));
      }
    }
    tokens.push(...raw.replace(/\$\{[^}]*\}/g, "\u0001").split(/\s+/));
    for (const token of tokens) {
      if (token === "" || token.includes("\u0001")) continue;
      if (!found.has(token)) found.set(token, line(m.index));
    }
  }
  return found;
}

describe("every class a component renders is styled", () => {
  const defined = definedClasses();
  const files = COMPONENT_ROOTS.flatMap((r) => walk(join(ROOT, r)));

  it("finds the components and the stylesheets", () => {
    // A gate that silently walks an empty tree passes forever.
    expect(files.length).toBeGreaterThan(10);
    expect(defined.size).toBeGreaterThan(100);
  });

  for (const file of files) {
    const relative = file.slice(ROOT.length);
    it(relative, () => {
      const unstyled: string[] = [];
      for (const [name, at] of usedClasses(file)) {
        if (defined.has(name)) continue;
        if (name in NO_VISUAL_JOB) continue;
        unstyled.push(`${name} (${relative}:${at})`);
      }
      expect(
        unstyled,
        "these class names have no rule in any stylesheet the app loads, so " +
          "they do nothing: either write the rule, or record the name in " +
          "NO_VISUAL_JOB with the reason it has none",
      ).toEqual([]);
    });
  }
});

describe("the exception list stays honest", () => {
  it("records a reason for every name on it", () => {
    for (const [name, why] of Object.entries(NO_VISUAL_JOB)) {
      expect(why.length, `${name} is excused without saying why`).toBeGreaterThan(20);
    }
  });

  /**
   * A name that has since been given a rule, or removed from the markup, has
   * no business being excused: the list would then be documenting something
   * that is not true any more, which is how an exception list becomes a place
   * to put things.
   */
  it("holds nothing that is styled, and nothing that is unused", () => {
    const defined = definedClasses();
    const used = new Set(
      COMPONENT_ROOTS.flatMap((r) => walk(join(ROOT, r))).flatMap((f) => [
        ...usedClasses(f).keys(),
      ]),
    );
    for (const name of Object.keys(NO_VISUAL_JOB)) {
      expect(defined.has(name), `${name} has a rule now, so drop it from the list`).toBe(false);
      expect(used.has(name), `${name} is not rendered any more, so drop it`).toBe(true);
    }
  });
});
