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

/**
 * Days per window, by default. **Changeable**, through
 * `platform.quotaWindowDays`.
 *
 * OPEN-26, resolved 2026-09-27 and revised the same day.
 *
 * THE FIRST VERSION OF THIS COMMENT ARGUED THE OPPOSITE, and it was wrong in
 * a way worth keeping written down. The argument was that changing the length
 * makes every stored counter belong to a window that no longer exists, so
 * every quota resets at once, and that this was "a way to empty the only rate
 * limit the product has, from a form". The mechanism is real. The conclusion
 * was not: a reset can only ever LOOSEN, it happens once, it is recorded in
 * the audit log, and it is done by somebody already trusted to set the limit
 * itself. Refusing the control bought nothing and cost the ability to respond
 * to how people actually use the product.
 *
 * So the reset is a documented consequence rather than a reason to forbid the
 * change, and the settings screen says so in as many words before anybody
 * presses anything.
 *
 * Windows stay aligned to the epoch whatever the length, so every member's
 * window still starts on the same day and a boundary still reveals nothing
 * about when anybody joined.
 */
export const WINDOW_DAYS = 7;

/**
 * Contributions permitted per window, by default.
 *
 * OPEN-26, resolved 2026-09-27: **five per seven days to begin with**, and
 * both numbers are an administrator's to change.
 *
 * REQUIREMENT: FR-C4 wants a per-person limit, and the design note requires it
 * be a counter on the member and nothing on the contribution, so the number is
 * the whole of the mechanism.
 *
 * WHY FIVE IS ONLY A STARTING POINT, and why the ceiling on the setting is
 * high rather than tidy. The contributor this product most wants is the
 * alumnus reviewing the courses of a whole degree, which is fifty to sixty of
 * them, in one sitting, once. A limit that stops that is a limit aimed at
 * exactly the wrong person. The first cohort also arrives at an almost empty
 * catalogue (OPEN-42), so early on the risk is not too much writing, it is
 * none.
 *
 * ALTERNATIVES REJECTED. One per day, because a student reviewing a semester
 * does it at the end of it and a daily drip means abandoning most of it. A
 * fixed constant with no setting, because five is a guess and nobody has
 * measured anything yet.
 *
 * COST ACCEPTED. It bounds ACCOUNTS, not people (OPEN-35), so it is a speed
 * bump and must never be described as more. Raising it raises how fast one
 * account can flood one course.
 *
 * WHAT WOULD CHANGE THE ANSWER: the first weeks of real use, which is the
 * whole reason both numbers are settings and not constants.
 */
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
