/**
 * TWO UNIVERSITIES SAYING THE SAME THING DIFFERENTLY.
 *
 * The filter panel offered "premier quadrimestre" AND "Q1" as separate
 * choices, and "Français" beside "fr", because UCLouvain and ULB label the
 * same fact in their own words. Picking one filtered out the other's courses
 * silently, which is worse than a cosmetic duplicate: it answers a question
 * wrongly without saying so.
 *
 * NORMALISED FOR FILTERING, NOT IN STORAGE. The catalogue keeps exactly what
 * each university published, which is the rule the whole ingestion follows: a
 * course page shows its own institution's words, and the official link is
 * always there to check against. This maps those words onto a common key so
 * that one chip can match both, and nothing is rewritten.
 *
 * Doing it here rather than at ingestion also means it applies to the
 * catalogue already loaded. The alternative was a 75 minute re-crawl of each
 * university to change how a chip is labelled, which is a poor trade.
 *
 * IT IS LOSSY, ON PURPOSE, AND ONLY HERE. "Anglais > Facilités pour suivre le
 * cours en français" is a real distinction that belongs on the course page and
 * would be a filter nobody could use: 374 courses across one value that exists
 * at one university. The filter answers "what language is it taught in"; the
 * page answers the rest.
 *
 * UNKNOWN VALUES PASS THROUGH UNCHANGED. A university that publishes something
 * this table has never seen gets its own chip rather than vanishing, which is
 * the same rule the catalogue follows everywhere: a thing we cannot classify
 * is still a thing.
 */

/** Canonical terms. Language neutral, because the interface is in three. */
const QUARTER: Record<string, string> = {
  q1: "Q1",
  "premier quadrimestre": "Q1",
  q2: "Q2",
  "deuxieme quadrimestre": "Q2",
  q3: "Q3",
  "troisieme quadrimestre": "Q3",
  "1e et 2e quadrimestre": "Q1+Q2",
  "annee academique": "Q1-Q3",
  /*
    A COURSE CAN TOUCH TWO TERMS, AND UCLouvain SAYS SO IN FOUR WAYS.
    Measured across 10,268 cached pages on 2026-09-27:

        Q1 et Q2   1026      Q1 and Q2   351
        Q1 ou Q2    143      Q1 or Q2     55

    Fifteen hundred pages, and every one of them parsed to null and displayed
    as "term not stated", because the parser matched `^Q[1-4]$` and these are
    not that. Reported from use: the official page states the term and ours
    did not.

    `et` and `ou` are NOT the same fact and are kept apart. "Q1 et Q2" is one
    course running across the year; "Q1 ou Q2" is a course given twice, of
    which a student takes one. Both mean it is available in either term, which
    is what the filter cares about, and only the second means you may choose,
    which is what the reader cares about.

    English maps onto the French keys rather than getting its own, the same
    rule the rest of the catalogue follows: one set of keys, not two
    vocabularies for one fact.
  */
  "q1 et q2": "Q1+Q2",
  "q1 and q2": "Q1+Q2",
  "q1 ou q2": "Q1/Q2",
  "q1 or q2": "Q1/Q2",
  "q2 et q3": "Q2+Q3",
  "q2 and q3": "Q2+Q3",
  "q2 ou q3": "Q2/Q3",
  "q2 or q3": "Q2/Q3",
};

/**
 * The individual terms a course actually touches.
 *
 * THE FILTER NEEDS A SET, THE CARD NEEDS THE STRING. A student asking for Q1
 * courses means every course they could attend in Q1, which includes the ones
 * running across both terms and the ones offered in either. Matching the
 * canonical string exactly gave them only the courses marked plainly `Q1`, so
 * a thousand were invisible to a filter that claimed to list them.
 *
 * Faceting on terms also keeps the chips to the three that exist rather than
 * growing one per combination.
 */
export function quarterTerms(raw: string | null): string[] {
  const key = quarterKey(raw);
  if (!key) return [];
  // `Q1-Q3` is a year, so it touches everything between its ends.
  const span = /^Q(\d)-Q(\d)$/.exec(key);
  if (span) {
    const [from, to] = [Number(span[1]), Number(span[2])];
    return Array.from({ length: to - from + 1 }, (_, i) => `Q${from + i}`);
  }
  const found = key.match(/Q\d/g);
  return found ? [...new Set(found)] : [];
}

/**
 * ISO 639-1, because a code is the one spelling that is nobody's language.
 * Storing "Français" and showing it to a Dutch reader was always wrong; this
 * at least stops the filter doing it twice over.
 */
const LANGUAGE: Record<string, string> = {
  francais: "fr",
  anglais: "en",
  neerlandais: "nl",
  allemand: "de",
  espagnol: "es",
  italien: "it",
  portugais: "pt",
  turc: "tr",
  russe: "ru",
  arabe: "ar",
  chinois: "zh",
  japonais: "ja",
  polonais: "pl",
  grec: "el",
  latin: "la",
  "langue des signes de belgique francophone": "sfb",
};

/** Lower case, unaccented, trimmed. The two sources differ in all three. */
function flatten(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function quarterKey(raw: string | null): string | null {
  if (raw === null) return null;
  return QUARTER[flatten(raw)] ?? raw;
}

/**
 * The language a course is taught in.
 *
 * Everything after `>` is UCLouvain qualifying the main language, and
 * everything after `/` is ULB naming a second one. Both describe the same
 * course in the same primary language, so the part before the separator is the
 * answer and the rest belongs on the page.
 */
export function languageKey(raw: string | null): string | null {
  if (raw === null) return null;
  const primary = flatten(raw).split(/[>/]/)[0]!.trim();
  if (primary === "") return raw;
  // Already a code, which is how ULB publishes it.
  if (/^[a-z]{2,3}$/.test(primary)) return primary;
  return LANGUAGE[primary] ?? raw;
}
