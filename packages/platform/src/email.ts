/**
 * Changing the address a Member is reached at. FR-A12, FR-A13.
 *
 * TWO ADDRESSES AND ONLY ONE IS EDITABLE. `providerEmail` comes from the
 * verified token and is how the same person is recognised on the next sign-in;
 * `contactEmail` is where they ask to be reached. One editable column would let
 * somebody edit the field their identity is matched on, and either lock
 * themselves out or walk into somebody else's account.
 *
 * CONFIRMED BEFORE ANYTHING IS SENT. A typo silently redirects a person's mail
 * to a stranger, and an attacker with a borrowed session redirects it
 * deliberately. So the new address is stored only once a link sent to it comes
 * back, and the OLD address is told that the change was requested, which is
 * what makes a takeover visible to the person losing it.
 *
 * The link is signed rather than stored: it carries the member, the address and
 * a timestamp, and it is verified with the same key as the sign-in state. That
 * keeps a pending change out of the database entirely, so an abandoned one
 * expires by arithmetic rather than by a cleanup job nobody wrote.
 */
import { PrismaClient } from "@prisma/client";
import { enqueueMail } from "./notifications.js";
import { BadSignedValue, readSignedValue, signValue } from "./signed.js";

/** One hour. Long enough to find the mail, short enough that a leaked link rots. */
export const CONFIRM_MAX_AGE_SECONDS = 60 * 60;

export class EmailInvalid extends Error {
  constructor(readonly reason: "shape" | "long" | "same") {
    super(`email: ${reason}`);
    this.name = "EmailInvalid";
  }
}

/**
 * Deliberately permissive, and it is not a validator.
 *
 * The only check that means anything is whether a message sent to the address
 * arrives, and that check is the confirmation link. A stricter pattern here
 * would reject valid addresses, which is a real and common failure, in exchange
 * for catching typos that the confirmation catches anyway.
 */
export function checkEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) throw new EmailInvalid("long");
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) throw new EmailInvalid("shape");
  return email;
}

interface ChangeToken {
  memberId: string;
  email: string;
}

/**
 * Ask to be reached somewhere else.
 *
 * Nothing is written to the Member row here. The pending address lives only in
 * the signed link, so an abandoned request leaves no state, and somebody who
 * changes their mind simply does not click.
 */
export async function requestEmailChange(
  prisma: PrismaClient,
  memberId: string,
  rawEmail: string,
  opts: { key: string; baseUrl: string; now?: Date },
): Promise<{ token: string }> {
  const email = checkEmail(rawEmail);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { contactEmail: true, contactVerifiedAt: true, locale: true },
  });
  if (!member) throw new Error("no such member");
  if (member.contactEmail === email && member.contactVerifiedAt !== null) {
    throw new EmailInvalid("same");
  }

  const token = signValue(opts.key, { memberId, email } satisfies ChangeToken, opts.now);
  const locale = member.locale ?? "fr";

  await enqueueMail(prisma, {
    to: email,
    kind: "email.confirm",
    locale,
    payload: { url: `${opts.baseUrl}/api/account/email/confirm?token=${encodeURIComponent(token)}` },
  });

  // The old address is told, and is told BEFORE the change takes effect. This
  // is the control that makes a session takeover visible to its victim, so it
  // is not conditional on any preference (FR-H2).
  if (member.contactEmail && member.contactVerifiedAt !== null) {
    await enqueueMail(prisma, {
      to: member.contactEmail,
      kind: "email.changed",
      locale,
      payload: { to: email },
    });
  }

  return { token };
}

/**
 * Complete the change, from the link.
 *
 * Returns the member it applied to so the caller can decide what to show. A bad
 * or expired token throws `BadSignedValue`, and the caller must not say which
 * of the two it was: "expired" tells the holder of a stolen link that it was
 * once real.
 */
export async function confirmEmailChange(
  prisma: PrismaClient,
  rawToken: string,
  opts: { key: string; now?: Date },
): Promise<{ memberId: string; email: string }> {
  const claim = readSignedValue<ChangeToken>(
    opts.key,
    rawToken,
    CONFIRM_MAX_AGE_SECONDS,
    opts.now,
  );

  // The member may have been deleted between the request and the click.
  const member = await prisma.member.findUnique({
    where: { id: claim.memberId },
    select: { id: true },
  });
  if (!member) throw new BadSignedValue("unreadable");

  await prisma.member.update({
    where: { id: claim.memberId },
    data: { contactEmail: claim.email, contactVerifiedAt: opts.now ?? new Date() },
  });
  return { memberId: claim.memberId, email: claim.email };
}
