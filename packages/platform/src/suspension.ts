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
import type { Prisma, PrismaClient } from "@prisma/client";
import { enqueueMail } from "./notifications.js";

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

export interface SuspensionOutcome extends Suspension {
  /**
   * Whether a message actually went out.
   *
   * Reported back to whoever pressed the button rather than assumed, because
   * both ways of failing to reach somebody are ordinary: no contact address
   * was ever given, or one was given and never confirmed (FR-A13 forbids
   * sending to that). A console that said "notified" either way would leave an
   * administrator believing a person had been told when the only thing they
   * will ever see is the screen at their next sign-in.
   */
  notified: boolean;
}

/**
 * Queue the message that says this happened, inside the caller's transaction.
 *
 * WHY IN THE TRANSACTION. A suspension that commits without its notice is the
 * exact state this work exists to remove: somebody locked out with no way to
 * learn why except by asking. Rolling both back together means a failure here
 * leaves the account usable, which is the safer half of the two.
 *
 * It resolves the address itself rather than calling notifyMember, because
 * that takes a PrismaClient and this must run on the transaction client. The
 * two rules it has to keep are the same ones: never send to an unconfirmed
 * address (FR-A13), and never let the member id reach the outbox row (FR-H4).
 */
async function tellThem(
  tx: Prisma.TransactionClient,
  memberId: string,
  kind: "account.suspended" | "account.reinstated",
  payload: Record<string, unknown>,
): Promise<boolean> {
  const member = await tx.member.findUnique({
    where: { id: memberId },
    select: { contactEmail: true, contactVerifiedAt: true, locale: true },
  });
  if (!member?.contactEmail || member.contactVerifiedAt === null) return false;
  await enqueueMail(tx, {
    to: member.contactEmail,
    kind,
    locale: member.locale ?? "fr",
    payload,
  });
  return true;
}

export async function suspendMember(
  prisma: PrismaClient,
  memberId: string,
  opts: { days: number | null; reason: string; now?: Date },
): Promise<SuspensionOutcome> {
  const now = opts.now ?? new Date();
  const until =
    opts.days === null ? null : new Date(now.getTime() + opts.days * 24 * 60 * 60 * 1000);
  return await prisma.$transaction(async (tx) => {
    const member = await tx.member.update({
      where: { id: memberId },
      data: { suspendedAt: now, suspendedUntil: until, suspendedReason: opts.reason },
    });
    // In the same transaction as the suspension itself: see the note above.
    await tx.session.deleteMany({ where: { memberId } });
    const notified = await tellThem(tx, memberId, "account.suspended", {
      reason: opts.reason,
      // An ISO date, rendered by the template in the reader's language. A
      // formatted date here would be formatted in the server's locale and
      // arrive in the wrong one.
      until: until === null ? null : until.toISOString(),
    });
    return { ...suspensionOf(member, now), notified };
  });
}

export async function liftSuspension(
  prisma: PrismaClient,
  memberId: string,
): Promise<SuspensionOutcome> {
  return await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: { suspendedAt: null, suspendedUntil: null, suspendedReason: null },
    });
    // Told as well, and for the same reason: somebody who was stopped without
    // explanation and then let back in without one has no idea whether the
    // decision was reconsidered or the site was simply broken for a week.
    const notified = await tellThem(tx, memberId, "account.reinstated", {});
    return { suspended: false, until: null, reason: null, notified };
  });
}
