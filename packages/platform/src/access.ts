/**
 * A moderator asking an administrator for something out of reach. FR-E21.
 *
 * THIS FILE GRANTS NOTHING. `roles.ts` states the rule it is written under:
 * three roles and no lattice, no per-action grant, because there are two
 * powers to control and a table of them would be a system to maintain rather
 * than a rule to read. A function here that opened one screen for one person
 * would be that table arriving through the back door, and the next question
 * after "can I have the settings screen" would be "for how long" and "who else
 * has it", which is a permission system nobody decided to build.
 *
 * SO A REQUEST IS A MESSAGE WITH A SUBJECT AND AN ANSWER. The subject is the
 * screen they could not open, which saves them describing it and saves the
 * administrator guessing. The answer is the power itself, given through the
 * appointment that already exists and is already audited, or a refusal with a
 * reason. Nothing in between.
 *
 * The composition point is the route, as usual: this module stores requests
 * and knows nothing about appointing anybody; `roles.ts` appoints and knows
 * nothing about requests.
 */
import { PrismaClient } from "@prisma/client";

export const ACCESS_STATUSES = ["open", "granted", "declined"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

/**
 * Enough to be a reason somebody can act on, short enough not to be an essay.
 *
 * The floor is real rather than symbolic: "please" is a request nobody can
 * answer, and an administrator deciding on nothing decides on who asked.
 */
export const REASON_MIN = 15;
export const REASON_MAX = 1000;
export const ANSWER_MAX = 1000;

export class AccessRefused extends Error {
  constructor(readonly why: "reason" | "section" | "already-open" | "not-found" | "decided" | "answer") {
    super(why);
    this.name = "AccessRefused";
  }
}

export interface AccessRequestRow {
  id: string;
  memberId: string;
  username: string | null;
  role: string;
  section: string;
  reason: string;
  createdAt: Date;
  status: string;
  decidedAt: Date | null;
  answer: string | null;
}

export interface AskOptions {
  client?: PrismaClient;
  /** The sections a request may name. The screen's vocabulary, passed in. */
  sections?: readonly string[];
}

/**
 * FR-E21: somebody asks.
 *
 * ONE OPEN REQUEST PER SECTION PER PERSON. Not a rate limit dressed up: a
 * second open request for the same screen adds nothing an administrator can
 * act on and turns a queue that should be read into one that is skimmed. Once
 * it is answered they may ask again, because circumstances change and a
 * refusal is not permanent.
 */
export async function askForAccess(
  memberId: string,
  section: string,
  reason: string,
  opts: AskOptions = {},
): Promise<AccessRequestRow> {
  const prisma = opts.client ?? new PrismaClient();
  const text = (reason ?? "").trim();
  if (opts.sections && !opts.sections.includes(section)) throw new AccessRefused("section");
  if (text.length < REASON_MIN || text.length > REASON_MAX) throw new AccessRefused("reason");
  try {
    const already = await prisma.accessRequest.findFirst({
      where: { memberId, section, status: "open" },
      select: { id: true },
    });
    if (already) throw new AccessRefused("already-open");
    const row = await prisma.accessRequest.create({
      data: { memberId, section, reason: text },
      include: { member: { select: { username: true, role: true } } },
    });
    return {
      ...row,
      username: row.member.username,
      role: row.member.role,
    };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * What an administrator reads, and what the asker sees of their own.
 *
 * Bounded, like every list here (NFR-O4). Open ones first because they are the
 * only ones anybody has to do anything about.
 */
export async function listAccessRequests(
  opts: { client?: PrismaClient; memberId?: string; limit?: number } = {},
): Promise<AccessRequestRow[]> {
  const prisma = opts.client ?? new PrismaClient();
  const take = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 50)));
  try {
    const rows = await prisma.accessRequest.findMany({
      where: opts.memberId ? { memberId: opts.memberId } : {},
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take,
      include: { member: { select: { username: true, role: true } } },
    });
    return rows.map((r) => ({ ...r, username: r.member.username, role: r.member.role }));
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * An administrator answers.
 *
 * THIS DOES NOT CHANGE ANYBODY'S ROLE, and the route that calls it is where
 * the two halves meet: granting means appointing, which `roles.ts` already
 * does and already audits, and this records that the question was answered.
 * Keeping them apart is what stops a request row from quietly becoming a
 * second way to hold a power.
 *
 * AN ANSWER IS REQUIRED ON A REFUSAL. A "no" with nothing attached is the
 * worst version of this feature: the asker learns only that somebody saw it,
 * cannot tell whether to ask again, and has no way to address whatever the
 * objection was. Granting needs no words, because the power arriving says it.
 */
export async function decideAccess(
  id: string,
  decision: "granted" | "declined",
  actorMemberId: string,
  answer: string | null,
  opts: { client?: PrismaClient; now?: Date } = {},
): Promise<void> {
  const prisma = opts.client ?? new PrismaClient();
  const text = (answer ?? "").trim();
  if (decision === "declined" && text.length === 0) throw new AccessRefused("answer");
  if (text.length > ANSWER_MAX) throw new AccessRefused("answer");
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.accessRequest.findUnique({ where: { id }, select: { status: true, memberId: true, section: true } });
      if (!row) throw new AccessRefused("not-found");
      if (row.status !== "open") throw new AccessRefused("decided");
      await tx.accessRequest.update({
        where: { id },
        data: {
          status: decision,
          decidedAt: opts.now ?? new Date(),
          decidedBy: actorMemberId,
          answer: text === "" ? null : text,
        },
      });
      // In the same transaction as the decision, so a record of the answer
      // cannot exist without the answer or the other way round.
      await tx.auditLog.create({
        data: {
          actorMemberId,
          action: `access:${decision}:${row.section}`,
          targetKind: "member",
          targetId: row.memberId,
        },
      });
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
