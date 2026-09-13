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
