/**
 * OPEN-23: CONTRIBUTION TEXT DOES NOT LEAVE THIS MACHINE.
 *
 * Resolved 2026-09-27 as "no, never, with no exception path". A policy
 * nobody can check is worth less than a smaller policy anybody can, so this
 * is the check.
 *
 * WHAT IS ASSERTED, precisely. The module that holds review text,
 * `packages/ryc`, makes no network call of any kind. Not "does not call an
 * inference API", which would be a list of vendors that goes stale: it opens
 * no socket, so there is no call to classify. A future screening feature that
 * wanted to send text somewhere would have to delete this file first, which is
 * a visible act in a diff rather than an import nobody noticed.
 *
 * WHAT IS NOT ASSERTED, and why the rule is scoped rather than global. Other
 * parts of the system legitimately use the network and must keep doing so.
 * They are enumerated below rather than waved at, because an exception list
 * that is not written down is the same as no rule.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;

/**
 * The places egress is expected, each with what it talks to.
 *
 * Adding to this list is a claim that a new thing on the network is
 * deliberate. Nothing here touches review text:
 */
const EXPECTED = {
  "packages/ref": "the catalogue crawler, which fetches public university pages",
  "packages/platform/src/oidc.ts": "OIDC: the provider's discovery document and its signing keys",
  "apps/worker/src/send-mail.ts": "SMTP, to the configured relay",
  // Browser code. A page fetching its own API is not egress from the server,
  // and these files hold no review text of anybody else's.
  "packages/ryc-ui": "the browser calling this product's own API",
  "apps/web": "the browser calling this product's own API",
};

/** Anything that opens a socket, by the names available in this codebase. */
const NETWORK = /\bfetch\s*\(|from "node:(?:http|https|net|tls|dgram)"|createRemoteJWKSet|\bXMLHttpRequest\b/;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("OPEN-23: the module holding review text opens no socket", () => {
  const files = sources(join(root, "packages/ryc/src"));

  it("has the module's sources to check", () => {
    // A gate that walks an empty tree passes forever.
    expect(files.length).toBeGreaterThan(3);
  });

  it("makes no network call anywhere in packages/ryc", () => {
    const offenders = files
      .filter((f) => NETWORK.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length));
    expect(
      offenders,
      "OPEN-23 says review text never reaches a third party. This module holds " +
        "that text, so it opens no socket at all. If screening is ever built it " +
        "runs locally (OPEN-17); sending text somewhere means reopening OPEN-23 " +
        "in the specification first, not adding an import here.",
    ).toEqual([]);
  });

  /**
   * The same property one layer out, stated as a shape rather than a list.
   * The composition layer may call the network for sign-in and for mail; it
   * may not do so in a route that carries a review body.
   */
  it("keeps the review routes free of it too", () => {
    const reviews = readFileSync(join(root, "apps/api/src/routes/reviews.ts"), "utf8");
    expect(NETWORK.test(reviews), "a review route reached the network").toBe(false);
  });

  it("documents every place egress IS expected", () => {
    for (const [where, why] of Object.entries(EXPECTED)) {
      expect(why.length, `${where} is excused without saying what it talks to`).toBeGreaterThan(15);
    }
    // The list is about server-side egress plus the browser's own calls; it is
    // not a claim that nothing else exists, so it is checked for honesty
    // rather than completeness.
    expect(Object.keys(EXPECTED).length).toBeGreaterThan(3);
  });
});
