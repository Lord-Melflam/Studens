/**
 * What KIND of programme a title describes, and where it is taught.
 *
 * UCLouvain does not publish either as a field. Both are stated in the title,
 * in a form that has been stable across every archived year the crawl reaches:
 *
 *   "Master [120] : ingénieur civil en informatique (Louvain-la-Neuve)"
 *   "Mineure en Electricité (Louvain-la-Neuve)"
 *   "Certificat d'université : Cybersécurité (Louvain-la-Neuve)"
 *
 * So this is a parse, and it belongs with the rest of the parsing rather than
 * in the screen that draws the filter. Two reasons. It is testable here against
 * the real catalogue, and it has one home: a heuristic written inline in a
 * component gets copied the second time somebody needs it, and then the two
 * copies drift.
 *
 * IT RETURNS NULL RATHER THAN GUESSING. A title that matches nothing is
 * `null`, which the interface shows as "autre" and the filter treats as its own
 * group. The alternative, falling back to the nearest match, would put a
 * certificate under "master" and nothing would ever say so. This is the same
 * rule as the offering parser: "absent because the era lacks it" must stay
 * distinguishable from "absent because the parse broke".
 *
 * The code suffixes agree with this and are deliberately NOT used: `1ba`, `2m`,
 * `2mc`, `2fc`, `fil`, `mino`. They agree today, and they are an abbreviation
 * scheme rather than a statement, so the title is the better source. They are a
 * cross-check in the tests instead.
 */

/**
 * The kinds, as the titles state them. Not a taxonomy of Belgian higher
 * education: if UCLouvain starts publishing a word that is not here, the answer
 * is null and a test fails, which is the point.
 */
export type ProgrammeKind =
  | "bachelier"
  | "master"
  | "specialisation"
  | "mineure"
  | "filiere"
  | "certificat"
  | "approfondissement";

export interface ProgrammeShape {
  kind: ProgrammeKind | null;
  /**
   * ECTS credits of a master, 120 or 60, from the bracket in the title.
   *
   * Null for every other kind and for a master that does not state it. It
   * matters enough to keep: a "Master [60]" and a "Master [120]" are different
   * commitments and a student filtering for one does not want the other.
   */
  credits: number | null;
  /** The site in the trailing parenthesis. Null when the title has none. */
  site: string | null;
}

/** The site is the last parenthesised group, and only at the very end. */
function siteOf(title: string): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(title);
  return m ? m[1]!.trim() : null;
}

export function programmeShape(title: string): ProgrammeShape {
  const t = title.trim();
  const site = siteOf(t);
  const credits = /^Master\s*\[(\d+)\]/i.test(t)
    ? Number(/^Master\s*\[(\d+)\]/i.exec(t)![1])
    : null;

  // Ordered, and the order matters once: "Master de spécialisation" must be
  // tested before the plain "Master" or it would be filed as a master.
  const kind: ProgrammeKind | null = /^Master\s+de\s+sp[ée]cialisation/i.test(t)
    ? "specialisation"
    : /^Master\b/i.test(t)
      ? "master"
      : /^Bachelier\b/i.test(t)
        ? "bachelier"
        : /^Mineure\b/i.test(t)
          ? "mineure"
          : /^Fili[èe]re\b/i.test(t)
            ? "filiere"
            : // Both "Certificat d'université" and "Certificat inter-universités",
              // and the one "Attestation de réussite", are continuing education
              // with an `fc` code. One group, because a student filtering the
              // list is asking "is this a degree or not".
              /^Certificat\b/i.test(t) || /^Attestation\b/i.test(t)
              ? "certificat"
              : /^Approfondissement\b/i.test(t)
                ? "approfondissement"
                : null;

  return { kind, credits, site };
}
