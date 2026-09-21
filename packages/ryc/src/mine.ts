/**
 * A member's own attributed reviews: listing them, and editing one.
 *
 * FR-D12 and FR-C14. Both are about the ATTRIBUTED path and only that path,
 * and the reason is structural rather than a policy anybody chose.
 *
 * WHY THERE IS NO ANONYMOUS EQUIVALENT, and why there never will be. An
 * anonymous review has no member column (FR-C20): the table cannot answer
 * "which of these is mine", in either direction, for anybody including its
 * author. So there is nothing to list and nothing to edit, and FR-C9 states
 * that as a permanent property rather than a missing feature. A request that
 * sounds like "let people manage their own anonymous contributions" is asking
 * for the link the design forbids.
 *
 * The consequence is worth saying plainly to whoever reads this next: every
 * function here takes a `memberId`, and every one of them would be a defect
 * if it ever touched `ReviewAnonymous`. It cannot, because that table has no
 * column to match on, which is the guarantee doing its job rather than a rule
 * this file applies.
 */
import { PrismaClient } from "@prisma/client";
import { ReviewInvalid, validate, type ReviewInput } from "./submit.js";

export interface MyReview {
  id: string;
  courseId: string;
  academicYear: number;
  recommendation: number;
  workloadVsEcts: number;
  difficulty: number;
  hoursPerWeek: number | null;
  passed: boolean | null;
  body: string;
  advice: string | null;
  createdAt: Date;
  /** Later than `createdAt` once it has been edited. */
  updatedAt: Date;
  /** `published` or `held`: a held review is still theirs and still editable. */
  status: string;
}

export interface MineOptions {
  client?: PrismaClient;
  now?: Date;
}

/**
 * How many of somebody's own reviews one call carries.
 *
 * NFR-O4. This list only grows: a quota bounds how fast somebody publishes,
 * never how much they have published by their third year, and an alumnus who
 * reviewed every course they took is the person this product most wants. The
 * cap used to be in the browser, which bounded the SCREEN and not the
 * RESPONSE: the row count still arrived in full, so the one number that
 * actually had to be bounded was the one that was not.
 */
export const MINE_PER_PAGE = 10;

export interface MinePage {
  reviews: MyReview[];
  /** Every one they have, so the screen can say how many are still unseen. */
  total: number;
}

/**
 * FR-D12: everything this member has published under their name.
 *
 * Detached rows are excluded by the `memberId` match itself: deleting an
 * account sets that column to null (FR-A15), so a detached review belongs to
 * nobody and appears in nobody's list, which is the whole point of detaching
 * rather than deleting.
 */
export async function myReviews(
  memberId: string,
  opts: MineOptions & { page?: number; perPage?: number } = {},
): Promise<MinePage> {
  const prisma = opts.client ?? new PrismaClient();
  // Bounded HERE rather than trusted from the caller, for the reason the
  // course page states: a caller that could ask for ten thousand rows in one
  // request is the unbounded response this exists to prevent.
  const perPage = Math.min(50, Math.max(1, Math.floor(opts.perPage ?? MINE_PER_PAGE)));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  try {
    const [reviews, total] = await Promise.all([
      prisma.reviewAttributed.findMany({
        where: { memberId },
        // `updatedAt` alone is not a total order: two rows written in the same
        // transaction can share it, and Postgres promises no order between
        // them, so a row could appear on two pages or on none. `id` breaks the
        // tie and is unique, which makes the sequence stable across calls.
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          courseId: true,
          academicYear: true,
          recommendation: true,
          workloadVsEcts: true,
          difficulty: true,
          hoursPerWeek: true,
          passed: true,
          body: true,
          advice: true,
          createdAt: true,
          updatedAt: true,
          status: true,
        },
      }),
      prisma.reviewAttributed.count({ where: { memberId } }),
    ]);
    return { reviews, total };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/** What an edit may change. The course and the year are not in it. */
export type ReviewEdit = Omit<ReviewInput, "courseId" | "academicYear">;

/**
 * FR-C14: the author changes what they said.
 *
 * WHAT AN EDIT CANNOT CHANGE, and this is a decision rather than an
 * oversight: the course and the academic year. They identify the
 * contribution. `(memberId, courseId, academicYear)` is unique on this table
 * (FR-D9), so letting an edit move the year would turn "I meant 2024" into a
 * constraint violation whenever a review of that year already exists, and the
 * person would meet a failure they could not act on. Reviewing a different
 * year is a different review, and the form for it already exists.
 *
 * SCOPED BY MEMBER IN THE QUERY, never checked afterwards. The `where` names
 * both the id and the member, so an id belonging to somebody else matches no
 * row and the edit reports that it found nothing. Reading the row first and
 * comparing would be the same check written so that forgetting it is possible.
 *
 * NO QUOTA IS SPENT. The quota bounds how much somebody publishes (FR-C4);
 * correcting what is already published adds nothing to the pile, and charging
 * for it would make people leave mistakes standing.
 *
 * A HELD REVIEW STAYS HELD. Editing is not a way out of moderation: the
 * status is not touched here, so a review a moderator took out of view stays
 * out of view, and the moderator sees the text as it now reads.
 */
export async function editAttributed(
  memberId: string,
  reviewId: string,
  edit: ReviewEdit,
  opts: MineOptions = {},
): Promise<MyReview> {
  const prisma = opts.client ?? new PrismaClient();
  try {
    const existing = await prisma.reviewAttributed.findFirst({
      where: { id: reviewId, memberId },
      select: { courseId: true, academicYear: true },
    });
    // Not "not found" versus "not yours": the answer is the same either way,
    // so an id cannot be used to learn whether a review exists.
    if (!existing) throw new ReviewInvalid("id", "no such review");

    // The same rules as a first submission, with the two fields it may not
    // move supplied from the row rather than from the caller.
    validate({ ...edit, courseId: existing.courseId, academicYear: existing.academicYear }, opts.now);

    return await prisma.reviewAttributed.update({
      where: { id: reviewId },
      data: {
        recommendation: edit.recommendation,
        workloadVsEcts: edit.workloadVsEcts,
        difficulty: edit.difficulty,
        hoursPerWeek: edit.hoursPerWeek ?? null,
        passed: edit.passed ?? null,
        body: edit.body.trim(),
        advice: edit.advice?.trim() || null,
      },
      select: {
        id: true,
        courseId: true,
        academicYear: true,
        recommendation: true,
        workloadVsEcts: true,
        difficulty: true,
        hoursPerWeek: true,
        passed: true,
        body: true,
        advice: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      },
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
