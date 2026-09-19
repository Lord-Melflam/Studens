/**
 * TELLING SOMEBODY THEY ARE SUSPENDED, without letting them in.
 *
 * A suspended account's session is refused like any other failure (FR-A4: one
 * message, whatever went wrong), which is right for an API and wrong for a
 * person. It made a suspension look exactly like the site being down: a tester
 * pointed out that somebody would reasonably conclude the app was temporarily
 * unreachable and keep trying.
 *
 * So at SIGN-IN, where the provider has just proved who they are, they are
 * told. That is a different moment from a failing request and deserves a
 * different answer: the person is standing in front of the screen, they
 * authenticated successfully, and the only reason they are not coming in is
 * one we decided and should be able to explain.
 *
 * A SHORT LIVED SIGNED COOKIE, NOT A SESSION. They get no session, no member
 * id in a URL, and no access to anything: the cookie says "this browser
 * completed a sign-in as this member, a moment ago" and the suspension
 * endpoint will answer questions about that member and nothing else. Ten
 * minutes, because it exists to survive one redirect and a page load.
 *
 * WHY NOT PUT THE REASON IN THE URL. It would be in browser history, in any
 * shoulder's view and in whatever syncs bookmarks, for a message that is
 * nobody's business but theirs. Same argument as FR-C9's about draft text.
 */
import type { Request, Response } from "express";
import { BadSignedValue, readSignedValue, signValue } from "@studens/platform";
import { signingKey } from "./authstate.js";
import { secureCookies } from "./cookies.js";

const NAME = "studens_suspended";
/** Long enough for one redirect and a page load, and no longer. */
const MAX_AGE_SECONDS = 600;

interface Notice {
  memberId: string;
  at: string;
}

export function setSuspensionNotice(res: Response, memberId: string): void {
  const bits = [
    `${NAME}=${signValue(signingKey(), { memberId })}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (secureCookies()) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}

export function clearSuspensionNotice(res: Response): void {
  const bits = [`${NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secureCookies()) bits.push("Secure");
  res.append("Set-Cookie", bits.join("; "));
}

/** Whose suspension this browser may be told about, or null. */
export function readSuspensionNotice(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  let raw: string | null = null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === NAME) raw = part.slice(eq + 1).trim() || null;
  }
  try {
    return readSignedValue<Notice>(signingKey(), raw, MAX_AGE_SECONDS).memberId;
  } catch (err) {
    if (err instanceof BadSignedValue) return null;
    throw err;
  }
}
