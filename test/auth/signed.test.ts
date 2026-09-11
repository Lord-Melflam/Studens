/**
 * The signed sign-in state.
 *
 * This is what carries the PKCE verifier, the `state` and the `nonce` between
 * the redirect out and the callback back. If a visitor can edit it, they can
 * substitute a `state` of their own choosing, and `state` is the only thing
 * standing between the callback and a cross-site request forgery.
 */
import { describe, expect, it } from "vitest";
import { BadSignedValue, readSignedValue, signValue } from "@studens/platform";

const KEY = "a-test-signing-key-long-enough";
const NOW = new Date("2026-09-12T12:00:00Z");
const later = (seconds: number): Date => new Date(NOW.getTime() + seconds * 1000);

interface State {
  provider: string;
  state: string;
}
const value: State = { provider: "fake", state: "the-state" };

describe("a value survives the round trip", () => {
  it("comes back as it went in", () => {
    const back = readSignedValue<State>(KEY, signValue(KEY, value, NOW), 900, NOW);
    expect(back.provider).toBe("fake");
    expect(back.state).toBe("the-state");
  });

  it("carries its own timestamp, so the reader decides the lifetime", () => {
    const back = readSignedValue<State>(KEY, signValue(KEY, value, NOW), 900, NOW);
    expect(back.at).toBe(Math.floor(NOW.getTime() / 1000));
  });
});

describe("a value that has been changed is refused", () => {
  const signed = signValue(KEY, value, NOW);

  it("an edited payload", () => {
    const [, sig] = signed.split(".");
    const forged = Buffer.from(JSON.stringify({ ...value, state: "mine", at: 1 })).toString(
      "base64url",
    );
    expect(() => readSignedValue(KEY, `${forged}.${sig}`, 900, NOW)).toThrow(BadSignedValue);
  });

  it("an edited signature", () => {
    const [payload, sig] = signed.split(".");
    const flipped = sig!.endsWith("A") ? `${sig!.slice(0, -1)}B` : `${sig!.slice(0, -1)}A`;
    expect(() => readSignedValue(KEY, `${payload}.${flipped}`, 900, NOW)).toThrow(/signature/);
  });

  it("a value signed with someone else's key", () => {
    const theirs = signValue("a-different-key-entirely", value, NOW);
    expect(() => readSignedValue(KEY, theirs, 900, NOW)).toThrow(/signature/);
  });

  it("a signature of a different length, which must not throw from the comparison", () => {
    const [payload] = signed.split(".");
    // timingSafeEqual throws on a length mismatch. If that escaped, a short
    // signature would crash the request instead of being refused.
    expect(() => readSignedValue(KEY, `${payload}.short`, 900, NOW)).toThrow(BadSignedValue);
  });

  it("nothing at all, or something shapeless", () => {
    for (const raw of [null, undefined, "", "no-dot-here", ".", "a."]) {
      expect(() => readSignedValue(KEY, raw, 900, NOW)).toThrow(BadSignedValue);
    }
  });
});

describe("a value that is too old is refused", () => {
  it("accepts it inside the window", () => {
    expect(() => readSignedValue(KEY, signValue(KEY, value, NOW), 900, later(899))).not.toThrow();
  });

  it("refuses it outside, however valid the signature", () => {
    expect(() => readSignedValue(KEY, signValue(KEY, value, NOW), 900, later(901))).toThrow(
      /expired/,
    );
  });
});
