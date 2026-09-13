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
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { enqueueMail } from "./notifications.js";
import { BadSignedValue, readSignedValue, signValue } from "./signed.js";

/**
 * Twenty-four hours.
 *
 * It was one hour, on the reasoning that a leaked link should rot quickly. That
 * reasoning was about the wrong risk. A leaked link rots either way, and one
 * hour does not meaningfully shrink the window an attacker who already has the
 * message needs; what it does shrink is the window a legitimate person has, and
 * the realistic case is somebody reading their mail the next morning and
 * finding it dead. Verified in practice on 2026-09-13, when every queued
 * confirmation had expired before it could be used.
 *
 * WHAT IT COSTS: a link sitting in a compromised or shared mailbox is usable
 * for a day rather than an hour. That is bounded by what the link can actually
 * do, which is set the CONTACT address (FR-A12): it cannot sign anybody in,
 * cannot change the identity address, and the previous address is told the
 * moment the change is requested (FR-A13), which is the control that makes the
 * attack visible rather than the expiry.
 *
 * WHAT WOULD CHANGE IT: giving this token any authority beyond the contact
 * address. The day it can do more, an hour is right again.
 *
 * The templates state this duration in three languages, so it is not a number
 * that can be changed here alone.
 */
export const CONFIRM_MAX_AGE_SECONDS = 24 * 60 * 60;

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
  /**
   * A fingerprint of the contact state the token was issued against.
   *
   * THIS IS WHAT MAKES THE LINK SINGLE-USE, with no stored state. Applying the
   * change moves `contactVerifiedAt`, so the fingerprint no longer matches and
   * a replay is refused. Two competing requests resolve the same way: whichever
   * is opened first invalidates the other, which is the safe outcome either way.
   *
   * It exists because the token was replayable for its whole lifetime, and
   * stretching that lifetime from one hour to twenty-four made the difference
   * material. Demonstrated on 2026-09-13 by replaying a two-hour-old link three
   * times against a live account.
   *
   * HASHED, never the address itself. The payload is base64 and readable by
   * anyone who sees the URL, so carrying the previous address in it would
   * disclose it to exactly the person a leaked link is a problem with.
   */
  prev: string;
}

/** What the contact state is right now, as an opaque short digest. */
function fingerprint(email: string | null, verifiedAt: Date | null): string {
  return createHash("sha256")
    .update(`${email ?? ""}|${verifiedAt?.toISOString() ?? ""}`)
    .digest("base64url")
    .slice(0, 16);
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

  const token = signValue(
    opts.key,
    {
      memberId,
      email,
      prev: fingerprint(member.contactEmail, member.contactVerifiedAt),
    } satisfies ChangeToken,
    opts.now,
  );
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
    select: { id: true, contactEmail: true, contactVerifiedAt: true },
  });
  if (!member) throw new BadSignedValue("unreadable");

  // Single use, without storing anything: the contact state has moved if this
  // link has already been opened, or if a later request has been opened
  // instead. Same error as every other failure, so a holder learns nothing
  // about which it was (FR-A4's rule).
  if (fingerprint(member.contactEmail, member.contactVerifiedAt) !== claim.prev) {
    throw new BadSignedValue("unreadable");
  }

  await prisma.member.update({
    where: { id: claim.memberId },
    data: { contactEmail: claim.email, contactVerifiedAt: opts.now ?? new Date() },
  });
  return { memberId: claim.memberId, email: claim.email };
}
