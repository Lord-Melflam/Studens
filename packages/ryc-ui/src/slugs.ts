/**
 * This module's own route slugs, in each language (OPEN-49).
 *
 * WHY THE MODULE OWNS THIS AND THE SHELL DOES NOT. The shell may not know what
 * screens a module has (FR-B16): it hands over a path and takes one back, and
 * reads neither. If it translated these words it would have to hold a list of
 * RYC's screens, which is the coupling that rule exists to prevent. So the
 * translation happens on this side of the boundary, at the two points where a
 * path crosses it, and the shell is unchanged.
 *
 * CANONICAL INSIDE, exactly as the shell does it for its own pages. Every
 * route in this module is the canonical form, `/search`, `/my-reviews`,
 * `/c/uclouvain/lepl1503/review`, so `parseView` and `coursePath` are written
 * once rather than once per language, and no screen has to know that slugs are
 * translated at all.
 *
 * SEGMENT BY SEGMENT, rather than only the first, because the word that names
 * the writing screen sits at the END of a course path. A segment not in this
 * table is left exactly as it is, which covers `c`, `p`, institution codes and
 * course codes. None of those can collide: the table holds three words, and
 * an institution or course code that happened to be one of them would fail the
 * round trip test in `test/ui/ryc-slugs.test.ts`.
 */
import { LOCALES, type Locale } from "@studens/i18n";

/**
 * The words follow what each screen calls itself, so the address bar and the
 * heading agree: "Mes avis" is `/mes-avis` and "Mijn beoordelingen" is
 * `/mijn-beoordelingen`.
 */
const SLUGS: Record<string, Record<Locale, string>> = {
  search: { fr: "recherche", nl: "zoeken", en: "search" },
  "my-reviews": { fr: "mes-avis", nl: "mijn-beoordelingen", en: "my-reviews" },
  // The suffix that turns a course page into the form for writing about it.
  review: { fr: "avis", nl: "beoordeling", en: "review" },
};

const CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(SLUGS).flatMap(([page, byLocale]) =>
    LOCALES.map((l) => [byLocale[l], page] as const),
  ),
);

function mapSegments(path: string, f: (seg: string) => string): string {
  const q = path.indexOf("?");
  const bare = q < 0 ? path : path.slice(0, q);
  const search = q < 0 ? "" : path.slice(q);
  const lead = bare.startsWith("/") ? "/" : "";
  const mapped = bare.replace(/^\/+/, "").split("/").map(f).join("/");
  return lead + mapped + search;
}

/** Canonical route to what a reader sees: `("/search", "fr")` is `/recherche`. */
export function toSlugPath(route: string, locale: Locale): string {
  return mapSegments(route, (seg) => SLUGS[seg]?.[locale] ?? seg);
}

/**
 * What a reader typed, back to the canonical route.
 *
 * Any language's slug resolves, not only the current one. It costs nothing,
 * because the table already holds all three, and it means a link written
 * before this change still opens the screen it names.
 */
export function fromSlugPath(path: string): string {
  return mapSegments(path, (seg) => CANONICAL[seg] ?? seg);
}
