/**
 * URL construction. Templates only.
 *
 * There is no list of faculties, programmes or course codes anywhere in this
 * package: every one of them is DISCOVERED by following links from the single
 * root below. That is François's requirement of 2026-09-10, and the reason is
 * that a hardcoded list is wrong within a year.
 * docs/design/catalogue-ingestion.md section 0.
 */

export const BASE = "https://uclouvain.be";

/** The single entry point. Everything else is reached from here. */
export function facultyIndex(year: number): string {
  return `${BASE}/fr/catalogue-formations/formations-par-faculte-${year}`;
}

/**
 * Patterns used to recognise links on a fetched page. Deliberately built from
 * the year rather than matched loosely, so a page that links to a different
 * year cannot silently drag the crawl into it.
 *
 * `(?:^|/)` matters and was a real bug. Href forms on the live site are NOT
 * consistent: the faculty index uses "/prog-2025-fsa1ba" while a programme
 * listing uses "cours-2025-lepl1101" with no leading slash (verified
 * 2026-09-10). A pattern requiring the slash finds 43 programmes and then zero
 * courses, and the crawl fails at the last step with nothing to show for it.
 */
const linked = (segment: string, year: number): RegExp =>
  new RegExp(`(?:^|/)${segment}-${year}-([a-z0-9]+)\\b`, "i");

export function facultyLinkPattern(year: number): RegExp {
  return new RegExp(`(?:^|/)catalogue-formations/faculte-${year}-([a-z0-9]+)\\b`, "i");
}

export function programmeLinkPattern(year: number): RegExp {
  return linked("prog", year);
}

export function courseLinkPattern(year: number): RegExp {
  return linked("cours", year);
}

/**
 * Years before roughly 2024 redirect to
 * sites.uclouvain.be/archives-portail/cdc<year>/, so every fetch follows
 * redirects and may cross hosts. Verified 2026-09-10.
 */
export function courseUrl(year: number, code: string): string {
  return `${BASE}/cours-${year}-${code.toLowerCase()}`;
}

/**
 * A programme's landing page links to sub-pages and carries no course list of
 * its own (verified 2026-09-10: `prog-2025-sinf1ba` yields zero course links).
 * The course list lives on one of these suffixes, tried in order:
 *
 *   -programme                 works for bachelor and master alike
 *                              (sinf1ba 46 courses, info2m 85)
 *   -programme_annual_blocks   a bachelor-only variant
 *                              (sinf1ba 46, info2m 0)
 *
 * These are URL GRAMMAR, not an entity list, and the distinction is the whole
 * point of the no-hardcoding rule. Hardcoding which faculties or courses exist
 * is wrong because that changes every year. Hardcoding how UCLouvain spells a
 * path is no different from hardcoding "/cours-" itself: if it changes, every
 * request fails loudly and immediately rather than silently returning less.
 * docs/design/catalogue-ingestion.md sections 0 and 2.
 */
export const PROGRAMME_LISTING_SUFFIXES = ["-programme", "-programme_annual_blocks"] as const;

export function programmeListingUrls(year: number, programme: string): string[] {
  return PROGRAMME_LISTING_SUFFIXES.map((s) => `${BASE}/prog-${year}-${programme}${s}`);
}
