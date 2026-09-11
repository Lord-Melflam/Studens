/**
 * A short-lived value the browser may hold but must not be able to change.
 *
 * Used for the sign-in attempt state (PKCE verifier, `state`, `nonce`). Signed,
 * not encrypted: nothing in it is a secret from the person holding it, and the
 * property that matters is that they cannot substitute a `state` of their own,
 * which is exactly what `state` exists to prevent.
 *
 * The crypto lives here rather than beside the cookie code so that it can be
 * tested through the package's public entry point, like everything else.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export class BadSignedValue extends Error {
  constructor(readonly reason: "malformed" | "signature" | "unreadable" | "expired") {
    super(`signed value: ${reason}`);
    this.name = "BadSignedValue";
  }
}

function mac(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Stamps the value with the current time, so the reader decides the lifetime. */
export function signValue(key: string, value: object, now: Date = new Date()): string {
  const payload = Buffer.from(
    JSON.stringify({ ...value, at: Math.floor(now.getTime() / 1000) }),
  ).toString("base64url");
  return `${payload}.${mac(key, payload)}`;
}

export function readSignedValue<T>(
  key: string,
  raw: string | null | undefined,
  maxAgeSeconds: number,
  now: Date = new Date(),
): T & { at: number } {
  if (!raw) throw new BadSignedValue("malformed");
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) throw new BadSignedValue("malformed");

  const payload = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(mac(key, payload));
  // Compare in constant time, and only after the lengths match: timingSafeEqual
  // throws on a length mismatch, which would itself be a signal.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new BadSignedValue("signature");
  }

  let parsed: T & { at: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & { at: number };
  } catch {
    throw new BadSignedValue("unreadable");
  }
  if (typeof parsed.at !== "number") throw new BadSignedValue("unreadable");
  // Our clock decides, not the cookie's Max-Age, which is the browser's to edit.
  if (Math.floor(now.getTime() / 1000) - parsed.at > maxAgeSeconds) {
    throw new BadSignedValue("expired");
  }
  return parsed;
}
