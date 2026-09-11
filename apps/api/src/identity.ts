/**
 * WHO IS MAKING THIS REQUEST.
 *
 * One seam, two things behind it:
 *
 *   1. A SESSION COOKIE, which is the real mechanism (FR-A1 to FR-A5). Checked
 *      first, always, in development as much as in production.
 *   2. The DEVELOPMENT IDENTITY, which now signs a fixed member IN rather than
 *      pretending a session exists. It is a stand-in for a provider, not a
 *      stand-in for the session layer, so the session layer is exercised on
 *      every local request instead of being bypassed until OAuth lands.
 *
 * The fence around (2) is unchanged and is the reason it can exist at all:
 *
 *   - off unless STUDENS_DEV_IDENTITY is set explicitly
 *   - refuses to work when NODE_ENV is "production", whatever else is set
 *   - the process logs a warning naming FR-A every time it starts with it
 *
 * FR-A4: every failure below raises the same NotAuthenticated. A caller must
 * never learn whether a token was unknown, revoked or merely stale, because
 * "revoked" tells the holder that the token they have was once real.
 */
import { PrismaClient } from "@prisma/client";
import { createSession, verifySession, type SessionIdentity } from "@studens/platform";
import type { Request, Response } from "express";
import { readSessionToken, setSessionCookie } from "./cookies.js";

export class NotAuthenticated extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotAuthenticated";
  }
}

export type Identity = SessionIdentity;

export function devIdentityEnabled(): boolean {
  return (
    process.env["STUDENS_DEV_IDENTITY"] === "1" && process.env["NODE_ENV"] !== "production"
  );
}

/** The member the development identity signs in as. Created once, reused. */
async function devMember(prisma: PrismaClient): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-00000000dev0" },
    update: {},
    create: { id: "00000000-0000-0000-0000-00000000dev0", name: "UCLouvain" },
  });
  const member = await prisma.member.upsert({
    where: { provider_providerSubject: { provider: "dev", providerSubject: "local" } },
    update: {},
    create: {
      provider: "dev",
      providerSubject: "local",
      emailDomain: "student.uclouvain.be",
      displayName: "Développeur local",
      tenantId: tenant.id,
    },
  });
  return member.id;
}

/**
 * The one place a request turns into a member.
 *
 * `res` is optional so that read paths can ask "is anyone signed in?" without
 * being able to start a session as a side effect. Only a handler that passes a
 * response can be signed in by the development identity.
 */
export async function identify(
  prisma: PrismaClient,
  req?: Request,
  res?: Response,
): Promise<Identity> {
  if (req) {
    try {
      return await verifySession(readSessionToken(req), { client: prisma });
    } catch {
      // Fall through. Which of the five reasons it was does not leave here.
    }
  }

  if (!devIdentityEnabled()) throw new NotAuthenticated();

  // The development identity issues a REAL session, so everything downstream
  // is the same code path production will use.
  if (!res) throw new NotAuthenticated();
  const memberId = await devMember(prisma);
  const { token } = await createSession(memberId, { client: prisma });
  setSessionCookie(res, token);
  return await verifySession(token, { client: prisma });
}

/** For read paths: who is this, or nobody, without starting anything. */
export async function identifyIfAny(
  prisma: PrismaClient,
  req: Request,
): Promise<Identity | null> {
  try {
    return await verifySession(readSessionToken(req), { client: prisma });
  } catch {
    return null;
  }
}
