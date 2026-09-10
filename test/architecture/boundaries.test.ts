/**
 * FR-B6 and FR-B10: the module boundary is enforced mechanically, and the
 * enforcement itself is tested so it cannot be silently removed.
 *
 * FR-B15: these gates hold regardless of who authored the change.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";

const root = new URL("../..", import.meta.url).pathname;

/** Tier order. A package may depend only on strictly lower tiers. */
const TIER_RANK = { platform: 0, reference: 1, feature: 2, app: 3 } as const;
type Tier = keyof typeof TIER_RANK;

interface Manifest {
  dir: string;
  name: string;
  tier: Tier;
  deps: string[];
}

function manifests(): Manifest[] {
  const out: Manifest[] = [];
  for (const group of ["packages", "apps"]) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const file = join(base, entry, "package.json");
      if (!existsSync(file)) continue;
      const json = JSON.parse(readFileSync(file, "utf8"));
      out.push({
        dir: `${group}/${entry}`,
        name: json.name,
        tier: json.studens?.tier,
        deps: Object.keys(json.dependencies ?? {}).filter((d) => d.startsWith("@studens/")),
      });
    }
  }
  return out;
}

describe("workspace tiers", () => {
  const all = manifests();

  it("finds the workspace packages", () => {
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("every package declares a known tier", () => {
    for (const m of all) {
      expect(Object.keys(TIER_RANK), `${m.dir} declares studens.tier`).toContain(m.tier);
    }
  });

  it("dependencies point one way only (FR-B10)", () => {
    const byName = new Map(all.map((m) => [m.name, m]));
    for (const m of all) {
      for (const dep of m.deps) {
        const target = byName.get(dep);
        expect(target, `${m.name} depends on unknown workspace package ${dep}`).toBeDefined();
        expect(
          TIER_RANK[target!.tier],
          `${m.name} (${m.tier}) must not depend on ${dep} (${target!.tier}): dependencies point down only`,
        ).toBeLessThan(TIER_RANK[m.tier]);
      }
    }
  });

  it("no feature module depends on another feature module (FR-B10)", () => {
    const byName = new Map(all.map((m) => [m.name, m]));
    for (const m of all.filter((x) => x.tier === "feature")) {
      for (const dep of m.deps) {
        expect(
          byName.get(dep)!.tier,
          `${m.name} depends on feature module ${dep}. Extract shared behaviour downward instead.`,
        ).not.toBe("feature");
      }
    }
  });

  it("tier 1 and tier 2 declare no workspace dependencies at all", () => {
    for (const m of all.filter((x) => x.tier === "platform" || x.tier === "reference")) {
      expect(m.deps, `${m.name} is tier ${m.tier} and must depend on nothing`).toEqual([]);
    }
  });
});

describe("the lint gate actually bites (FR-B6)", () => {
  it("rejects a deep import into a module's internals", async () => {
    // ignore: false is required. eslint.config.js excludes test/fixtures so
    // that `npm run lint` stays clean despite the deliberate violation living
    // there; without this flag the fixture is skipped and this test passes
    // vacuously, which is how it failed the first time it was written.
    const eslint = new ESLint({ cwd: root, ignore: false });
    const results = await eslint.lintFiles(["test/fixtures/deep-import-violation.ts"]);
    const messages = results.flatMap((r) => r.messages);
    const restricted = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(
      restricted.length,
      "the deliberate violation in test/fixtures produced no no-restricted-imports error, " +
        "which means the FR-B6 gate has been weakened or removed",
    ).toBeGreaterThan(0);
  });

  it("the boundary rule is configured for every TypeScript file", () => {
    const config = readFileSync(join(root, "eslint.config.js"), "utf8");
    expect(config).toContain("no-restricted-imports");
    expect(config).toContain("@studens/*/src/**");
  });
});
