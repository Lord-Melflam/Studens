/**
 * What RYC does when a Member deletes their account.
 *
 * OPEN-46, resolved by François on 2026-09-13: DETACH. The text stays, the name
 * goes. The alternative he chose against was deleting the reviews outright,
 * which is the cleanest reading of Article 17 and removes work other students
 * are relying on, which is the loss this platform exists to prevent.
 *
 * DETACHED IS NOT ANONYMOUS, and the distinction is the whole reason this is
 * safe to do. A detached review keeps the numbers it was published with, is
 * labelled as a deleted account, and is counted with neither the named nor the
 * anonymous set. If it were folded into the anonymous set it would inflate the
 * figure FR-C21 shows a contributor before they choose, so the number somebody
 * uses to judge their own exposure would be wrong, and section 3.3's complement
 * arithmetic with it. The row also stays in `ReviewAttributed`: moving it to
 * `ReviewAnonymous` would give it FR-D15's display rules, which withhold
 * exactly the per-review numbers it was published with.
 *
 * ON ERASURE BEING COMPLETE. Dropping the member id is real anonymisation under
 * Recital 26 only because the Member row is deleted in the same transaction, so
 * there is nothing left to re-link against. What it cannot do is anonymise the
 * TEXT: a review that describes its author still describes them. That is the
 * same limit FR-C12 states for the anonymous path, and the deletion screen says
 * it before anybody presses the button.
 *
 * THE PLATFORM NEVER CALLS THIS DIRECTLY. It is handed over as a `MemberErasure`
 * by the API, so the platform stays ignorant of what a review is (FR-B16) and
 * this module keeps its own grants.
 */
import type { Prisma } from "@prisma/client";

export const RYC_MODULE = "ryc";

/**
 * Detach every attributed review of this member.
 *
 * Runs inside the platform's deletion transaction. Throwing here aborts the
 * whole deletion and leaves the account intact, which is the right failure: a
 * half-deleted account is worse than a refused one, because the person believes
 * it is gone.
 */
export async function detachMemberReviews(
  tx: Prisma.TransactionClient,
  memberId: string,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await tx.reviewAttributed.updateMany({
    where: { memberId },
    data: { memberId: null, detachedAt: now },
  });
  return count;
}

/**
 * Everything RYC holds about a member, for the export (Article 20).
 *
 * Attributed reviews only, because those are the only ones it holds about
 * anybody. There is no query that could find their anonymous ones, which is
 * the guarantee rather than a gap, and the export file says so in its own
 * `notIncluded` list.
 */
export async function exportMemberReviews(
  tx: Prisma.TransactionClient,
  memberId: string,
): Promise<unknown> {
  const reviews = await tx.reviewAttributed.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });
  return { attributedReviews: reviews };
}

/**
 * FR-E8 and FR-E11: what it means for a review to be reported and held.
 *
 * Handed to the platform as a `Moderatable`, so the platform never learns what
 * a review is (FR-B16) and this module needs no grant on `platform.Report`.
 * The same shape as the erasure handler above and the username resolver in
 * `read.ts`: the API is the only place that knows both halves.
 *
 * ONE KIND FOR THREE TABLES. A reporter sees a review and an id, not a storage
 * path, and asking them which table it is in would be absurd. It also means a
 * notice about an anonymous review carries nothing distinguishing it from one
 * about a named review, which is the point: the report names content, never an
 * author, and the platform could not tell the difference if it wanted to.
 */
export const RYC_REVIEW_KIND = "ryc.review";

/** Where an id might live. Order matters only for how many queries run. */
async function locate(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<"attributed" | "anonymous" | "imported" | null> {
  if (await tx.reviewAttributed.findUnique({ where: { id }, select: { id: true } })) {
    return "attributed";
  }
  if (await tx.reviewAnonymous.findUnique({ where: { id }, select: { id: true } })) {
    return "anonymous";
  }
  if (await tx.reviewImported.findUnique({ where: { id }, select: { id: true } })) {
    return "imported";
  }
  return null;
}

/**
 * Whether this id names a review anybody can currently see.
 *
 * Only published ones: a reporter cannot confirm the existence of something
 * already held or removed, and an id that never existed answers the same way.
 */
export async function reviewExists(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<boolean> {
  const where = { id, status: "published" };
  const [a, b, c] = await Promise.all([
    tx.reviewAttributed.count({ where }),
    tx.reviewAnonymous.count({ where }),
    tx.reviewImported.count({ where }),
  ]);
  return a + b + c > 0;
}

/**
 * Hide it pending a human decision (FR-E11).
 *
 * HOLD, NEVER REMOVE. The row and its text are untouched; only `status` moves,
 * so a moderator who decides the notice was wrong publishes it again and
 * nothing was lost. FR-E10 makes removal a human act, always, and it is not
 * this function.
 *
 * Returns whether anything changed, so a second notice about an already held
 * review does not write a second audit entry claiming it held something.
 */
export async function holdReview(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<boolean> {
  const where = { id, status: "published" };
  const data = { status: "held" };
  const kind = await locate(tx, id);
  if (kind === null) return false;
  const { count } =
    kind === "attributed"
      ? await tx.reviewAttributed.updateMany({ where, data })
      : kind === "anonymous"
        ? await tx.reviewAnonymous.updateMany({ where, data })
        : await tx.reviewImported.updateMany({ where, data });
  return count > 0;
}
