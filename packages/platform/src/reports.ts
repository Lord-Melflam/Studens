/**
 * Notice and action. FR-E8 to FR-E12, DSA Articles 16 and 6.
 *
 * WHAT THIS IS FOR. Article 16 requires every hosting provider, whatever its
 * size, to offer a mechanism for anyone to report content they consider
 * illegal. Article 19's micro-enterprise exemption covers the internal
 * complaints system and trusted flaggers; it does not cover this. Until this
 * existed, Studens hosted contributions with no way for anybody to say one was
 * unlawful.
 *
 * A REPORT IS ACTUAL KNOWLEDGE. Article 6 keeps the liability shield only while
 * a host has no actual knowledge of illegality and acts expeditiously once it
 * does. From the moment a notice arrives the shield depends on acting, which
 * makes the size of the open queue a legal exposure rather than only an
 * operational one. That is the argument behind every cap below: a queue nobody
 * can read is worse than a smaller one.
 *
 * NOTHING HERE REMOVES ANYTHING (FR-E10). A report threshold that removes
 * content is a brigading tool, and what it would remove is precisely the argued
 * negative review this platform exists to protect. Two categories HOLD their
 * target at once, which is hidden and reversible, and removal is always a human
 * act performed elsewhere.
 *
 * THE PLATFORM DOES NOT KNOW WHAT IS BEING REPORTED. A target is a kind and an
 * id, both opaque. Whoever owns that kind hands over a `Moderatable` and the
 * API composes the two, the same shape as the username resolver and the erasure
 * handler. The platform gains no knowledge of reviews; the module gains no
 * access to reports.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { checkEmail, EmailInvalid } from "./email.js";
import { checkFreeText, TextInvalid } from "./text.js";

/**
 * Why somebody is reporting.
 *
 * A fixed set rather than free choice, because two of them decide whether the
 * target is hidden immediately (FR-E11) and a free-text category cannot be
 * acted on. The explanation is separate and required: Article 16(2)(a) asks for
 * a substantiated one, and a category on its own substantiates nothing.
 */
export const REPORT_CATEGORIES = [
  /** Alleged to break the law. Holds at once. */
  "illegal",
  /** Names or identifies somebody who did not ask to be named. Holds at once. */
  "thirdparty",
  /** Insulting, harassing, or an attack rather than a review. */
  "abuse",
  /** Advertising, repetition, or not about the subject at all. */
  "spam",
  /** Wrong about facts, but not any of the above. */
  "inaccurate",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/**
 * The two that hide the target the moment the notice arrives (FR-E11).
 *
 * The cost of holding a good contribution for a day is far below the cost of
 * knowingly hosting a defamatory one, and Article 6 starts counting from the
 * notice. The other three queue and change nothing, because "somebody called
 * this abusive" is exactly the claim a brigade makes about a review it dislikes.
 */
const HOLDS_IMMEDIATELY: ReadonlySet<string> = new Set<ReportCategory>(["illegal", "thirdparty"]);

export function holdsImmediately(category: string): boolean {
  return HOLDS_IMMEDIATELY.has(category);
}

/** Article 16(2)(a). Long enough to say what is wrong, short enough to read. */
export const DETAIL_MIN = 20;
export const DETAIL_MAX = 1500;

/**
 * How many OPEN reports one target may accumulate before further ones are
 * counted rather than stored.
 *
 * Not a removal threshold (FR-E10) and not a rate limit on people. It bounds
 * one target's contribution to the queue, because the fiftieth notice about a
 * single review tells a moderator nothing the first ten did not, and an
 * unbounded queue is the legal exposure described above.
 *
 * WHY NOT RATE LIMIT BY ADDRESS. Studens records no IP address and the privacy
 * page says so, so there is nothing to limit an anonymous reporter by. Bounding
 * the target instead costs a determined spammer the ability to flood one page
 * and costs a genuine reporter nothing, since their notice is still counted.
 */
export const MAX_OPEN_PER_TARGET = 25;

export class ReportInvalid extends Error {
  constructor(
    readonly field: "category" | "detail" | "contactEmail" | "target",
    readonly reason?: string,
  ) {
    super(`report: ${field}`);
    this.name = "ReportInvalid";
  }
}

/**
 * What a module must provide to make its content reportable.
 *
 * Handed over by whoever composes the two, so the platform learns nothing about
 * reviews and the module needs no grant on `platform.Report`.
 */
export interface Moderatable {
  /** The opaque kind this handles, for example "ryc.review". */
  readonly kind: string;
  /** Whether the id names something real and currently visible. */
  exists(tx: Prisma.TransactionClient, targetId: string): Promise<boolean>;
  /** Hide it pending a human decision. Returns whether anything changed. */
  hold(tx: Prisma.TransactionClient, targetId: string): Promise<boolean>;
}

export interface NewReport {
  targetKind: string;
  targetId: string;
  category: string;
  detail: string;
  /** Null for anyone not signed in. FR-E8 lets anyone report. */
  reporterMemberId?: string | null;
  contactEmail?: string | null;
}

export interface ReportOutcome {
  id: string;
  /** Whether this notice hid the target immediately (FR-E11). */
  held: boolean;
  /** True when this reporter had already reported this target and nothing new was stored. */
  duplicate: boolean;
}

/**
 * Accept a notice.
 *
 * ONE TRANSACTION, because a report that holds its target must not be able to
 * record the hold without the notice that justified it, nor the reverse: the
 * audit entry is the evidence that the hold was not arbitrary.
 */
export async function submitReport(
  prisma: PrismaClient,
  input: NewReport,
  opts: { targets?: Moderatable[]; now?: Date } = {},
): Promise<ReportOutcome> {
  const now = opts.now ?? new Date();

  if (!(REPORT_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new ReportInvalid("category");
  }

  let detail: string | null;
  try {
    detail = checkFreeText(input.detail, DETAIL_MAX);
  } catch (err) {
    throw new ReportInvalid("detail", err instanceof TextInvalid ? err.reason : "other");
  }
  // Article 16(2)(a) wants a substantiated explanation. "bad" is not one, and
  // the floor is what stops the queue filling with notices nobody can act on.
  if (detail === null || detail.length < DETAIL_MIN) throw new ReportInvalid("detail", "short");

  let contactEmail: string | null = null;
  if (input.contactEmail !== undefined && input.contactEmail !== null && input.contactEmail !== "") {
    try {
      contactEmail = checkEmail(input.contactEmail);
    } catch (err) {
      throw new ReportInvalid("contactEmail", err instanceof EmailInvalid ? err.reason : "other");
    }
  }

  const target = (opts.targets ?? []).find((t) => t.kind === input.targetKind);
  if (!target) throw new ReportInvalid("target", "unknown-kind");

  return await prisma.$transaction(async (tx) => {
    if (!(await target.exists(tx, input.targetId))) {
      // Same answer whether it never existed or has already been removed: a
      // caller must not be able to probe which (FR-A4's rule, applied here).
      throw new ReportInvalid("target", "not-found");
    }

    const where = { targetKind: input.targetKind, targetId: input.targetId };

    // One open notice per person per target. A second is not more information,
    // and without this a signed-in reporter could fill the queue alone.
    if (input.reporterMemberId) {
      const already = await tx.report.findFirst({
        where: { ...where, reporterMemberId: input.reporterMemberId, status: "open" },
      });
      if (already) return { id: already.id, held: false, duplicate: true };
    }

    const open = await tx.report.count({ where: { ...where, status: "open" } });
    if (open >= MAX_OPEN_PER_TARGET) {
      // Counted, not stored. The target is already at the front of the queue by
      // volume alone, and FR-E12 says the count is evidence about the reporters
      // as much as about the content.
      return { id: "", held: false, duplicate: true };
    }

    const report = await tx.report.create({
      data: {
        targetKind: input.targetKind,
        targetId: input.targetId,
        reporterMemberId: input.reporterMemberId ?? null,
        category: input.category,
        detail,
        contactEmail,
        createdAt: now,
      },
    });

    let held = false;
    if (holdsImmediately(input.category)) {
      held = await target.hold(tx, input.targetId);
      if (held) {
        // FR-E1 and FR-E2: what happened and to what, never who wrote it. The
        // actor is the mechanism rather than a person, because no human decided
        // this one; that is the difference between a hold and a removal.
        await tx.auditLog.create({
          data: {
            actorMemberId: "system:notice-and-action",
            action: `hold:${input.category}`,
            targetKind: input.targetKind,
            targetId: input.targetId,
            at: now,
          },
        });
      }
    }

    return { id: report.id, held, duplicate: false };
  });
}

export interface ReportSummary {
  targetKind: string;
  targetId: string;
  open: number;
  /** FR-E12: how many came from accounts, which is half the brigading signal. */
  fromMembers: number;
  /** The oldest open notice. Article 6's clock, and what a queue is judged by. */
  oldestAt: Date | null;
}

/**
 * The queue, grouped by what was reported.
 *
 * Deliberately returns counts and ages rather than the notices themselves: this
 * is what tells a moderator where to look, and FR-E12 is explicit that a count
 * is never acted on by itself.
 */
export async function openReportSummary(
  prisma: PrismaClient,
  limit = 50,
): Promise<ReportSummary[]> {
  const rows = await prisma.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    take: limit * 20,
    select: { targetKind: true, targetId: true, reporterMemberId: true, createdAt: true },
  });

  const byTarget = new Map<string, ReportSummary>();
  for (const r of rows) {
    // A separator no id can contain, so two targets cannot collide by
    // concatenation. Written as an escape rather than as the character
    // itself: a control byte sitting in source is invisible to a reviewer,
    // makes grep treat the whole file as binary, and is exactly what
    // packages/platform/src/text.ts refuses in anybody else's input.
    const key = `${r.targetKind}\u0000${r.targetId}`;
    const found = byTarget.get(key) ?? {
      targetKind: r.targetKind,
      targetId: r.targetId,
      open: 0,
      fromMembers: 0,
      oldestAt: null,
    };
    found.open += 1;
    if (r.reporterMemberId) found.fromMembers += 1;
    if (found.oldestAt === null || r.createdAt < found.oldestAt) found.oldestAt = r.createdAt;
    byTarget.set(key, found);
  }

  return [...byTarget.values()]
    .sort((a, b) => (a.oldestAt?.getTime() ?? 0) - (b.oldestAt?.getTime() ?? 0))
    .slice(0, limit);
}

/**
 * Detach a departing member's reports from them (FR-A15).
 *
 * The notices stay: one may already have caused a contribution to be held, and
 * Article 16 asks us to be able to show what we did about it. What goes is the
 * link to the person, which is the part that was theirs.
 */
export async function detachMemberReports(
  tx: Prisma.TransactionClient,
  memberId: string,
): Promise<number> {
  const { count } = await tx.report.updateMany({
    where: { reporterMemberId: memberId },
    data: { reporterMemberId: null },
  });
  return count;
}
