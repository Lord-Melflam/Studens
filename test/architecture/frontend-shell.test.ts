/**
 * FR-B16 to FR-B18: the frontend has the same boundaries as the backend.
 *
 * These exist because the first working screen had none: RYC's course search
 * lived in the shell's own App.tsx, so adding a second module would have meant
 * editing the first one's files. See docs/requirements.md 3.2.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;

/**
 * Comments are stripped before scanning, because a comment EXPLAINING the rule
 * is not a violation of it. The first run of this test failed on a css comment
 * that said "if this file grows selectors like .course, FR-B16 has been lost",
 * which is the rule being documented rather than broken.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function shellSources(): Array<{ file: string; text: string }> {
  const dir = join(root, "apps/web/src");
  const out: Array<{ file: string; text: string }> = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|css)$/.test(entry.name)) {
        out.push({ file: p.slice(root.length), text: stripComments(readFileSync(p, "utf8")) });
      }
    }
  };
  walk(dir);
  return out;
}

describe("the shell knows nothing about any module's domain", () => {
  const sources = shellSources();

  it("has sources to check, so the test is not vacuous", () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  /**
   * Domain words belonging to RYC. If one of these appears in the shell, the
   * module's concerns have leaked into it, which is what FR-B16 forbids and
   * what actually happened before the restructure.
   */
  const domainWords =
    /\b(course|cours|ects|review|avis|programme|faculty|faculté|teacher|enseignant|quarter|workload|difficult)/i;

  it("mentions no course, review, ECTS, programme or faculty", () => {
    for (const { file, text } of sources) {
      // The registry names modules, so it may carry a module id, not a domain word.
      const offending = text
        .split("\n")
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => domainWords.test(line));
      expect(
        offending,
        `${file} mentions a module's domain. The shell mounts modules; it must not know ` +
          `what they draw (FR-B16). Offending: ${offending.map((o) => `${o.n}: ${o.line}`).join(" | ")}`,
      ).toEqual([]);
    }
  });

  it("imports a MODULE only through its registration (FR-B18)", () => {
    const registry = readFileSync(join(root, "apps/web/src/shell/registry.ts"), "utf8");

    // Which workspace packages are modules is read from their manifests, not
    // guessed from their names. An earlier version of this test forbade every
    // `@studens/` import outside the registry, which was too broad: it also
    // caught shared platform-tier infrastructure, which every file may use and
    // which is nobody's domain. FR-B18 is about modules.
    const featurePackages = readdirSync(join(root, "packages"))
      .map((dir) => join(root, "packages", dir, "package.json"))
      .filter((f) => existsSync(f))
      .map((f) => JSON.parse(readFileSync(f, "utf8")))
      .filter((j) => j.studens?.tier === "feature")
      .map((j) => j.name as string);

    expect(featurePackages.length, "no feature packages found: the check would be vacuous")
      .toBeGreaterThan(0);

    const offenders = sources
      .filter((s) => !s.file.endsWith("shell/registry.ts"))
      .filter((s) => featurePackages.some((name) => s.text.includes(`from "${name}"`)))
      .map((s) => s.file);

    expect(
      offenders,
      "only the registry may import a module package: that is what makes adding a module " +
        "a one-line change (FR-B4, FR-B18)",
    ).toEqual([]);
    expect(registry).toMatch(/@studens\/ryc-ui/);
  });

  it("the module's UI lives in the module, not in the shell", () => {
    expect(existsSync(join(root, "packages/ryc-ui/src/Ryc.tsx"))).toBe(true);
    expect(
      existsSync(join(root, "apps/web/src/App.tsx")),
      "apps/web/src/App.tsx was RYC's screen. It must not come back.",
    ).toBe(false);
  });

  it("a module declares a name, a route id, a summary and a component", () => {
    const reg = readFileSync(join(root, "packages/ryc-ui/src/index.tsx"), "utf8");
    for (const field of ["id:", "name:", "summary:", "component:"]) {
      expect(reg, `a module registration needs ${field}`).toContain(field);
    }
  });
});
