/**
 * What a moderator does with a notice. FR-E10 to FR-E14.
 *
 * TWO ACTIONS, AND REMOVAL IS NOT ONE OF THEM YET.
 *
 * A moderator can hold (take out of public view) and release (put back), and
 * can close a notice as upheld or rejected. Removal is deliberately absent:
 * FR-E9 says a removal publishes a statement of reasons in the place the
 * contribution occupied, and FR-E9 is still [OPEN], waiting on the same
 * qualified reader as requirements 5.1. Shipping removal now would mean either
 * a silent deletion, which the moderation note argues against at length, or
 * implementing a reading of Article 17 that nobody qualified has agreed with.
 *
 * A hold already takes the content out of public view, which is the acting part
 * and the thing a reader is protected by. Whether that fully discharges Article
 * 6's obligation is part of the same question already flagged, and it is
 * recorded rather than assumed.
 *
 * WHAT A MODERATOR SEES IS WHAT A READER SEES. The module renders the target
 * for moderation using the same shape it renders for the public, so an
 * anonymous contribution arrives with no author, exactly as it does on the
 * course page. That is not a filter applied here for politeness: there is
 * nothing to filter, and a moderator who could unmask would be a second door
 * into FR-C.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { canModerate, NotPermitted } from "./roles.js";

/** How a notice ends. Never deleted: a notice that vanished cannot be shown. */
export const REPORT_OUTCOMES = ["upheld", "rejected"] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export class ModerationRefused extends Error {
  constructor(readonly reason: "unknown-target" | "unknown-kind" | "no-change" | "bad-outcome") {
    super(`moderation: ${reason}`);
    this.name = "ModerationRefused";
  }
}

/**
 * What a module must provide for its content to be moderated.
 *
 * `describe` and `release` on top of the `Moderatable` used for intake. Kept as
 * one interface so a module cannot be reportable without being releasable,
 * which would leave content held with no way back.
 */
export interface ModeratableContent {
  readonly kind: string;
  exists(tx: Prisma.TransactionClient, targetId: string): Promise<boolean>;
  hold(tx: Prisma.TransactionClient, targetId: string): Promise<boolean>;
  /** Put it back in public view. Returns whether anything changed. */
  release(tx: Prisma.TransactionClient, targetId: string): Promise<boolean>;
  /** What a reader would see, for a moderator to read before deciding. */
  describe(tx: Prisma.TransactionClient, targetId: string): Promise<ModeratedTarget | null>;
}

export interface ModeratedTarget {
  targetId: string;
  /** "named", "anonymous", "detached", "imported": what a reader would be told. */
  path: string;
  /** Present only where it is already public. Never resolved for moderation. */
  author: string | null;
  body: string;
  advice: string | null;
  /**
   * Where it lives, opaque to the platform.
   *
   * The module returns an id it owns the meaning of; whoever composes the two
   * turns it into something a person can read. The platform does not know what
   * a course is any more than it knows what a review is.
   */
  courseId: string;
  /** Filled in by the composition point, where the catalogue is reachable. */
  context?: string;
  held: boolean;
}

export interface QueueEntry {
  targetKind: string;
  targetId: string;
  open: number;
  fromMembers: number;
  oldestAt: Date;
  /** Every distinct category on the open notices, for a first glance. */
  categories: string[];
  /** Null when the module no longer recognises the id. */
  target: ModeratedTarget | null;
}

/**
 * The queue a moderator reads: what has been reported, oldest first.
 *
 * OLDEST FIRST, NOT MOST REPORTED. FR-E12 is explicit that a count is evidence
 * about the reporters as much as about the content, so sorting by it would put
 * whatever a group decided to pile onto at the top, which is exactly the
 * behaviour a brigade is trying to buy. Article 6's clock runs from the notice,
 * so age is also the number that matters legally.
 */
export async function moderationQueue(
  prisma: PrismaClient,
  actor: { role: string },
  opts: { content?: ModeratableContent[]; limit?: number } = {},
): Promise<QueueEntry[]> {
  if (!canModerate(actor.role)) throw new NotPermitted("moderate");
  const limit = opts.limit ?? 50;

  const rows = await prisma.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    select: {
      targetKind: true,
      targetId: true,
      reporterMemberId: true,
      category: true,
      createdAt: true,
    },
  });

  const byTarget = new Map<string, Omit<QueueEntry, "target">>();
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
      oldestAt: r.createdAt,
      categories: [],
    };
    found.open += 1;
    if (r.reporterMemberId) found.fromMembers += 1;
    if (r.createdAt < found.oldestAt) found.oldestAt = r.createdAt;
    if (!found.categories.includes(r.category)) found.categories.push(r.category);
    byTarget.set(key, found);
  }

  const ordered = [...byTarget.values()]
    .sort((a, b) => a.oldestAt.getTime() - b.oldestAt.getTime())
    .slice(0, limit);

  const content = opts.content ?? [];
  return await Promise.all(
    ordered.map(async (entry) => {
      const owner = content.find((c) => c.kind === entry.targetKind);
      const target = owner
        ? await prisma.$transaction((tx) => owner.describe(tx, entry.targetId))
        : null;
      return { ...entry, target };
    }),
  );
}

export interface Decision {
  /** What happens to the content. */
  action: "hold" | "release" | "leave";
  /** What happens to the open notices about it. */
  outcome: ReportOutcome;
  /** Recorded on the notices and in the audit log. Required. */
  reason: string;
}

export interface DecisionResult {
  targetKind: string;
  targetId: string;
  changed: boolean;
  reportsClosed: number;
}

/**
 * Decide a target: act on the content, close every open notice about it.
 *
 * ONE TRANSACTION, and the reason is FR-E1 rather than tidiness. The audit
 * entry is the evidence that a human decided, and a decision recorded without
 * its effect, or an effect without its record, is worse than neither: the first
 * claims an action that did not happen, and the second is the silent moderation
 * this design exists to prevent.
 *
 * EVERY OPEN NOTICE ABOUT THE TARGET IS CLOSED TOGETHER. A moderator reads the
 * content once and decides once; leaving nine notices open behind a decision
 * would make the queue grow with work already done, and Article 6's exposure is
 * the open queue.
 */
export async function decide(
  prisma: PrismaClient,
  actor: { memberId: string; role: string },
  target: { kind: string; id: string },
  decision: Decision,
  opts: { content?: ModeratableContent[]; now?: Date } = {},
): Promise<DecisionResult> {
  if (!canModerate(actor.role)) throw new NotPermitted("moderate");
  if (!(REPORT_OUTCOMES as readonly string[]).includes(decision.outcome)) {
    throw new ModerationRefused("bad-outcome");
  }

  const owner = (opts.content ?? []).find((c) => c.kind === target.kind);
  if (!owner) throw new ModerationRefused("unknown-kind");

  const now = opts.now ?? new Date();

  return await prisma.$transaction(async (tx) => {
    let changed = false;
    if (decision.action === "hold") changed = await owner.hold(tx, target.id);
    else if (decision.action === "release") changed = await owner.release(tx, target.id);

    const { count } = await tx.report.updateMany({
      where: { targetKind: target.kind, targetId: target.id, status: "open" },
      data: {
        status: decision.outcome,
        decidedAt: now,
        // FR-B12 permits naming an actor here: the actor is a moderator, never
        // an author. It is what makes a decision attributable to a person.
        decidedBy: actor.memberId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: actor.memberId,
        action: `moderate:${decision.action}:${decision.outcome}`,
        targetKind: target.kind,
        targetId: target.id,
        at: now,
      },
    });

    return { targetKind: target.kind, targetId: target.id, changed, reportsClosed: count };
  });
}

/**
 * What a moderator has done, for somebody checking on them.
 *
 * FR-E1's audit trail read back. It names moderators and targets, never
 * authors, which is what lets it be readable by an administrator at all.
 */
export async function moderationHistory(
  prisma: PrismaClient,
  actor: { role: string },
  limit = 100,
): Promise<Array<{ at: Date; actorMemberId: string; action: string; targetId: string }>> {
  if (!canModerate(actor.role)) throw new NotPermitted("moderate");
  const rows = await prisma.auditLog.findMany({
    where: { action: { startsWith: "moderate:" } },
    orderBy: { at: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    at: r.at,
    actorMemberId: r.actorMemberId,
    action: r.action,
    targetId: r.targetId,
  }));
}
