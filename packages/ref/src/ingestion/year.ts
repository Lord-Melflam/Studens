/**
 * Academic year arithmetic.
 *
 * UCLouvain URLs carry ONE year, and it is the FIRST year of the academic
 * year: 2025-2026 is `cours-2025-...`. The academic year starts in
 * mid-September, so the calendar year and the academic year disagree for
 * roughly three and a half months every year.
 *
 * docs/design/catalogue-ingestion.md section 3 requires deriving this from the
 * DATE, not from the calendar year. Using `now().getFullYear()` naively
 * produces a URL that does not exist for a third of the year, and the failure
 * looks like "UCLouvain changed their site" rather than "our date arithmetic is
 * wrong".
 */

/**
 * The month and day the academic year rolls over. Mid-September.
 * A single named constant, because the whole point is that this boundary is
 * explicit rather than implied by an off-by-one somewhere.
 */
export const ROLLOVER = { month: 9, day: 15 } as const;

/** The first year of the academic year in progress on `date`. */
export function academicYearFor(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const afterRollover =
    month > ROLLOVER.month || (month === ROLLOVER.month && day >= ROLLOVER.day);
  return afterRollover ? year : year - 1;
}

/**
 * Years to probe, in the order to try them. Never assume which years exist:
 * next year's catalogue is published before the year starts (verified,
 * `cours-2026-` resolved on 2026-09-10), and the current one may lag.
 */
export function candidateYears(date: Date): number[] {
  const current = academicYearFor(date);
  return [current, current + 1, current - 1];
}

/** Reject a year that cannot plausibly be a UCLouvain catalogue year. */
export function assertPlausibleYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new RangeError(`implausible academic year: ${year}`);
  }
}
