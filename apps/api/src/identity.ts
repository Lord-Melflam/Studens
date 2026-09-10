/**
 * WHO IS SUBMITTING.
 *
 * FR-A is not built: there is no OAuth, no session, no sign-in. The quota is
 * per member (FR-C4), so submission cannot work without a member, which makes
 * this the gate between the review path and anything real.
 *
 * So this module provides a DEVELOPMENT identity, and fences it hard enough
 * that it cannot become the product by accident:
 *
 *   - it is off unless STUDENS_DEV_IDENTITY is set explicitly
 *   - it refuses to work when NODE_ENV is "production", whatever else is set
 *   - the process logs a warning naming FR-A every time it starts with it
 *
 * The alternative was to build the review path without submission, which would
 * have left the kernel untested against a real request. The alternative to THAT
 * was to build OAuth first, which needs client credentials from Microsoft and
 * Google that only François can register.
 */
import { PrismaClient } from "@prisma/client";

export class NotAuthenticated extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotAuthenticated";
  }
}

export interface Identity {
  memberId: string;
  /** FR-A9: from the verified provider token. Invented here, hence dev only. */
  emailDomain: string;
}

let devIdentity: Identity | null = null;

export function devIdentityEnabled(): boolean {
  return (
    process.env["STUDENS_DEV_IDENTITY"] === "1" && process.env["NODE_ENV"] !== "production"
  );
}

/**
 * Ensure a development member exists and return it. Never called when the dev
 * identity is disabled.
 */
export async function ensureDevIdentity(prisma: PrismaClient): Promise<Identity> {
  if (!devIdentityEnabled()) throw new NotAuthenticated();
  if (devIdentity) return devIdentity;

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
  devIdentity = { memberId: member.id, emailDomain: member.emailDomain };
  return devIdentity;
}

/** The one place a request turns into a member. Replaced wholesale by FR-A. */
export async function identify(prisma: PrismaClient): Promise<Identity> {
  if (!devIdentityEnabled()) throw new NotAuthenticated();
  return ensureDevIdentity(prisma);
}
