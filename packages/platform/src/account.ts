/**
 * Leaving, and taking your data with you. FR-A15, GDPR Articles 17 and 20.
 *
 * Also the plainer point: an account you cannot leave is a product people do
 * not join, and one that cannot show you what it holds is one they do not
 * believe.
 *
 * THE PLATFORM DOES NOT KNOW WHAT A MODULE STORES. Deleting an account has to
 * reach a module's tables, and the platform may not know they exist (FR-B16),
 * so each module hands over a function and the platform calls it inside the one
 * transaction. That is the same shape as the username resolver: the module
 * keeps its own grants, the platform keeps its ignorance, and the composition
 * happens once in the API.
 *
 * The alternative, a platform that knows the review tables, would put a
 * module's domain inside the service that holds identity, and the next module
 * would have to edit this file to be deletable.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * What a module does when a Member leaves.
 *
 * Runs inside the deletion transaction, so a module that throws aborts the
 * whole thing and the account is still there. That is the right failure: a
 * half-deleted account is worse than a refused deletion, because the person
 * believes it is gone.
 */
export interface MemberErasure {
  /** For the report the API returns, and for the audit trail. */
  readonly module: string;
  /**
   * Detach or delete whatever this module holds for the member, and say how
   * many rows it touched.
   */
  erase(tx: Prisma.TransactionClient, memberId: string): Promise<number>;
  /** Everything this module holds about them, for the export (Article 20). */
  export?(tx: Prisma.TransactionClient, memberId: string): Promise<unknown>;
}

export interface DeletionReport {
  memberId: string;
  /** Rows touched per module, so the confirmation can say what happened. */
  modules: Record<string, number>;
  sessionsRevoked: number;
}

/**
 * Delete the account, permanently.
 *
 * ONE TRANSACTION. Sessions, preferences, quota and every module's rows go
 * together with the Member, or nothing goes. A deletion that half-applied would
 * leave somebody signed in to an account that no longer exists.
 *
 * WHAT IT CANNOT REACH, and this is the guarantee working rather than failing:
 * anonymous contributions. Nothing joins them to a member (FR-C2), so there is
 * no query that could find them. FR-C9 says this before the contribution is
 * made, on the screen, which is the only moment at which saying it helps.
 */
export async function deleteAccount(
  prisma: PrismaClient,
  memberId: string,
  opts: { erasures?: MemberErasure[] } = {},
): Promise<DeletionReport> {
  const erasures = opts.erasures ?? [];
  const modules: Record<string, number> = {};

  const sessionsRevoked = await prisma.$transaction(async (tx) => {
    for (const e of erasures) {
      modules[e.module] = await e.erase(tx, memberId);
    }

    // Sessions are deleted rather than revoked. FR-E1 keeps an audit trail of
    // moderation, not of who was signed in; a revoked row here would be a
    // record of a person who asked to be forgotten.
    const sessions = await tx.session.deleteMany({ where: { memberId } });
    await tx.notificationPreference.deleteMany({ where: { memberId } });
    await tx.memberQuota.deleteMany({ where: { memberId } });
    await tx.member.delete({ where: { id: memberId } });
    return sessions.count;
  });

  return { memberId, modules, sessionsRevoked };
}

export interface AccountExport {
  exportedAt: string;
  account: Record<string, unknown>;
  notifications: Array<{ kind: string; enabled: boolean; decidedAt: string }>;
  sessions: Array<{ startedAt: string; lastSeenAt: string; revoked: boolean }>;
  modules: Record<string, unknown>;
  /**
   * Said inside the file, not only on the page that produced it. An export is
   * read months later, out of context, and its silences need explaining.
   */
  notIncluded: string[];
}

/**
 * Everything held about a Member, as data they can keep (Article 20).
 *
 * Deliberately not a curated summary: it is the columns, named as they are
 * named, so it can be checked against the schema in the public repository.
 */
export async function exportAccount(
  prisma: PrismaClient,
  memberId: string,
  opts: { erasures?: MemberErasure[] } = {},
): Promise<AccountExport> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      notifications: true,
      sessions: { orderBy: { issuedAt: "desc" } },
      quota: true,
    },
  });
  if (!member) throw new Error("no such member");

  const { notifications, sessions, quota, ...account } = member;

  const modules: Record<string, unknown> = {};
  for (const e of opts.erasures ?? []) {
    if (e.export) modules[e.module] = await e.export(prisma, memberId);
  }

  return {
    exportedAt: new Date().toISOString(),
    account: {
      ...account,
      // The quota is two numbers and no timestamps, by design
      // (docs/design/anonymous-rate-limiting.md). Included so the export shows that
      // is all it is.
      quota: quota ? { windowStart: quota.windowStart, used: quota.used } : null,
    },
    notifications: notifications.map((n) => ({
      kind: n.kind,
      enabled: n.enabled,
      decidedAt: n.decidedAt.toISOString(),
    })),
    sessions: sessions.map((s) => ({
      startedAt: s.issuedAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      revoked: s.revokedAt !== null,
    })),
    modules,
    notIncluded: [
      "Anonymous contributions. Nothing links them to an account, so there is " +
        "no query that could find yours. That is the guarantee, not an omission.",
      "Your provider password. We have never had one: sign-in is delegated.",
      "IP addresses and device information. None are recorded.",
    ],
  };
}
