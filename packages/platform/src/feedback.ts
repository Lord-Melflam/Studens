/**
 * What people say about Studens itself: taking it, reading it, exporting it.
 *
 * FR-I1 to FR-I4. This is the platform's, not a module's: somebody complaining
 * that sign-in is confusing is not talking about RYC, and a feedback form
 * built inside a module would have to be built again for the second one.
 *
 * NOT A CONTRIBUTION, and the difference decides everything else in this file.
 * A review is published, is read by strangers, and on the anonymous path can
 * never be linked to its author by anyone including us (FR-C2, FR-C9). A piece
 * of feedback is a message to the people running the thing. It is not
 * published anywhere, the sender may ask to be answered, and answering them is
 * the point. So a nullable `memberId` here is not the forbidden shape: there
 * is no unlinkability guarantee to erode, exactly as with `Report` (FR-E8).
 *
 * WHAT IS REFUSED RATHER THAN STORED. No address, no user agent, no device,
 * and not the query string of the page somebody was on. See the migration for
 * why each one is out.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";

/** The three kinds. Small on purpose: somebody with one sentence to write should not have to classify it finely. */
export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/**
 * Long enough to say something, short enough not to be a denial of service.
 *
 * The floor is low deliberately. "search broken" is eight characters and is a
 * useful bug report; FR-D8 sets a much higher floor for a REVIEW because an
 * unargued review helps nobody, and that reasoning does not transfer to
 * somebody reporting a fault.
 */
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;
export const EMAIL_MAX = 254;

export class FeedbackInvalid extends Error {
  constructor(
    readonly field: "kind" | "message" | "contactEmail",
    readonly problem: string,
  ) {
    super(`${field}: ${problem}`);
    this.name = "FeedbackInvalid";
  }
}

export interface FeedbackInput {
  kind: string;
  message: string;
  contactEmail?: string | null;
  route?: string | null;
  locale?: string | null;
}

/**
 * The path, with any query string cut off here rather than at the caller.
 *
 * At the caller it is a rule somebody has to remember; here it is a property
 * of the column. A search box's contents are what a person typed and are not
 * needed to find a fault.
 */
function pathOnly(route: string | null | undefined): string | null {
  if (!route) return null;
  const cut = route.split(/[?#]/)[0]!.trim();
  if (cut === "") return null;
  return cut.slice(0, 200);
}

/**
 * Shape only, never deliverability.
 *
 * FR-A13 already says an address nobody confirmed is not evidence of anything.
 * This one is weaker still: it is a way to answer somebody if they want an
 * answer, so the check refuses what cannot be an address and accepts the rest.
 */
function cleanEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  if (value.length > EMAIL_MAX) throw new FeedbackInvalid("contactEmail", "too long");
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value)) {
    throw new FeedbackInvalid("contactEmail", "not an address");
  }
  return value;
}

export function validate(input: FeedbackInput): void {
  if (!(FEEDBACK_KINDS as readonly string[]).includes(input.kind)) {
    throw new FeedbackInvalid("kind", "not one of the kinds");
  }
  const message = (input.message ?? "").trim();
  if (message.length < MESSAGE_MIN) throw new FeedbackInvalid("message", "too short");
  if (message.length > MESSAGE_MAX) throw new FeedbackInvalid("message", "too long");
  cleanEmail(input.contactEmail);
}

export interface SubmitOptions {
  client?: PrismaClient;
  /** The signed-in member, or null. Null is the ordinary case for a public link. */
  memberId?: string | null;
}

export interface Feedback {
  id: string;
  memberId: string | null;
  kind: string;
  message: string;
  contactEmail: string | null;
  route: string | null;
  locale: string | null;
  createdAt: Date;
  status: string;
}

/** FR-I1. Takes one piece of feedback, from anybody. */
export async function submitFeedback(
  input: FeedbackInput,
  opts: SubmitOptions = {},
): Promise<Feedback> {
  validate(input);
  const prisma = opts.client ?? new PrismaClient();
  try {
    return await prisma.feedback.create({
      data: {
        memberId: opts.memberId ?? null,
        kind: input.kind,
        message: input.message.trim(),
        contactEmail: cleanEmail(input.contactEmail),
        route: pathOnly(input.route),
        locale: input.locale?.trim().slice(0, 8) || null,
      },
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * How many pieces of feedback one page carries.
 *
 * NFR-O4, and this list is the one most likely to grow fast: the whole point
 * of the public link is that a lot of people send something at once. The
 * number is a setting (`platform.feedbackPageSize`) for the same reason the
 * member list's is.
 */
export const FEEDBACK_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface FeedbackQuery {
  client?: PrismaClient;
  /** Matches the message text, case insensitively. */
  q?: string;
  /** One of the kinds, or absent for all of them. */
  kind?: string;
  /** open, read or done, or absent for all. */
  status?: string;
  /**
   * Everything one sender wrote. `"anonymous"` means every row with no member,
   * which is a group rather than a person and the screen says so.
   */
  author?: string;
  page?: number;
  perPage?: number;
}

export interface FeedbackRow extends Feedback {
  /** The sender's username, or null when they were not signed in. */
  username: string | null;
}

export interface FeedbackPage {
  items: FeedbackRow[];
  total: number;
  /** How many are in each state, over the whole table rather than this page. */
  counts: { open: number; read: number; done: number };
}

function whereFrom(opts: FeedbackQuery): Prisma.FeedbackWhereInput {
  const q = (opts.q ?? "").trim();
  return {
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.author === "anonymous"
      ? { memberId: null }
      : opts.author
        ? { memberId: opts.author }
        : {}),
    ...(q ? { message: { contains: q, mode: "insensitive" as const } } : {}),
  };
}

/** FR-I3: the console reads the queue, a screenful at a time. */
export async function listFeedback(opts: FeedbackQuery = {}): Promise<FeedbackPage> {
  const prisma = opts.client ?? new PrismaClient();
  // Bounded HERE rather than trusted from the caller: a caller that could ask
  // for ten thousand rows in one request is the unbounded response the page
  // size exists to prevent.
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(opts.perPage ?? FEEDBACK_PER_PAGE)));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where = whereFrom(opts);
  try {
    const [rows, total, open, read, done] = await Promise.all([
      prisma.feedback.findMany({
        where,
        // `createdAt` alone is not a total order: two rows written in the same
        // millisecond can share it and Postgres promises no order between
        // them, so a row could appear on two pages or on none. `id` is unique
        // and breaks the tie.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: { member: { select: { username: true } } },
      }),
      prisma.feedback.count({ where }),
      prisma.feedback.count({ where: { status: "open" } }),
      prisma.feedback.count({ where: { status: "read" } }),
      prisma.feedback.count({ where: { status: "done" } }),
    ]);
    return {
      items: rows.map(({ member, ...row }) => ({ ...row, username: member?.username ?? null })),
      total,
      counts: { open, read, done },
    };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * Who has sent feedback, and how much, so the console can group by sender
 * without loading every row to find out.
 *
 * Bounded like everything else: the senders who sent the most, not all of
 * them. A list of every person who ever wrote in is the unbounded list this
 * exists instead of.
 */
export async function feedbackAuthors(
  opts: { client?: PrismaClient; limit?: number } = {},
): Promise<Array<{ memberId: string | null; username: string | null; count: number }>> {
  const prisma = opts.client ?? new PrismaClient();
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 20)));
  try {
    const grouped = await prisma.feedback.groupBy({
      by: ["memberId"],
      _count: { _all: true },
      orderBy: { _count: { memberId: "desc" } },
      take: limit,
    });
    const ids = grouped.map((g) => g.memberId).filter((id): id is string => id !== null);
    const members =
      ids.length > 0
        ? await prisma.member.findMany({
            where: { id: { in: ids } },
            select: { id: true, username: true },
          })
        : [];
    const names = new Map(members.map((m) => [m.id, m.username]));
    return grouped.map((g) => ({
      memberId: g.memberId,
      username: g.memberId === null ? null : (names.get(g.memberId) ?? null),
      count: g._count._all,
    }));
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/** Move one row through open, read and done. */
export const FEEDBACK_STATUSES = ["open", "read", "done"] as const;

export async function setFeedbackStatus(
  id: string,
  status: string,
  opts: { client?: PrismaClient } = {},
): Promise<void> {
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    throw new FeedbackInvalid("kind", "not a status");
  }
  const prisma = opts.client ?? new PrismaClient();
  try {
    await prisma.feedback.update({ where: { id }, data: { status } });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * FR-I4: feedback as a JSON file, in one of two scopes.
 *
 * AN EXPORT EXISTS TO BE READ SOMEWHERE ELSE, which is the whole reason the
 * safe scope is the default rather than an option. A file that leaves this
 * machine cannot be called back, and the likeliest next step for it is being
 * pasted into something that reads it. OPEN-23 already settled that
 * contribution text never reaches a third-party inference service; feedback is
 * different data and is NOT covered by that decision, but a file with names in
 * it has the same shape, so the version that takes no extra thought is the one
 * without them.
 *
 * THE PSEUDONYM IS NOT THE THING FR-C FORBIDS, and the difference is worth
 * stating because the shapes look alike. The rule in the working notes is that
 * an anonymous CONTRIBUTION must never carry `HMAC(key, member || target)`,
 * because the server holds the key and could therefore relink every anonymous
 * review to its author. That is about a column stored on a row whose whole
 * guarantee is that no such link exists. Here the link already exists in
 * plain: `Feedback.memberId` is a real foreign key, because feedback is not a
 * contribution and answering the sender is the point. The hash is not creating
 * a link, it is REMOVING one from a file: it lets a reader see that five
 * messages came from one person without learning who, which is what makes the
 * anonymised scope useful rather than shapeless.
 *
 * A SENDER WHO WAS NOT SIGNED IN GETS NO KEY AT ALL. There is nothing to
 * group them by and inventing one would be a lie about what is known.
 */
export type ExportScope = "anonymised" | "full";

export interface ExportedFeedback {
  exported: string;
  scope: ExportScope;
  count: number;
  /** What each field means, in the file, so a reader needs nothing else. */
  fields: Record<string, string>;
  items: Array<Record<string, unknown>>;
}

/**
 * Stable across exports, so the same sender is the same key next month.
 *
 * Keyed on a server secret rather than on the id alone: a plain hash of a
 * uuid is reversible by anybody who has the uuid, which every administrator
 * does. Rotating the secret changes every key, which is acceptable because
 * this is a pseudonym for grouping and never an identifier to store.
 */
function senderKey(memberId: string, secret: string): string {
  return createHmac("sha256", secret).update(`feedback:${memberId}`).digest("hex").slice(0, 16);
}

const FIELDS_ANON: Record<string, string> = {
  id: "the row's own id, stable across exports",
  sender: "a pseudonym, stable across exports; null when nobody was signed in",
  kind: "bug, idea or other, chosen by the sender",
  status: "open, read or done, set by whoever is reading the queue",
  message: "what they wrote, verbatim",
  route: "the page they were on, without its query string",
  locale: "the interface language they were reading",
  at: "when it arrived, ISO 8601",
};

const FIELDS_FULL: Record<string, string> = {
  ...FIELDS_ANON,
  sender: "the pseudonym, as in the anonymised export",
  memberId: "the sender's account id, or null",
  username: "the sender's username, or null",
  contactEmail: "the address they left to be answered on, or null",
};

export interface ExportOptions {
  client?: PrismaClient;
  scope?: ExportScope;
  /** Keys the pseudonym. Absent, the anonymised export carries no sender at all. */
  secret?: string;
  /** Who asked. Required for the full scope, which is audited. */
  actorMemberId?: string;
  now?: Date;
}

export async function exportFeedback(opts: ExportOptions = {}): Promise<ExportedFeedback> {
  const prisma = opts.client ?? new PrismaClient();
  const scope: ExportScope = opts.scope === "full" ? "full" : "anonymised";
  const now = opts.now ?? new Date();
  try {
    // Everything, in one file, oldest first so a reader follows the product's
    // story forwards. This is the one place the list is deliberately not
    // paged: a file with a page size is a file somebody silently reads a
    // quarter of.
    const rows = await prisma.feedback.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { member: { select: { username: true } } },
    });

    if (scope === "full") {
      if (!opts.actorMemberId) {
        throw new FeedbackInvalid("kind", "a full export must say who asked");
      }
      // Written BEFORE the file is handed over, and carrying the count, so
      // the record says how much left rather than only that something did.
      await prisma.auditLog.create({
        data: {
          actorMemberId: opts.actorMemberId,
          action: `feedback:exported:full:${rows.length}`,
          targetKind: "feedback",
          targetId: "all",
        },
      });
    }

    const items = rows.map((r) => {
      const sender =
        r.memberId !== null && opts.secret ? senderKey(r.memberId, opts.secret) : null;
      const base = {
        id: r.id,
        sender,
        kind: r.kind,
        status: r.status,
        message: r.message,
        route: r.route,
        locale: r.locale,
        at: r.createdAt.toISOString(),
      };
      if (scope !== "full") return base;
      return {
        ...base,
        memberId: r.memberId,
        username: r.member?.username ?? null,
        contactEmail: r.contactEmail,
      };
    });

    return {
      exported: now.toISOString(),
      scope,
      count: items.length,
      fields: scope === "full" ? FIELDS_FULL : FIELDS_ANON,
      items,
    };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
