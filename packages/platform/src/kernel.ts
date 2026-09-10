/**
 * THE ANONYMITY KERNEL.
 *
 * The smallest piece of code that the whole privacy design depends on, kept
 * small on purpose so it can be read in full and tested exhaustively. This is
 * the safety kernel pattern: concentrate the critical property in one place
 * rather than spreading it across the system.
 *
 * WHAT IT GUARANTEES
 *
 *   1. A member cannot exceed their quota (FR-C4), enforced by a single
 *      conditional statement rather than a read followed by a write.
 *   2. The quota increment and the contribution write happen in ONE
 *      transaction, so neither can exist without the other (FR-C13).
 *   3. Nothing links them. The kernel never learns what the module wrote, and
 *      the module never learns the member id reached the database.
 *
 * WHY IT IS SHAPED LIKE THIS
 *
 * The kernel does not know what a review is, and must not: `packages/platform`
 * is tier 1 and importing anything from `ryc` would invert FR-B10's dependency
 * direction. So the module passes a callback, which the kernel runs INSIDE its
 * transaction, on its own connection.
 *
 * That connection is what makes it work. `studens_ryc` holds SELECT and nothing
 * else on the anonymous table, so a module cannot write one by itself at any
 * price; `studens_platform` holds INSERT. The quota therefore cannot be
 * bypassed by the module that owns the feature, and the exception is one grant
 * rather than an open door. See docs/design/backend-design.tex section 5.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { QUOTA_PER_WINDOW, QuotaExceeded, WINDOW_DAYS, windowStartFor } from "./quota.js";

/** What the kernel hands the module: a transaction it may write through. */
export type KernelTx = Prisma.TransactionClient;

export interface WithQuotaOptions {
  client?: PrismaClient;
  now?: Date;
  limit?: number;
  windowDays?: number;
  /**
   * Role that performs the QUOTA update. A missing grant then fails here
   * rather than being masked by a more privileged connection, which makes
   * every run a check of the grants.
   */
  assumeRole?: string | null;
  /**
   * Role that performs the module's WRITE, if it differs from the quota role.
   *
   * The two paths need different answers, and finding that out was the
   * useful part:
   *
   *   ANONYMOUS   both halves run as studens_platform, because studens_ryc
   *               deliberately holds no INSERT on the anonymous table. That
   *               is the kernel.
   *
   *   ATTRIBUTED  the quota runs as studens_platform and the insert as
   *               studens_ryc, because the platform deliberately holds no
   *               grant on a feature module's own data. The attributed row
   *               carries a memberId openly (FR-C7) and needs no kernel: it
   *               needs the quota.
   *
   * Both stay in ONE transaction. A role switch inside a transaction is
   * permitted as long as the session user is a member of both roles, which is
   * a deployment requirement recorded in backend-design.tex.
   */
  writeRole?: string | null;
}

/**
 * Spend one unit of `memberId`'s quota and run `write` in the same
 * transaction. If the quota is exhausted, `write` never runs and nothing is
 * committed.
 *
 * The member id is used here and passed to nothing.
 */
export async function withQuota<T>(
  memberId: string,
  write: (tx: KernelTx) => Promise<T>,
  opts: WithQuotaOptions = {},
): Promise<T> {
  const prisma = opts.client ?? new PrismaClient();
  const limit = opts.limit ?? QUOTA_PER_WINDOW;
  const windowDays = opts.windowDays ?? WINDOW_DAYS;
  const windowStart = windowStartFor(opts.now ?? new Date(), windowDays);
  const quotaRole = opts.assumeRole === undefined ? "studens_platform" : opts.assumeRole;
  const writeRole = opts.writeRole === undefined ? quotaRole : opts.writeRole;

  try {
    return await prisma.$transaction(async (tx) => {
      if (quotaRole) {
        // A role name is an identifier and cannot be a bound parameter, so it
        // is validated against a strict pattern and then interpolated.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${quoteIdent(quotaRole)}`);
      }

      /**
       * ONE STATEMENT, and the reason it is one statement is the whole point.
       *
       * An earlier version of this design read the counter, compared it to the
       * limit, then wrote. Two submissions arriving together both read the same
       * value, both pass the comparison, and both write: a textbook race that
       * would have let a member exceed their quota under exactly the conditions
       * where it matters.
       *
       * Here the check IS the write. The `WHERE` on the conflict branch is the
       * guard: if it does not hold, no row is updated and none is returned.
       *
       *   no row yet                  -> insert with used = 1
       *   row from an older window    -> reset to 1, the window rolled over
       *   row in this window, room    -> increment
       *   row in this window, no room -> WHERE fails, nothing returned, refused
       */
      const rows = await tx.$queryRaw<Array<{ used: number }>>`
        INSERT INTO "platform"."MemberQuota" ("memberId", "windowStart", "used")
        VALUES (${memberId}, ${windowStart}::date, 1)
        ON CONFLICT ("memberId") DO UPDATE
          SET "windowStart" = ${windowStart}::date,
              "used" = CASE
                WHEN "MemberQuota"."windowStart" = ${windowStart}::date
                THEN "MemberQuota"."used" + 1
                ELSE 1
              END
          WHERE "MemberQuota"."windowStart" <> ${windowStart}::date
             OR "MemberQuota"."used" < ${limit}
        RETURNING "used"`;

      if (rows.length === 0) throw new QuotaExceeded(limit, windowDays);

      // Hand the write to the role that owns the table it targets. Still the
      // same transaction, so the quota and the row remain all or nothing.
      if (writeRole !== quotaRole) {
        await tx.$executeRawUnsafe(
          writeRole ? `SET LOCAL ROLE ${quoteIdent(writeRole)}` : "RESET ROLE",
        );
      }

      // The module writes its own row, through this transaction, on this
      // connection. The kernel does not inspect the result and does not log it.
      return await write(tx);
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/** How much of the window remains. A question about the member, never about a contribution. */
export async function quotaRemaining(
  memberId: string,
  opts: WithQuotaOptions = {},
): Promise<number> {
  const prisma = opts.client ?? new PrismaClient();
  const limit = opts.limit ?? QUOTA_PER_WINDOW;
  const windowStart = windowStartFor(opts.now ?? new Date(), opts.windowDays ?? WINDOW_DAYS);
  try {
    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    if (!row || row.windowStart.getTime() !== windowStart.getTime()) return limit;
    return Math.max(0, limit - row.used);
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`refusing to use ${name} as a role name`);
  return `"${name}"`;
}
