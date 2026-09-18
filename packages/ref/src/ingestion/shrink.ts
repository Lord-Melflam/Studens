/**
 * REFUSING TO REPLACE A CATALOGUE WITH A MUCH SMALLER ONE.
 *
 * `npm run ingest -- --max 40` used to write `data/catalogue.json`, the same
 * file a full crawl writes, and `db:load` would then cheerfully replace 6,715
 * courses with 40. Every step succeeded. Nothing was corrupt, nothing failed,
 * and the catalogue was gone.
 *
 * François, on being told the answer was a warning in a document: "It can
 * happen, either my mistake or purpose (for good reason of course), so how to
 * prevent things from going brrr instead of just relying on people good
 * sense?" He is right. A note in a runbook is not a mechanism, and this
 * project already records that a rule written is not a rule applied
 * (LESSONS.md section 9).
 *
 * WHAT THIS IS NOT. It is not a check that the new snapshot is good. A
 * catalogue can shrink legitimately: a university retires a faculty, a crawl
 * is re-scoped, a year ends. So this does not decide whether shrinking is
 * right. It decides that shrinking a lot is a thing somebody has to SAY they
 * meant, which is the difference between a mistake and a decision.
 *
 * THE THRESHOLD IS A JUDGEMENT AND IT IS WRITTEN DOWN. A fifth. UCLouvain's
 * real year-on-year movement is tens of courses out of 6,715, well under one
 * percent, so a fifth is far outside anything a real crawl has produced and
 * far inside the sampled crawls that cause this (40 of 6,715 is a 99% drop).
 * What would change it: a legitimate re-scoping that trips it twice, at which
 * point the number is wrong rather than the guard.
 *
 * GROWTH IS NEVER REFUSED. A catalogue that doubles is a catalogue that
 * widened, which is what most of this project's crawls have done.
 */

/** How much of the old catalogue may disappear before somebody has to say so. */
export const SHRINK_LIMIT = 0.2;

export interface ShrinkVerdict {
  /** True when the load should be refused unless it was forced. */
  refuse: boolean;
  before: number;
  after: number;
  /** The proportion lost, 0 when it grew. */
  lost: number;
}

export function shrinkVerdict(before: number, after: number): ShrinkVerdict {
  // Nothing loaded yet is not a shrink: the first load of any catalogue, and
  // of every second institution, arrives against zero.
  if (before === 0) return { refuse: false, before, after, lost: 0 };
  const lost = Math.max(0, (before - after) / before);
  return { refuse: lost > SHRINK_LIMIT, before, after, lost };
}

/** What to print when it is refused. Says the numbers and the way through. */
export function shrinkMessage(v: ShrinkVerdict, institution: string): string {
  const pct = (v.lost * 100).toFixed(1);
  return (
    `refusing to load: this would remove ${pct}% of ${institution}'s catalogue, ` +
    `${v.before} offerings down to ${v.after}.\n` +
    `  A sampled crawl (--max) or a partial one produces exactly this.\n` +
    `  If the catalogue really did shrink, say so: npm run db:load -- --shrink-ok`
  );
}
