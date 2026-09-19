/**
 * THE TWO PATHS STAY LEGIBLE, AND STAY TELLABLE APART, IN EVERY SCHEME.
 *
 * `design-tokens.test.ts` keeps a per-institution THEME away from --named and
 * --anon, because a theme that recoloured them could make an attributed
 * contribution and an anonymous one look alike (FR-C15, FR-C16, 3.3). That
 * rule is right and it stays.
 *
 * It is not sufficient. It forbids editing two hex codes, and what the design
 * actually needs is a property: whatever the colours are, a reader can read
 * them and can tell the two apart. The old rule would have allowed
 * `--named: #6b3fa1` beside `--anon: #6b3fa0` in light mode without a word,
 * and would have forbidden the dark values the product needs in order to keep
 * the property at all.
 *
 * So this measures the property, in both schemes we ship. It is the stronger
 * guarantee, and it is why the dark block in shell.css is allowed to restate
 * the protected colours.
 *
 * THE NUMBERS. Contrast is WCAG 2.1 relative luminance, the same formula
 * browsers and auditors use. 3:1 is the WCAG AA floor for large text and for
 * a graphical object that has to be perceivable, which is what a path chip is.
 * Separation between the two paths is measured in the same units against each
 * other: identical colours give 1.0, and anything at or below 1.25 means two
 * chips a reader is being asked to distinguish by a shade.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../apps/web/src/shell.css", import.meta.url).pathname,
  "utf8",
);

/** WCAG AA for large text and graphical objects. */
const READABLE = 3;
/** Two path colours closer than this are being told apart by a shade. */
const DISTINCT = 1.25;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** The tokens declared in one block, by the selector that opens it. */
function tokens(selector: string): Record<string, string> {
  const at = css.indexOf(selector);
  expect(at, `no block for ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(at, css.indexOf("}", at));
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{3,8})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

/**
 * Light is the first `:root`, whose block holds the chrome, plus the second,
 * which holds the meaning. Dark restates both in one block.
 */
const light = { ...tokens(":root {"), ...tokens(":root {\n  --named") };
const dark = tokens(':root[data-theme="dark"]');

describe.each([
  ["light", light],
  ["dark", dark],
])("the %s scheme", (name, t) => {
  it("declares every colour the other one does", () => {
    // A scheme missing a token silently inherits the other scheme's value,
    // which is how a dark page ends up with one light-mode chip on it.
    for (const key of ["--named", "--anon", "--ink", "--muted", "--bg", "--surface", "--accent"]) {
      expect(t[key], `${name} is missing ${key}`).toBeDefined();
    }
  });

  it("keeps the attributed and the anonymous paths readable on a surface", () => {
    for (const key of ["--named", "--anon"] as const) {
      const ratio = contrast(t[key]!, t["--surface"]!);
      expect(
        ratio,
        `${name}: ${key} ${t[key]} on ${t["--surface"]} is ${ratio.toFixed(2)}:1, ` +
          `below ${READABLE}:1. A path nobody can read is a path nobody can check.`,
      ).toBeGreaterThanOrEqual(READABLE);
    }
  });

  it("keeps the two paths distinguishable FROM EACH OTHER (FR-C15)", () => {
    const ratio = contrast(t["--named"]!, t["--anon"]!);
    expect(
      ratio,
      `${name}: --named ${t["--named"]} and --anon ${t["--anon"]} are ` +
        `${ratio.toFixed(2)} apart. A reader has to be able to tell an ` +
        `attributed contribution from an anonymous one without reading a word.`,
    ).toBeGreaterThanOrEqual(DISTINCT);
  });

  it("keeps ordinary text readable", () => {
    expect(contrast(t["--ink"]!, t["--bg"]!)).toBeGreaterThanOrEqual(7);
    // Muted is still text, so it gets the large-text floor rather than a pass.
    expect(contrast(t["--muted"]!, t["--bg"]!)).toBeGreaterThanOrEqual(READABLE);
  });

  it("keeps a filled accent button readable", () => {
    expect(contrast(t["--on-accent"]!, t["--accent"]!)).toBeGreaterThanOrEqual(READABLE);
  });
});
