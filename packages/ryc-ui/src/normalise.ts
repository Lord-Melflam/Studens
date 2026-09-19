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
};

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
