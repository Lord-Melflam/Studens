/**
 * The design tokens come in two groups and the split is load bearing.
 *
 * A per-institution theme is planned. It may recolour chrome freely. It must
 * not touch the two path colours, because those carry meaning: a theme that
 * recoloured --named or --anon could make an attributed contribution and an
 * anonymous one look alike, which is the one thing the interface must never do
 * (FR-C15, FR-C16, requirements.md 3.3).
 *
 * A comment saying so is not a mechanism, and LESSONS.md section 9 records that
 * a rule written is not a rule applied. This is the mechanism.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const shellCss = readFileSync(join(root, "apps/web/src/shell.css"), "utf8");

/** Colours that carry meaning and may never be themed. */
const PROTECTED = ["--named", "--named-soft", "--anon", "--anon-soft", "--warn", "--warn-soft", "--danger"];
/** Colours that are decoration and may be themed. */
const THEMEABLE = ["--accent", "--accent-soft", "--sky", "--ink", "--muted", "--line", "--bg"];

/** The two `:root` blocks, in order: chrome first, meaning second. */
function rootBlocks(css: string): string[] {
  return [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]!);
}

describe("design tokens are split into chrome and meaning", () => {
  const blocks = rootBlocks(shellCss);

  it("declares exactly two :root groups", () => {
    expect(
      blocks.length,
      "one flat token set lets a theme recolour everything, including the two " +
        "colours the anonymity design leans on",
    ).toBe(2);
  });

  it("every themeable token is in the first group", () => {
    for (const t of THEMEABLE) {
      expect(blocks[0], `${t} belongs in the chrome group`).toContain(`${t}:`);
    }
  });

  it("every protected token is in the second group, not the first", () => {
    for (const t of PROTECTED) {
      expect(blocks[1], `${t} belongs in the protected group`).toContain(`${t}:`);
      expect(
        blocks[0],
        `${t} carries meaning and must not sit among the themeable tokens: a ` +
          `theme would be free to recolour it`,
      ).not.toContain(`${t}:`);
    }
  });

  it("the protected group says so in a comment a reader will hit first", () => {
    expect(shellCss).toMatch(/MUST NOT override/);
  });
});

describe("the two path colours are used only for their paths", () => {
  function moduleCss(): Array<{ file: string; text: string }> {
    const out: Array<{ file: string; text: string }> = [];
    const dir = join(root, "packages");
    for (const pkg of readdirSync(dir)) {
      const src = join(dir, pkg, "src");
      let entries: string[];
      try {
        entries = readdirSync(src);
      } catch {
        continue;
      }
      for (const f of entries.filter((f) => f.endsWith(".css"))) {
        out.push({ file: `packages/${pkg}/src/${f}`, text: readFileSync(join(src, f), "utf8") });
      }
    }
    return out;
  }

  it("finds module stylesheets, so the check is not vacuous", () => {
    expect(moduleCss().length).toBeGreaterThan(0);
  });

  it("uses --named and --anon only on the chips that mark a path", () => {
    for (const { file, text } of moduleCss()) {
      // Strip comments: a comment explaining the rule is not a use of it.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
      const rules = [...code.matchAll(/([^{}]+)\{([^}]*)\}/g)];
      for (const [, selector, body] of rules) {
        if (!/var\(--(named|anon)(-soft)?\)/.test(body!)) continue;
        expect(
          selector!.trim(),
          `${file}: ${selector!.trim()} uses a path colour. Those two colours mean ` +
            `"attributed" and "anonymous" and nothing else, so using them for ` +
            `ordinary decoration makes the distinction unreliable.`,
        ).toMatch(/named|anon/i);
      }
    }
  });
});
