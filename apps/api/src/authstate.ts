/**
 * The state of one sign-in attempt, in a signed cookie.
 *
 * It holds the PKCE verifier, the `state` and the `nonce` between the redirect
 * out and the callback back. Sixty seconds of useful life, so a database table
 * with a cleanup job would be a lot of machinery for nothing
 * (design/authentication.md 0.5).
 *
 * The cookie is integrity protected, not encrypted. Nothing in it is a secret
 * from the person holding it: the verifier is theirs, and it is useless without
 * the authorization code the provider will hand to this server. What matters is
 * that they cannot CHANGE it, because swapping in a `state` of their choosing
 * is precisely the cross-site request forgery `state` exists to stop.
 */
import type { Request, Response } from "express";
import { BadSignedValue, readSignedValue, signValue } from "@studens/platform";
import { secureCookies } from "./cookies.js";

const NAME = "studens_auth";
/** Long enough for a slow sign-in, short enough that a stolen one is stale. */
const MAX_AGE_SECONDS = 15 * 60;

export interface AuthState {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Seconds since the epoch. Checked on the way back in. */
  at: number;
}

export class NoAuthState extends Error {
  constructor(reason: string) {
    super(`auth state: ${reason}`);
    this.name = "NoAuthState";
  }
}

/**
 * The signing key.
 *
 * Refused in production if unset, the same fence as the development identity:
 * a default secret in a public repository is not a secret, and silently
 * inventing one per process would break sign-in across restarts and behind any
 * second instance, which is a confusing way to learn the variable is missing.
 */
export function signingKey(): string {
  const key = process.env["STUDENS_SESSION_SECRET"];
  if (key && key.length >= 16) return key;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "STUDENS_SESSION_SECRET is required in production and must be at least 16 characters. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return "development-only-not-a-secret";
}

export function setAuthState(res: Response, value: Omit<AuthState, "at">): void {
  const cookie = signValue(signingKey(), value);
  const bits = [
    `${NAME}=${cookie}`,
    "Path=/api/auth",
    "HttpOnly",
    // Lax, for the same reason as the session cookie: the provider sends the
    // browser back with a top-level cross-site GET, and Strict would withhold
    // this on exactly that request, so no sign-in could ever complete.
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (secureCookies()) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}

export function clearAuthState(res: Response): void {
  const bits = [`${NAME}=`, "Path=/api/auth", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secureCookies()) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}

function readRaw(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === NAME) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

export function readAuthState(req: Request): AuthState {
  try {
    return readSignedValue<AuthState>(signingKey(), readRaw(req), MAX_AGE_SECONDS);
  } catch (err) {
    if (err instanceof BadSignedValue) throw new NoAuthState(err.reason);
    throw err;
  }
}
