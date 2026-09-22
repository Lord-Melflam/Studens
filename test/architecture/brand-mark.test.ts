/**
 * THE MARK IS DRAWN IN FOUR PLACES AND MUST BE THE SAME MARK.
 *
 * `apps/web/src/Brand.tsx` is the source of truth: the application draws the
 * mark as inline SVG so it ships no image and requests none. But a React
 * component cannot reach an email or a profile picture on somebody else's
 * service, so `brand/` holds derivations of it, and a derivation is a copy
 * with a different name.
 *
 * WHAT GOES WRONG WITHOUT THIS. Somebody adjusts the mark in the component,
 * because that is the one they can see while working. The avatar and the mail
 * logo keep the old geometry, and nothing anywhere fails: they are valid SVG,
 * they render, they look approximately right. The drift is discovered when two
 * versions of the mark appear side by side in front of somebody who matters.
 *
 * WHAT THIS CANNOT CHECK, and it is written in `brand/README.md` rather than
 * hidden: the raster files. `avatar.png` and the base64 in
 * `apps/worker/src/logo.ts` are rendered from the SVGs by hand, and checking
 * them would mean running `rsvg-convert` in CI for a file that changes perhaps
 * once a year. Changing the mark means running the three commands in that
 * README in the same change.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url).pathname;
const read = (f: string) => readFileSync(root + f, "utf8");

/**
 * Every rectangle in a drawing, as a comparable string.
 *
 * Attribute ORDER is deliberately not compared, and neither is colour: the
 * component inherits `currentColor` and the derivations cannot, which is the
 * whole reason they exist. Geometry is the thing that has to agree.
 */
function rectangles(source: string): string[] {
  const found: string[] = [];
  for (const [tag] of source.matchAll(/<rect[\s\S]*?\/>/g)) {
    const at = (name: string) => {
      // Matches both `x="8"` in SVG and `x="8"` in JSX, which are the same.
      const m = new RegExp(`\\b${name}=["{]*"?([\\d.]+)"?`).exec(tag);
      return m ? m[1]! : "";
    };
    const geometry = ["x", "y", "width", "height", "rx"].map((n) => `${n}:${at(n)}`).join(" ");
    // The full-bleed background rectangle of a derivation has no x or y and is
    // not part of the mark.
    if (at("x") === "" && at("y") === "") continue;
    found.push(geometry);
  }
  return found;
}

const DERIVED = ["brand/avatar.svg", "brand/mail-logo.svg"];

describe("every drawing of the mark is the same mark", () => {
  const master = rectangles(read("apps/web/src/Brand.tsx"));

  it("finds the mark in the component at all", () => {
    // A gate that silently compares two empty lists passes forever.
    expect(master.length, "Brand.tsx no longer draws rectangles").toBe(4);
  });

  for (const file of DERIVED) {
    it(`${file} matches Brand.tsx`, () => {
      expect(
        rectangles(read(file)),
        `${file} has drifted from apps/web/src/Brand.tsx. Change both, and ` +
          `re-render the raster files with the commands in brand/README.md.`,
      ).toEqual(master);
    });
  }

  /**
   * The derivations carry their own background, and the component does not.
   * That difference is the point rather than an oversight: a mark in the
   * primary blue on transparency disappears against the dark background a mail
   * client in dark mode, or a service with a dark profile page, puts behind it.
   */
  it("gives each derivation a background the component does not need", () => {
    for (const file of DERIVED) {
      expect(read(file), `${file} would vanish on a dark background`).toMatch(
        /<rect[^>]*fill="#1B4A8F"/,
      );
    }
    expect(read("apps/web/src/Brand.tsx")).not.toContain("#1B4A8F");
  });

  /**
   * The mail logo is referenced by `cid:` from the HTML part. If the constant
   * and the reference ever disagree the image silently becomes an attachment
   * the reader is invited to download, which is the opposite of a signature.
   */
  it("keeps the attached mark a PNG of the size the HTML claims", () => {
    const logo = read("apps/worker/src/logo.ts");
    const base64 = /"([A-Za-z0-9+/=]{100,})"/.exec(logo);
    expect(base64, "logo.ts no longer holds the image").not.toBeNull();
    const bytes = Buffer.from(base64![1]!, "base64");
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(96);
    expect(bytes.readUInt32BE(20)).toBe(96);
  });

  /**
   * The avatar is square and most services crop a profile picture to a circle.
   * The mark has to survive that crop, so it stays inside the inscribed
   * circle: the corner of its bounding box, measured from the centre, must be
   * nearer than the radius.
   */
  it("keeps the avatar inside the circle a service will crop it to", () => {
    const svg = read("brand/avatar.svg");
    const t = /translate\(([\d.]+),([\d.]+)\) scale\(([\d.]+)\)/.exec(svg);
    expect(t, "the avatar no longer places the mark with translate and scale").not.toBeNull();
    const [x, y, scale] = [Number(t![1]), Number(t![2]), Number(t![3])];
    // The component's own viewBox, which is what the mark is drawn in.
    const [w, h] = [40 * scale, 52 * scale];
    const centre = 256;
    const corner = Math.hypot(Math.max(x + w - centre, centre - x), Math.max(y + h - centre, centre - y));
    expect(corner, "a circular crop would cut the mark").toBeLessThan(centre);
  });
});
