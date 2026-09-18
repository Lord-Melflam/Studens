/**
 * Suspending an account.
 *
 * WHAT THIS IS NOT, and the interface has to keep saying so.
 *
 * It binds an ACCOUNT, never a person. Registration is open by design (FR-A6)
 * because no student roster is obtainable, so anybody suspended can make
 * another account in a minute. It is a speed bump, and OPEN-35 is explicit
 * that a speed bump must never be described as an integrity guarantee.
 *
 * It cannot reach the anonymous path (FR-E7). Suspending an account stops what
 * it submits next. The anonymous reviews it already published are not linked
 * to it, cannot be found from it, and cannot be gathered or removed as a set;
 * that is the guarantee working, not a gap. Individual content is still
 * removable by a moderator (FR-C10), one piece at a time, on its own merits.
 *
 * WHY SESSIONS ARE REVOKED IN THE SAME TRANSACTION. A suspension that leaves a
 * live session open is a suspension that starts whenever the browser next
 * decides to reauthenticate, which is not a time anybody chose.
 *
 * PERMANENT IS A STATE, NOT A FAR FUTURE DATE. `suspendedUntil` is null for it.
 * A sentinel date has to be recognised by every reader, and the one reader that
 * forgets prints "suspended until 9999" to somebody.
 */
import type { PrismaClient } from "@prisma/client";

export interface Suspension {
  suspended: boolean;
  /** Null while suspended means permanent. */
  until: Date | null;
  reason: string | null;
}

/** Whether an account is suspended right now. */
export function suspensionOf(
  member: { suspendedAt: Date | null; suspendedUntil: Date | null; suspendedReason: string | null },
  now: Date = new Date(),
): Suspension {
  if (member.suspendedAt === null) return { suspended: false, until: null, reason: null };
  // Expired suspensions are simply over. The columns are left alone rather
  // than cleared, so the history stays readable in the audit log beside them.
  if (member.suspendedUntil !== null && member.suspendedUntil <= now) {
    return { suspended: false, until: null, reason: null };
  }
  return { suspended: true, until: member.suspendedUntil, reason: member.suspendedReason };
}

/** The lengths the console offers. Fixed, because a free date invites "2099". */
export const SUSPENSION_DAYS = [7, 30, 90] as const;

export async function suspendMember(
  prisma: PrismaClient,
  memberId: string,
  opts: { days: number | null; reason: string; now?: Date },
): Promise<Suspension> {
  const now = opts.now ?? new Date();
  const until =
    opts.days === null ? null : new Date(now.getTime() + opts.days * 24 * 60 * 60 * 1000);
  const [member] = await prisma.$transaction([
    prisma.member.update({
      where: { id: memberId },
      data: { suspendedAt: now, suspendedUntil: until, suspendedReason: opts.reason },
    }),
    // In the same transaction as the suspension itself: see the note above.
    prisma.session.deleteMany({ where: { memberId } }),
  ]);
  return suspensionOf(member, now);
}

export async function liftSuspension(prisma: PrismaClient, memberId: string): Promise<void> {
  await prisma.member.update({
    where: { id: memberId },
    data: { suspendedAt: null, suspendedUntil: null, suspendedReason: null },
  });
}
