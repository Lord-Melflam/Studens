/**
 * The session cookie.
 *
 * Attributes and their reasons, from design/authentication.md 0.3:
 *
 *   HttpOnly    script cannot read it, so an XSS is not an account takeover
 *   SameSite=Lax  NOT Strict. The provider redirects the browser back to our
 *               callback as a top-level cross-site GET, and Strict withholds the
 *               cookie on exactly that request, so sign-in could never complete.
 *   Secure      whenever the connection is HTTPS
 *   __Host-     prefix when Secure, which binds the cookie to this exact host
 *               with no Domain and Path=/, so a sibling subdomain cannot set it
 *   Path=/      required by the __Host- prefix, and correct anyway
 *
 * Lax still sends the cookie on a cross-site top-level GET, so no endpoint that
 * changes state may be a GET. Every write in this API is a POST already; this
 * is the reason it has to stay that way.
 */
import type { Request, Response } from "express";
import { ABSOLUTE_DAYS } from "@studens/platform";

const SECURE_NAME = "__Host-studens_session";
const PLAIN_NAME = "studens_session";

export function secureCookies(): boolean {
  // Behind a proxy the app sees http, so the deployment sets this explicitly
  // rather than guessing from the request.
  return process.env["STUDENS_SECURE_COOKIES"] === "1" || process.env["NODE_ENV"] === "production";
}

export function cookieName(): string {
  return secureCookies() ? SECURE_NAME : PLAIN_NAME;
}

/** Read the session token, whichever name this deployment uses. */
export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SECURE_NAME || name === PLAIN_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim()) || undefined;
    }
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = secureCookies();
  const bits = [
    `${cookieName()}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    // The cookie's own lifetime matches the ABSOLUTE limit, never the idle one.
    // A shorter Max-Age would sign people out that the server still considers
    // signed in, and the idle rule is enforced server side where it cannot be
    // edited by the browser.
    `Max-Age=${ABSOLUTE_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}

export function clearSessionCookie(res: Response): void {
  const bits = [`${cookieName()}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secureCookies()) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}
