/**
 * Sessions: proving who is making a request, and being able to stop.
 *
 * The token in the cookie is 32 random bytes. What is stored here is its
 * SHA-256, so this table is not a set of working cookies if a snapshot of it
 * ever leaves the machine. The FR-C3 threat model already assumes an adversary
 * may hold one. See docs/design/authentication.md 0.2.
 *
 * Two expiries, both from FR-A3, and they answer different questions:
 *
 *   IDLE_DAYS      how long a session survives without being used. Limits the
 *                  window on a stolen cookie from a device nobody touches.
 *   ABSOLUTE_DAYS  how long a session may live at all, however active. Limits
 *                  the window on a cookie stolen from a device in daily use,
 *                  which the idle timer alone would never close.
 *
 * Neither is enforced by a scheduled job. Expiry is computed at verification
 * time, so a session is dead the moment it is too old, whether or not anything
 * has run since.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** FR-A3. */
export const IDLE_DAYS = 14;
/** FR-A3. */
export const ABSOLUTE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 32 bytes, base64url. Long enough that guessing is not a threat model entry. */
const TOKEN_BYTES = 32;

export interface SessionIdentity {
  sessionId: string;
  memberId: string;
  /** FR-A9. From the verified provider token, never from user input. */
  emailDomain: string;
  role: string;
}

export class NoSession extends Error {
  constructor(readonly reason: "absent" | "unknown" | "revoked" | "idle" | "expired") {
    // FR-A4: the reason is for logs and tests, never for the response body. A
    // client that learns "revoked" rather than "unknown" learns that the token
    // it holds was real.
    super(`no session: ${reason}`);
    this.name = "NoSession";
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export interface SessionOptions {
  client?: PrismaClient;
  now?: Date;
}

/**
 * Start a session and return the token to put in the cookie.
 *
 * The token is returned once and never again: it exists in this return value
 * and in the browser, and nowhere else.
 */
export async function createSession(
  memberId: string,
  opts: SessionOptions = {},
): Promise<{ token: string; sessionId: string }> {
  const prisma = opts.client ?? new PrismaClient();
  const now = opts.now ?? new Date();
  const token = newToken();
  try {
    const row = await prisma.session.create({
      data: {
        memberId,
        tokenHash: hashToken(token),
        issuedAt: now,
        lastSeenAt: now,
      },
      select: { id: true },
    });
    return { token, sessionId: row.id };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * Verify a token and return who it belongs to, touching `lastSeenAt`.
 *
 * Throws NoSession for every failure. The caller turns all of them into the
 * same response (FR-A4).
 */
export async function verifySession(
  token: string | undefined,
  opts: SessionOptions = {},
): Promise<SessionIdentity> {
  if (!token) throw new NoSession("absent");
  const prisma = opts.client ?? new PrismaClient();
  const now = opts.now ?? new Date();
  try {
    const row = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        memberId: true,
        issuedAt: true,
        lastSeenAt: true,
        revokedAt: true,
        member: { select: { emailDomain: true, role: true } },
      },
    });
    if (!row) throw new NoSession("unknown");
    if (row.revokedAt) throw new NoSession("revoked");
    if (now.getTime() - row.lastSeenAt.getTime() > IDLE_DAYS * DAY_MS) {
      throw new NoSession("idle");
    }
    if (now.getTime() - row.issuedAt.getTime() > ABSOLUTE_DAYS * DAY_MS) {
      throw new NoSession("expired");
    }

    // Touch, but not on every request: a write per request turns a read-only
    // page view into a write, and the idle window is fourteen days, so minute
    // precision buys nothing. One write per hour of activity is enough.
    if (now.getTime() - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
      await prisma.session.update({ where: { id: row.id }, data: { lastSeenAt: now } });
    }

    return {
      sessionId: row.id,
      memberId: row.memberId,
      emailDomain: row.member.emailDomain,
      role: row.member.role,
    };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/** FR-A2. Ending a session is a revocation, so it stays auditable. */
export async function revokeSession(
  sessionId: string,
  opts: SessionOptions = {},
): Promise<void> {
  const prisma = opts.client ?? new PrismaClient();
  const now = opts.now ?? new Date();
  try {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

export interface ListedSession {
  id: string;
  issuedAt: Date;
  lastSeenAt: Date;
  current: boolean;
}

/**
 * FR-A5: a Member can see and revoke their active sessions.
 *
 * No IP address and no user agent. Both would be a per-session record of where
 * a member was and on what, which is data the platform has no use for and which
 * FR-B12's instinct argues against keeping. A member recognises a session by
 * when it started.
 */
export async function listSessions(
  memberId: string,
  currentSessionId: string,
  opts: SessionOptions = {},
): Promise<ListedSession[]> {
  const prisma = opts.client ?? new PrismaClient();
  const now = opts.now ?? new Date();
  try {
    const rows = await prisma.session.findMany({
      where: {
        memberId,
        revokedAt: null,
        lastSeenAt: { gt: new Date(now.getTime() - IDLE_DAYS * DAY_MS) },
        issuedAt: { gt: new Date(now.getTime() - ABSOLUTE_DAYS * DAY_MS) },
      },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, issuedAt: true, lastSeenAt: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === currentSessionId }));
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * Constant-time comparison, for anywhere a caller compares a secret itself
 * rather than looking one up by hash.
 */
export function secretEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
