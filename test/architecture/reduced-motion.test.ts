/**
 * EVERY ANIMATION CAN BE TURNED OFF BY THE READER.
 *
 * `prefers-reduced-motion: reduce` is not a preference about taste. People set
 * it because motion makes them ill: vestibular disorders, migraine, motion
 * sensitivity. A decorative animation that ignores it is the exact thing they
 * asked the system to stop.
 *
 * WHY A GATE AND NOT A HABIT. The animation and its opt-out are written at the
 * same moment and then live far apart: the keyframes go beside the component
 * they decorate, the media query sits at the bottom of the file. Adding the
 * first without the second is a one-line omission that nothing else notices,
 * because the page looks right to whoever wrote it. It has no symptom for the
 * author and a real one for the reader.
 *
 * WHAT IS CHECKED. Every stylesheet that declares an `animation` shorthand or
 * an `animation-name` also has a `prefers-reduced-motion: reduce` block, and
 * every class it animates is named inside that block. Transitions are not
 * required to be: a 120ms colour change on hover is not motion in the sense
 * that hurts anybody, and demanding it would make this noise.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url).pathname;

const SHEETS = [
  "packages/ryc-ui/src/ryc.css",
  "apps/web/src/shell.css",
  "apps/web/src/public/public.css",
  "apps/web/src/firstrun/firstrun.css",
];

/** The body of every `@media (prefers-reduced-motion: reduce)` block. */
function reducedMotionBlocks(css: string): string {
  let out = "";
  const re = /@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    // Walk braces from the opening one, so nested rules come along.
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    out += css.slice(m.index + m[0].length, i);
  }
  return out;
}

/** Selectors that carry an animation, outside any reduced-motion block. */
function animatedSelectors(css: string): string[] {
  const reduced = reducedMotionBlocks(css);
  const out = new Set<string>();
  for (const [, selector, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!/(^|;|\s)animation(-name)?\s*:/.test(body)) continue;
    if (/animation(-name)?\s*:\s*none/.test(body)) continue;
    // A rule inside the reduced block is the opt-out, not a violation.
    if (reduced.includes(body.trim()) && body.trim() !== "") continue;
    for (const part of selector.split(",")) {
      const cls = part.trim().match(/\.([a-zA-Z][\w-]*)/);
      if (cls) out.add(cls[1]!);
    }
  }
  return [...out];
}

describe("motion can be refused", () => {
  it("has sheets to check, so the gate is not vacuous", () => {
    const withMotion = SHEETS.filter((f) =>
      /(^|;|\s)animation(-name)?\s*:/.test(readFileSync(root + f, "utf8")),
    );
    expect(withMotion.length).toBeGreaterThan(0);
  });

  for (const sheet of SHEETS) {
    it(`${sheet} offers an opt-out for everything it animates`, () => {
      const css = readFileSync(root + sheet, "utf8");
      const animated = animatedSelectors(css);
      if (animated.length === 0) return;

      const reduced = reducedMotionBlocks(css);
      expect(
        reduced.length,
        `${sheet} animates ${animated.join(", ")} and has no ` +
          `@media (prefers-reduced-motion: reduce) block at all`,
      ).toBeGreaterThan(0);

      const unstopped = animated.filter((cls) => !new RegExp(`\\.${cls}\\b`).test(reduced));
      expect(
        unstopped,
        "these classes animate and are not named in the reduced-motion block, " +
          "so a reader who asked their system for less motion gets it anyway",
      ).toEqual([]);
    });
  }
});
