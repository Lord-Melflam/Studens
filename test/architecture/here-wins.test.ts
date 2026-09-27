/**
 * THE CURRENT-STATE MARK MUST ACTUALLY WIN.
 *
 * `.here` is the one answer to "which of these am I on": the accent pill in
 * the app bar, in the public header, on a call to action that leads where you
 * already are, on a console section, on a scheme or language choice. It is
 * declared once, in shell.css, because a second copy is the mistake `.chips`
 * taught this project.
 *
 * Declaring it once is not enough, and that is what this file is for.
 * `.here` and `.console-tab` are both ONE class, so specificity is equal and
 * the rule declared LATER wins. Any base rule that sets `color` or a
 * `background` on a class that is also rendered with `.here`, anywhere below
 * `.here` in the same stylesheet, silently un-marks the current item. Nothing
 * breaks, nothing errors: the mark is simply absent, and every item looks the
 * same.
 *
 * It has happened three times.
 *
 *   - `.chips` lost its `margin: 0` to the shell's rule (phase 32), which is
 *     why the module class is now `chipset` and why css-collisions.test.ts
 *     freezes the names the stylesheets share.
 *   - `.console-tab` rendered with no mark at all on the section you were in
 *     (phase 46), found by screenshot rather than by reading.
 *   - `.choice` did the same to the display scheme, under a comment that said
 *     it used `.here`. Reported as the scheme choice not staying selected.
 *
 * And once `.choice` was guarded, the scheme buttons were STILL wrong, because
 * they sit inside a panel and `.panel button` is a class plus an element: it
 * outranks `.here` whatever the order, so no amount of moving rules fixes it.
 *
 * That is why the rule below is the one it is. Ordering and `:not(.here)` both
 * help, and neither is sufficient, so every class the markup renders with
 * `here` must also carry its own `.class.here` rule declaring the mark. Two
 * classes beat one, and beat a class plus an element, wherever they sit in the
 * file. The redundancy is deliberate.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;

const SHEETS = [
  "apps/web/src/shell.css",
  "apps/web/src/public/public.css",
  "apps/web/src/firstrun/firstrun.css",
];

const SOURCES = [
  "apps/web/src",
  "packages/ryc-ui/src",
];

/** The properties `.here` claims. A base rule may not set these unguarded. */
const CLAIMED = /(^|[;{\s])(color|background|background-color|font-weight)\s*:/;

function stylesheet(relative: string): string {
  return readFileSync(root + relative, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every rule as [selectorList, body, indexInFile]. */
function rules(css: string): { selector: string; body: string; at: number }[] {
  const out: { selector: string; body: string; at: number }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ selector: m[1]!.trim(), body: m[2]!, at: m.index });
  }
  return out;
}

/**
 * Class names rendered together with `here` in the markup, read from the JSX
 * rather than listed here: a new one gets covered without this file changing,
 * which is the whole point of a gate over a convention.
 */
function classesMarkedWithHere(): Set<string> {
  const found = new Set<string>();
  for (const dir of SOURCES) {
    for (const file of listTsx(root + dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/["'`]([a-z][a-z0-9-]*) here["'`]/g)) {
        found.add(m[1]!);
      }
    }
  }
  return found;
}

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listTsx(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Every rule in every sheet, so a `.C.here` can be found wherever it sits. */
function allRules(): { selector: string; body: string; sheet: string; at: number }[] {
  return SHEETS.flatMap((sheet) =>
    rules(stylesheet(sheet)).map((r) => ({ ...r, sheet })),
  );
}

describe("a base rule cannot un-mark the current item", () => {
  const marked = classesMarkedWithHere();

  it("finds the classes that are rendered with `here`, so the gate is not vacuous", () => {
    // Five today: cta, ghost, settings-link, console-tab and choice. If this
    // drops to nothing, the reader below is matching the wrong shape and
    // passing for the wrong reason.
    expect(marked.size).toBeGreaterThan(2);
    expect(marked).toContain("choice");
  });

  for (const sheet of SHEETS) {
    it(`${sheet} declares nothing after \`.here\` that would beat it`, () => {
      const css = stylesheet(sheet);
      const all = rules(css);
      const hereAt = all.find((r) =>
        r.selector.split(",").some((s) => s.trim() === ".here"),
      )?.at;
      // Only shell.css declares `.here`. In a sheet that does not, every rule
      // is "after" it, because shell.css is loaded first in every zone.
      const floor = hereAt ?? -1;

      const offenders: string[] = [];
      for (const rule of all) {
        if (rule.at <= floor) continue;
        if (!CLAIMED.test(rule.body)) continue;
        for (const part of rule.selector.split(",")) {
          const sel = part.trim();
          // A bare single class, with no state qualifier of its own.
          const bare = /^\.([a-z][a-z0-9-]*)$/.exec(sel);
          if (!bare) continue;
          if (marked.has(bare[1]!)) {
            offenders.push(`${sel} { ... } sets a property \`.here\` owns`);
          }
        }
      }
      expect(
        offenders,
        "`.here` is declared once and these rules are declared after it with " +
          "equal specificity, so they win and the current item loses its " +
          "mark. Guard the base rule with :not(.here) rather than raising " +
          "its specificity.",
      ).toEqual([]);
    });
  }

  /**
   * The check that actually holds, because it does not depend on where a rule
   * sits or on what else might match the element. A class plus `.here` is two
   * classes: it beats the base rule, it beats a later rule, and it beats
   * `.panel button`, which is what was wrong with the scheme buttons after the
   * ordering fix had already been made.
   */
  it("every class rendered with `here` declares its own `.class.here`", () => {
    const painted = new Map<string, Set<string>>();
    for (const rule of allRules()) {
      for (const part of rule.selector.split(",")) {
        const sel = part.trim();
        for (const c of marked) {
          // `.c.here` or `a.c.here`, and not `.c .here`, which is a descendant.
          if (!new RegExp(`\\.${c}\\.here(?![\\w-])`).test(sel)) continue;
          const props = painted.get(c) ?? new Set<string>();
          for (const m of rule.body.matchAll(/(^|[;{\s])([a-z-]+)\s*:/g)) {
            props.add(m[2]!);
          }
          painted.set(c, props);
        }
      }
    }

    const missing = [...marked]
      .filter((c) => {
        const props = painted.get(c);
        if (!props) return true;
        // The mark is a colour on a background. Both, or it is not a mark.
        const hasBg = props.has("background") || props.has("background-color");
        return !props.has("color") || !hasBg;
      })
      .map((c) => `.${c}.here`);

    expect(
      missing,
      "the markup renders these classes with `here`, and nothing declares the " +
        "mark at two-class specificity. `.here` alone is one class, so a base " +
        "rule declared later, or any rule with a class and an element such as " +
        "`.panel button`, silently wins and the current item looks like every " +
        "other one.",
    ).toEqual([]);
  });
});

/**
 * A BUTTON WITH ITS OWN LOOK MUST OUTRANK `.panel button`.
 *
 * THE FOURTH TIME THIS COLLISION HAS COST A BUG. `.panel button` is a class
 * plus an element, specificity (0,1,1), and it declares padding, colour,
 * background, border and radius. Any component styled with a single class,
 * (0,1,0), loses every one of those inside a panel, whatever order the file
 * is in, because this is a specificity loss and not a cascade-order loss.
 *
 * The first three were `.here` losing its mark three separate times. The
 * fourth was the "i" that explains a setting: `.panel button`'s horizontal
 * padding squeezed a 1.9rem button's content box to a NEGATIVE width, which
 * clamps to zero, so the icon rendered as nothing at all inside a chip that
 * was plainly visible. Nothing failed, the markup was correct, and the only
 * thing that found it was measuring the DOM.
 *
 * So the rule is stated positively and checked: a class that gives a button
 * its own look carries a `.panel .class` form too, which wins on class count
 * regardless of order.
 */
describe("a button with its own look wins inside a panel", () => {
  const css = readFileSync(`${root}apps/web/src/shell.css`, "utf8");

  /** What `.panel button` declares, and therefore what a component can lose. */
  const CONTESTED = ["padding", "color", "background", "border", "border-radius", "font-size"];

  /**
   * Buttons that cannot appear inside a panel, with where they do live.
   *
   * A name goes here only when the component is structurally outside every
   * panel, never because the collision has not been noticed yet. If one of
   * these is ever rendered in a panel it will lose its look silently, which is
   * the whole failure this gate exists for.
   */
  const NEVER_IN_A_PANEL: Record<string, string> = {
    "crumb-up": "the breadcrumb in the application bar, above every panel",
  };

  /** Classes this repo puts on a <button> in the shell. */
  function buttonClasses(): Set<string> {
    const out = new Set<string>();
    for (const file of listTsx(join(root, "apps/web/src"))) {
      const text = readFileSync(file, "utf8");
      for (const [, attrs] of text.matchAll(/<button\b([\s\S]*?)>/g)) {
        for (const [, raw] of attrs.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          for (const token of (raw ?? "").replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
            if (token) out.add(token);
          }
        }
      }
    }
    return out;
  }

  /**
   * Rule bodies keyed by class, for two selector shapes: the bare `.cls` and
   * the panel-qualified `.panel .cls`.
   *
   * BOTH ARE MATCHED EXACTLY, and that is the point. An earlier version asked
   * only whether a `.panel .cls` selector existed anywhere, and
   * `.panel .info-mark svg` satisfied it: a rule about the icon inside the
   * button was read as proof that the button itself was covered. The gate then
   * passed with the original bug reintroduced, which is the one thing a gate
   * must never do.
   */
  function rulesFor(shape: "bare" | "panel"): Map<string, string> {
    const out = new Map<string, string>();
    const bare = /^\.([a-zA-Z][\w-]*)$/;
    const panel = /^\.panel\s+\.([a-zA-Z][\w-]*)$/;
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const raw of selector.split(",")) {
        // A state or pseudo qualifier still styles the same element, but the
        // base look is what `.panel button` overrides, so only the plain
        // selector counts here.
        const m = (shape === "bare" ? bare : panel).exec(raw.trim());
        if (m) out.set(m[1]!, (out.get(m[1]!) ?? "") + body);
      }
    }
    return out;
  }

  const declares = (body: string, prop: string) =>
    new RegExp(`(^|;|\\s)${prop}\\s*:`).test(body);

  it("finds the ingredients, so the gate is not vacuous", () => {
    expect(css).toContain(".panel button");
    expect(buttonClasses().size).toBeGreaterThan(3);
  });

  it("says where each exempt button lives instead", () => {
    for (const [cls, where] of Object.entries(NEVER_IN_A_PANEL)) {
      expect(where.length, `.${cls} is exempt without saying where it lives`).toBeGreaterThan(20);
      expect(buttonClasses(), `.${cls} is exempt but nothing renders it`).toContain(cls);
    }
  });

  it("restates every contested property at two-class specificity", () => {
    const bare = rulesFor("bare");
    const panel = rulesFor("panel");
    const problems: string[] = [];
    for (const cls of buttonClasses()) {
      if (cls in NEVER_IN_A_PANEL) continue;
      const body = bare.get(cls);
      if (!body) continue;
      const contested = CONTESTED.filter((prop) => declares(body, prop));
      if (contested.length === 0) continue;
      // `.panel .cls` is (0,2,0) and beats `.panel button` at (0,1,1) on class
      // count. It has to declare the contested properties itself: a rule about
      // something INSIDE the button proves nothing about the button.
      const covered = panel.get(cls) ?? "";
      const lost = contested.filter((prop) => !declares(covered, prop));
      if (lost.length === 0) continue;
      problems.push(`.${cls} sets ${lost.join(", ")} with no .panel .${cls} rule restating them`);
    }
    expect(
      problems,
      "`.panel button` is (0,1,1) and outranks a single class, so a button " +
        "styled with one loses these properties inside a panel however the " +
        "file is ordered. Restate the class as `.panel .class` as well.",
    ).toEqual([]);
  });
});
