/**
 * The contribution quota.
 *
 * FR-C4 requires a per-person limit. FR-C2 forbids storing any member
 * identifier on an anonymous contribution. Those look contradictory and are
 * not, because they are facts about different objects:
 *
 *   Counting is a fact about the member. Linking is a fact about the
 *   contribution.
 *
 * So the counter lives on the member record, the contribution stores nothing,
 * and no shared key is ever written.
 *
 * FIXED WINDOWS ONLY. A rolling window needs a timestamp per submission, and
 * a timestamp per submission is a de facto join key against the anonymous
 * table (FR-C5). The member record therefore holds a window start and a count,
 * and nothing else. See docs/design/anonymous-rate-limiting.md.
 */

/** Days per window. Provisional: the real number is OPEN-26. */
export const WINDOW_DAYS = 7;

/** Contributions permitted per window. Provisional: OPEN-26. */
export const QUOTA_PER_WINDOW = 5;

const MS_PER_DAY = 86_400_000;

/**
 * The start of the fixed window containing `at`, as a UTC date.
 *
 * Windows are aligned to the epoch rather than to the member's first
 * contribution. Two reasons, and the second is the one that matters:
 *
 *   - it is a pure function of the date, so it needs no stored state and no
 *     read before the write
 *   - every member's windows start on the same day, so a window boundary
 *     reveals nothing about when a particular member joined or first
 *     contributed
 */
export function windowStartFor(at: Date, days: number = WINDOW_DAYS): Date {
  const dayIndex = Math.floor(at.getTime() / MS_PER_DAY);
  const bucket = Math.floor(dayIndex / days) * days;
  return new Date(bucket * MS_PER_DAY);
}

export class QuotaExceeded extends Error {
  constructor(
    readonly limit: number,
    readonly windowDays: number,
  ) {
    super(`quota of ${limit} per ${windowDays} days is exhausted for this window`);
    this.name = "QuotaExceeded";
  }
}
