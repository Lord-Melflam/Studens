/**
 * NO SENTENCE IS HARDCODED IN A COMPONENT.
 *
 * The language is chosen once, globally, and it has to hold everywhere: a
 * screen whose buttons are French while the rest is English is not "mostly
 * translated", it is a screen that tells a Dutch or English speaker this
 * product was not built for them.
 *
 * This exists because that is what happened. i18n shipped in phase 22 and was
 * reported as done, and on 2026-09-13 François pointed out he was still seeing
 * French buttons with `en` and `nl` selected. The audit found 125 hardcoded
 * strings across 13 files, including the privacy page, which is the one page
 * that carries the product's central promise. Nothing had caught it because
 * nothing was looking: `missingKeys` checks that the three catalogues agree
 * with each other, which says nothing about text that never became a key.
 *
 * So this looks at the components instead of the catalogues. It scans every
 * `.tsx` under the web app and the modules for prose sitting directly in the
 * markup, and fails with the file, the line and the sentence.
 *
 * WHAT IS ALLOWED THROUGH, and why each one is not a hole:
 *
 *   - Comments. A comment explaining a rule is not a violation of it, the same
 *     exemption the FR-B16 gate needs.
 *   - Translation keys. `"ryc.form.title"` is prose-shaped and is the fix.
 *   - The error boundary, which is deliberately in three languages at once and
 *     calls no translator, because a failure inside the translator is one of
 *     the things it has to survive.
 *   - Brand and code: "Studens", a course code, a URL.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;

/**
 * The one file that may hold sentences, and the reason is in its own header:
 * it renders when the translator may be the thing that broke.
 */
const EXEMPT = new Set(["apps/web/src/ErrorBoundary.tsx"]);

/**
 * The catalogues. Every sentence in the product is in one of these, so scanning
 * them for sentences would report the entire vocabulary as a breach.
 *
 * Matched on the path rather than listed one by one, because a module added
 * later brings its own catalogue and a list nobody updates is a gate that stops
 * covering the thing it was written for.
 */
function isCatalogue(rel: string): boolean {
  return /strings(\/index)?\.ts$/.test(rel) || rel.endsWith("registry.ts");
}

function sources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        const rel = p.slice(root.length);
        if (EXEMPT.has(rel)) continue;
        out.push({ file: rel, text: readFileSync(p, "utf8") });
      }
    }
  };
  walk(join(root, "apps/web/src"));
  walk(join(root, "packages/ryc-ui/src"));
  return out;
}

/** A comment explaining the rule is not a breach of it. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Prose: three or more words, at least one of them four letters or longer.
 *
 * Two words is a label like "5 ECTS" or a code; the threshold is what keeps the
 * gate from firing on the separators and units that legitimately sit in markup.
 */
function isProse(s: string): boolean {
  const text = s.trim();
  if (text.length < 12) return false;
  if (/^https?:/.test(text)) return false;
  // A translation key: dotted, no spaces. That is the fix, not the problem.
  if (!text.includes(" ") && text.includes(".")) return false;
  const words = text.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w));
  return words.length >= 3 && words.some((w) => w.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 4);
}

describe("every sentence on screen comes from the translator", () => {
  /**
   * The markup checks read .tsx ONLY, and that is not an oversight.
   *
   * Their pattern for a JSX text node is "between > and <", which in a plain
   * .ts file matches TypeScript's own syntax: `(url: string): Promise<Fetched>`
   * reads as a text node running into a generic. Widening the scan produced
   * exactly that, from `api.ts`. The field check below has no such problem, so
   * it reads both.
   */
  const files = sources().filter((f) => f.file.endsWith(".tsx"));
  const allFiles = sources();

  it("has sources to check, so the gate is not vacuous", () => {
    expect(files.length).toBeGreaterThan(15);
    // And the field check reads more than the markup checks do, which is the
    // whole point of having added it.
    expect(allFiles.length).toBeGreaterThan(files.length);
  });

  it("no prose sits directly in the markup", () => {
    const offences: string[] = [];
    for (const { file, text } of files) {
      const stripped = stripComments(text);
      stripped.split("\n").forEach((line, i) => {
        // A JSX text node: between a closing and an opening angle bracket, with
        // no braces, which is what an expression would have.
        //
        // The lookbehind excludes `=>`, `<=`, `>=` and friends. Without it the
        // arrow of `.then((r) => (r.json() as Promise<X>))` opens a "text node"
        // that runs into the generic, and five data-fetching helpers were
        // reported as untranslated French.
        for (const m of line.matchAll(/(?<![=\-!<>])>([^<>{}]+)</g)) {
          const t = m[1]!.trim();
          if (isProse(t)) offences.push(`${file}:${i + 1}  ${t.slice(0, 80)}`);
        }
      });
    }
    expect(
      offences,
      "these sentences are hardcoded and will stay in one language whatever the " +
        "visitor chose. Move them into the strings catalogue and call t().",
    ).toEqual([]);
  });

  /**
   * A SENTENCE STORED AS DATA, which is how the last one got through.
   *
   * `ModuleRegistration` carried `summary: "Ce que valent vraiment les cours"`,
   * and the shell's home screen printed it verbatim on an English page. The two
   * checks above look at markup, and an object property is not markup, so
   * nothing was watching. The field is gone now; this is what stops the next
   * one being added.
   *
   * Only fields whose contents reach a screen. `id`, `code` and `kind` hold
   * identifiers and are none of this gate's business.
   */
  it("no prose is stored in a field that reaches the screen", () => {
    const FIELDS = ["summary", "label", "legend", "note", "statusNote", "heading", "caption"];
    const offences: string[] = [];
    for (const { file, text } of allFiles) {
      if (isCatalogue(file)) continue;
      const stripped = stripComments(text);
      stripped.split("\n").forEach((line, i) => {
        for (const field of FIELDS) {
          const m = new RegExp(`\\b${field}\\s*:\\s*"([^"]+)"`).exec(line);
          if (m?.[1] && isProse(m[1])) {
            offences.push(`${file}:${i + 1}  ${field}: ${m[1].slice(0, 60)}`);
          }
        }
      });
    }
    expect(
      offences,
      "these sentences are stored in one language and will be shown in it " +
        "whatever the visitor chose. Put them in the catalogue and resolve them " +
        "with t() where they are used.",
    ).toEqual([]);
  });

  it("no prose is passed as a user-visible attribute", () => {
    // placeholder, title, aria-label and alt all reach the screen or the screen
    // reader, and all four were French in at least one place.
    const offences: string[] = [];
    for (const { file, text } of files) {
      const stripped = stripComments(text);
      stripped.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/\b(?:placeholder|title|aria-label|alt)="([^"]+)"/g)) {
          const t = m[1]!.trim();
          if (isProse(t)) offences.push(`${file}:${i + 1}  ${t.slice(0, 80)}`);
        }
      });
    }
    expect(offences, "a placeholder or a label is as visible as anything else").toEqual([]);
  });

  /**
   * The gate has to bite, or it is decoration. A deliberate violation is fed
   * through the same predicate the scan uses, so removing the check makes this
   * fail rather than making the suite quieter.
   */
  it("actually detects a hardcoded sentence", () => {
    expect(isProse("Publier sous mon nom, définitivement")).toBe(true);
    expect(isProse("This page could not be displayed")).toBe(true);
    // And leaves alone what legitimately sits in markup.
    expect(isProse("ryc.form.title")).toBe(false);
    expect(isProse("5 ECTS")).toBe(false);
    expect(isProse("Studens")).toBe(false);
    expect(isProse("https://uclouvain.be/cours-2025-lepl1503")).toBe(false);
  });
});
