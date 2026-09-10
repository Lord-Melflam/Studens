/**
 * Submitting a review.
 *
 * Two paths that share validation and share nothing else, which is FR-C6 in
 * code: they are not one function with a flag.
 *
 *   ATTRIBUTED  the module writes it itself. `studens_ryc` holds INSERT on
 *               ryc.ReviewAttributed, the row carries a memberId openly
 *               (FR-C7), and it stays editable by its author (FR-C14).
 *
 *   ANONYMOUS   the module CANNOT write it. `studens_ryc` holds SELECT and
 *               nothing else on ryc.ReviewAnonymous, so the module asks the
 *               platform kernel, which spends the quota and performs the
 *               insert in one transaction. The module never sees the member id
 *               reach the database and the kernel never sees what was written.
 */
import { PrismaClient } from "@prisma/client";
import { withQuota, type KernelTx } from "@studens/platform";

/** What a reviewer supplies. Shared by both paths: the content is identical. */
export interface ReviewInput {
  /** The course this concerns. Validated against the catalogue by the caller. */
  courseId: string;
  /** FR-D4: the year the reviewer TOOK the course, chosen by them. */
  academicYear: number;
  /** FR-D5: would you take it again, 1 to 5. */
  recommendation: number;
  /** FR-D6: workload against its ECTS, 1 (much lighter) to 5 (much heavier). */
  workloadVsEcts: number;
  /** FR-D7: difficulty, 1 to 5 categorical. */
  difficulty: number;
  /** FR-D6b: optional absolute hours. */
  hoursPerWeek?: number | undefined;
  /** FR-D22: optional. FR-D23: never shown per review. */
  passed?: boolean | undefined;
  /** FR-D8: minimum length, the same on both paths. */
  body: string;
  /** FR-D11: optional advice. */
  advice?: string | undefined;
  /** FR-D21: required, and it blocks the review if false. */
  completed: boolean;
}

/** FR-D8. Blocks non-reviews, not short ones. */
export const MIN_BODY = 80;

export class ReviewInvalid extends Error {
  constructor(readonly field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ReviewInvalid";
  }
}

const SCALE = { min: 1, max: 5 } as const;

/** Shared by both paths, because the content requirements do not differ. */
export function validate(input: ReviewInput, now: Date = new Date()): void {
  if (!input.completed) {
    // FR-D21. Adopted from the EPL document's own rule, and phrased as
    // "completed" rather than "sat the exam" because some courses have none.
    throw new ReviewInvalid("completed", "you must have completed the course to review it");
  }
  if (!input.courseId) throw new ReviewInvalid("courseId", "required");

  const thisYear = now.getUTCFullYear();
  if (!Number.isInteger(input.academicYear) || input.academicYear < 2000 || input.academicYear > thisYear + 1) {
    throw new ReviewInvalid("academicYear", `must be between 2000 and ${thisYear + 1}`);
  }

  for (const field of ["recommendation", "workloadVsEcts", "difficulty"] as const) {
    const v = input[field];
    if (!Number.isInteger(v) || v < SCALE.min || v > SCALE.max) {
      throw new ReviewInvalid(field, `must be an integer from ${SCALE.min} to ${SCALE.max}`);
    }
  }

  if (input.hoursPerWeek !== undefined) {
    if (!Number.isInteger(input.hoursPerWeek) || input.hoursPerWeek < 0 || input.hoursPerWeek > 100) {
      throw new ReviewInvalid("hoursPerWeek", "must be an integer from 0 to 100");
    }
  }

  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    throw new ReviewInvalid("body", `must be at least ${MIN_BODY} characters`);
  }
}

/** Columns shared by both tables. Written once so the two paths cannot drift. */
function content(input: ReviewInput) {
  return {
    courseId: input.courseId,
    academicYear: input.academicYear,
    recommendation: input.recommendation,
    workloadVsEcts: input.workloadVsEcts,
    difficulty: input.difficulty,
    hoursPerWeek: input.hoursPerWeek ?? null,
    passed: input.passed ?? null,
    body: input.body.trim(),
    advice: input.advice?.trim() || null,
  };
}

export interface SubmitOptions {
  client?: PrismaClient;
  now?: Date;
  /** The role that spends the quota. Defaults to the platform's. */
  assumeRole?: string | null;
  /** The role that writes the row. See each path below for why they differ. */
  writeRole?: string | null;
}

/**
 * The attributed path. The module owns this end to end.
 *
 * FR-D9: one review per member per course per year, enforced by a unique
 * constraint. FR-C13 scopes that to this path only: it cannot be enforced on
 * the anonymous path without a member-and-course marker, which FR-C2 forbids.
 */
export async function submitAttributed(
  memberId: string,
  input: ReviewInput,
  opts: SubmitOptions = {},
): Promise<{ id: string }> {
  validate(input, opts.now);
  const prisma = opts.client ?? new PrismaClient();
  try {
    return await withQuota(
      memberId,
      async (tx: KernelTx) => {
        const row = await tx.reviewAttributed.create({
          data: { memberId, ...content(input) },
          select: { id: true },
        });
        return row;
      },
      {
        client: prisma,
        ...(opts.now ? { now: opts.now } : {}),
        ...(opts.assumeRole !== undefined ? { assumeRole: opts.assumeRole } : {}),
        // The quota is platform data; this table is the module's own. The
        // platform holds no grant on it, deliberately, so the insert runs as
        // studens_ryc. Same transaction.
        writeRole: opts.writeRole !== undefined ? opts.writeRole : "studens_ryc",
      },
    );
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

/**
 * The anonymous path.
 *
 * Note what is NOT passed to the insert: `memberId` appears in this function's
 * signature and reaches `withQuota`, and it does not appear in `content(...)`
 * or anywhere below it. The table has no column for it (FR-C20), so a mistake
 * here fails to compile rather than leaking.
 *
 * `createdAt` is a DATE column, so the day is stored and the time is not
 * (FR-C5). The identifier is a random uuid, never a sequence and never derived
 * from the content (FR-C18).
 */
export async function submitAnonymous(
  memberId: string,
  input: ReviewInput,
  opts: SubmitOptions = {},
): Promise<{ id: string }> {
  validate(input, opts.now);
  const prisma = opts.client ?? new PrismaClient();
  const day = new Date(opts.now ?? new Date());
  day.setUTCHours(0, 0, 0, 0);
  try {
    return await withQuota(
      memberId,
      async (tx: KernelTx) => {
        const row = await tx.reviewAnonymous.create({
          data: { ...content(input), createdAt: day },
          select: { id: true },
        });
        return row;
      },
      {
        client: prisma,
        ...(opts.now ? { now: opts.now } : {}),
        ...(opts.assumeRole !== undefined ? { assumeRole: opts.assumeRole } : {}),
        // Both halves run as the platform: studens_ryc holds no INSERT here,
        // which is what stops the module bypassing the quota.
        ...(opts.writeRole !== undefined ? { writeRole: opts.writeRole } : {}),
      },
    );
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
