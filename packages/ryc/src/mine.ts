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
 * FR-D12: everything this member has published under their name.
 *
 * Detached rows are excluded by the `memberId` match itself: deleting an
 * account sets that column to null (FR-A15), so a detached review belongs to
 * nobody and appears in nobody's list, which is the whole point of detaching
 * rather than deleting.
 */
export async function myReviews(
  memberId: string,
  opts: MineOptions = {},
): Promise<MyReview[]> {
  const prisma = opts.client ?? new PrismaClient();
  try {
    return await prisma.reviewAttributed.findMany({
      where: { memberId },
      orderBy: [{ updatedAt: "desc" }],
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
