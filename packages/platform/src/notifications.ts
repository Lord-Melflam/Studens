/**
 * What a Member agreed to be sent, and the queue that sends it.
 *
 * FR-H1 to FR-H6.
 *
 * TWO KINDS OF MAIL, AND ONLY ONE IS A PREFERENCE (FR-H2). A confirmation that
 * an address is changing, a moderation outcome, a receipt for a deletion: those
 * are the platform doing what the member asked, and suppressing them would hide
 * from somebody that their own account is being changed. Everything else is
 * opt-in, off by default, and one click from off again.
 *
 * ONE ROW PER KIND, never a single "notifications" switch, because a single
 * switch is how people turn off the one thing they wanted in order to escape
 * the rest.
 *
 * FR-H3 is the one place FR-C reaches in here: no message may reveal the author
 * of an anonymous contribution, to anybody, including its author. "Your
 * anonymous review was removed" requires knowing which review is whose, which
 * is the link that does not exist. That constrains what a message may say; it
 * has never been a reason not to hold an address.
 */
import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Mail that is sent whatever the preferences say, because it is the platform
 * answering the member rather than talking to them.
 */
export const TRANSACTIONAL = new Set([
  "email.confirm",
  "email.changed",
  "account.deleted",
  "account.export",
]);

/**
 * Optional kinds, off until chosen. Declared here so the settings screen can
 * list them without guessing, and so a kind nobody declared cannot be sent.
 */
export const OPTIONAL_KINDS = ["moderation.outcome", "reply.attributed", "digest.weekly"] as const;
export type OptionalKind = (typeof OPTIONAL_KINDS)[number];

export function isSendableKind(kind: string): boolean {
  return TRANSACTIONAL.has(kind) || (OPTIONAL_KINDS as readonly string[]).includes(kind);
}

export interface Preference {
  kind: string;
  enabled: boolean;
  decidedAt: Date;
}

/** Every optional kind, with what the member decided, defaulting to off. */
export async function readPreferences(
  prisma: PrismaClient,
  memberId: string,
): Promise<Preference[]> {
  const rows = await prisma.notificationPreference.findMany({ where: { memberId } });
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return OPTIONAL_KINDS.map((kind) => {
    const row = byKind.get(kind);
    return {
      kind,
      // Absent means never decided, which is not consent (Article 4(11)).
      enabled: row?.enabled ?? false,
      decidedAt: row?.decidedAt ?? new Date(0),
    };
  });
}

export async function setPreference(
  prisma: PrismaClient,
  memberId: string,
  kind: string,
  enabled: boolean,
): Promise<void> {
  if (!(OPTIONAL_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`not an optional notification kind: ${kind}`);
  }
  // `decidedAt` moves on every change, because Article 7(1) asks a controller
  // to demonstrate consent and a boolean with no date cannot.
  await prisma.notificationPreference.upsert({
    where: { memberId_kind: { memberId, kind } },
    update: { enabled, decidedAt: new Date() },
    create: { memberId, kind, enabled, decidedAt: new Date() },
  });
}

/** Whether this member wants this kind. Transactional mail never asks. */
export async function wants(
  prisma: PrismaClient,
  memberId: string,
  kind: string,
): Promise<boolean> {
  if (TRANSACTIONAL.has(kind)) return true;
  const row = await prisma.notificationPreference.findUnique({
    where: { memberId_kind: { memberId, kind } },
  });
  return row?.enabled ?? false;
}

/**
 * Whether this installation can actually deliver anything.
 *
 * Lives here rather than in the worker that sends, because the API has to know
 * too. Without it the account screen says "a message has gone to you" while the
 * row sits in the outbox forever, which is a false statement on a screen about
 * somebody's own account: they wait, nothing arrives, and they conclude the
 * product is broken rather than unconfigured.
 *
 * The same two variables the sender reads. One function, so the answer cannot
 * differ between the process that promises and the process that delivers.
 */
export function mailRelayConfigured(): boolean {
  return Boolean(process.env["STUDENS_SMTP_HOST"] && process.env["STUDENS_MAIL_FROM"]);
}

export interface QueuedMail {
  to: string;
  kind: string;
  locale?: string;
  payload?: Record<string, unknown>;
}

/**
 * Put a message in the outbox. FR-H5: nothing is sent inside a request.
 *
 * It takes an ADDRESS rather than a member id, deliberately. A member deleted
 * between queueing and sending leaves no dangling reference, and the receipt
 * for their own deletion can still go out. It also means this table can never
 * be used to join a person to a contribution.
 */
export async function enqueueMail(
  prisma: PrismaClient | Prisma.TransactionClient,
  mail: QueuedMail,
): Promise<void> {
  if (!isSendableKind(mail.kind)) throw new Error(`unknown mail kind: ${mail.kind}`);
  await prisma.mailOutbox.create({
    data: {
      toAddress: mail.to,
      kind: mail.kind,
      locale: mail.locale ?? "fr",
      payload: (mail.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Queue a message to a member, if they want that kind and can be reached.
 *
 * The member id never leaves this function: it resolves to an address here and
 * the outbox row holds only the address. A module calls this through the API's
 * composition, never touching the member table itself (FR-H4).
 */
export async function notifyMember(
  prisma: PrismaClient,
  memberId: string,
  kind: string,
  payload: Record<string, unknown> = {},
): Promise<"queued" | "declined" | "unreachable"> {
  if (!(await wants(prisma, memberId, kind))) return "declined";

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { contactEmail: true, contactVerifiedAt: true, locale: true },
  });
  // FR-A13: nothing goes to an address nobody confirmed. An unconfirmed one is
  // as likely to be a typo pointing at a stranger as it is to be theirs.
  if (!member?.contactEmail || member.contactVerifiedAt === null) return "unreachable";

  await enqueueMail(prisma, {
    to: member.contactEmail,
    kind,
    locale: member.locale ?? "fr",
    payload,
  });
  return "queued";
}
