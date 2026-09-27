/**
 * The public route slugs, in each language (OPEN-49).
 *
 * THE LANGUAGE IS IN THE PATH AND THE NEXT SEGMENT USED TO CONTRADICT IT. A
 * Dutch reader was sent to `/nl/confidentialite` and an English one to
 * `/en/connexion`. That was never decided: the route map was written while the
 * product was French only, the language prefix arrived afterwards, and nothing
 * chose to keep the slugs. The address bar is the one part of a page somebody
 * copies, pastes and reads aloud, and it was saying the interface is not
 * really translated, which is the single claim the language switcher makes.
 *
 * CANONICAL INSIDE, LOCALISED AT THE EDGE. Every route inside this application
 * is the canonical form, `/privacy`, `/about`, `/signin`. Exactly one function
 * converts on the way in and one on the way out, both here, so no screen and
 * no test has to know that slugs are translated at all. The alternative,
 * carrying localised paths through the app, means every comparison has to know
 * the current language and the language switcher has to rewrite a path it
 * cannot parse.
 *
 * IT IS ALSO WHAT MAKES THE SWITCHER WORK. Switching from Dutch to French on
 * `/nl/privacy` has to produce `/fr/confidentialite`. With canonical routes
 * inside, that is the existing code path with a different locale argument. It
 * was the part most likely to be forgotten, and it is now the part that cannot
 * be, because nothing else would work either.
 *
 * WHAT IS NOT TRANSLATED, and each for a reason rather than by omission:
 *
 *   - `/app` itself. It is a mount point rather than a page name, and it is
 *     the same short word in all three languages.
 *   - A module id, an institution code, a course code. They are identifiers,
 *     not words, and translating them would break the thing they identify.
 *   - A module's own slugs. The shell may not know what screens a module has
 *     (FR-B16), so a module translates its own path itself. RYC does it in
 *     `packages/ryc-ui/src/slugs.ts`, and the shell never sees the difference.
 *     That is why this file translates at most TWO segments and never walks
 *     the whole path: segment one is a public page, segment two is the shell's
 *     own reserved name under `/app`, and everything deeper belongs to
 *     somebody else.
 *   - Query parameter names. They are the module's vocabulary, they are in
 *     every link anybody has shared, and a link sent by a French reader to a
 *     Dutch one has to keep meaning the same thing.
 *   - `modules`, which is the same word in all three languages.
 */
import { LOCALES, type Locale } from "@studens/i18n";

/**
 * Canonical page name to the slug each language shows.
 *
 * The slugs follow the words the interface already uses for these pages, so
 * the address bar and the navigation agree: the Dutch nav says "Privacy" and
 * "Aanmelden", and so does the Dutch URL. `about` is the one exception,
 * `over-ons` rather than the nav's bare "Over", because a slug is read on its
 * own with no heading above it and "over" alone is also an English preposition.
 */
const SLUGS: Record<string, Record<Locale, string>> = {
  modules: { fr: "modules", nl: "modules", en: "modules" },
  privacy: { fr: "confidentialite", nl: "privacy", en: "privacy" },
  about: { fr: "a-propos", nl: "over-ons", en: "about" },
  signin: { fr: "connexion", nl: "aanmelden", en: "sign-in" },
  suspended: { fr: "suspendu", nl: "geschorst", en: "suspended" },
  welcome: { fr: "bienvenue", nl: "welkom", en: "welcome" },
};

/**
 * The shell's own screens inside `/app`, which are reserved segments rather
 * than modules: no module may claim these ids.
 *
 * They are translated for the same reason as the pages above, and separately
 * because they sit one segment deeper. A module id is not in this table, so it
 * passes through and the module gets its path exactly as the reader typed it.
 */
const APP_SLUGS: Record<string, Record<Locale, string>> = {
  settings: { fr: "mon-compte", nl: "mijn-account", en: "my-account" },
  moderation: { fr: "moderation", nl: "moderatie", en: "moderation" },
  // FR-F16. The catalogue of modules, which is a shell screen rather than a
  // module: it is the list OF them, so it cannot belong to one of them.
  store: { fr: "modules", nl: "modules", en: "modules" },
};

const APP_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(APP_SLUGS).flatMap(([page, byLocale]) =>
    LOCALES.map((l) => [byLocale[l], page] as const),
  ),
);

/** The mount point, untranslated, so it can be recognised in either direction. */
const APP = "app";

/** Localised slug back to the canonical name, for every language at once. */
const CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(SLUGS).flatMap(([page, byLocale]) =>
    LOCALES.map((l) => [byLocale[l], page] as const),
  ),
);

/** The first segment of a path, and whatever follows it. */
function head(path: string): { first: string; rest: string } {
  const clean = path.replace(/^\/+/, "");
  const cut = clean.indexOf("/");
  if (cut < 0) return { first: clean, rest: "" };
  return { first: clean.slice(0, cut), rest: clean.slice(cut) };
}

/**
 * Canonical route to the path a reader sees: `("/privacy", "fr")` is
 * `/confidentialite`.
 *
 * Only the first segment is touched. `/welcome/3` keeps its step and
 * `/app/ryc/c/uclouvain/lepl1503` passes through whole, because `app` is not
 * a page in this table.
 */
export function toSlugPath(route: string, locale: Locale): string {
  if (route === "/" || route === "") return "/";
  const { first, rest } = head(route);
  if (first === APP) {
    const { first: second, rest: deeper } = head(rest);
    const slug = APP_SLUGS[second]?.[locale];
    return slug ? `/${APP}/${slug}${deeper}` : route;
  }
  const slug = SLUGS[first]?.[locale];
  return slug ? `/${slug}${rest}` : route;
}

/**
 * The path a reader typed, back to the canonical route.
 *
 * ANY LANGUAGE'S SLUG RESOLVES, not just the current one. This costs nothing,
 * because the table already holds all three, and it is not a redirect list
 * anybody has to maintain. It means a link written before this change, or one
 * where somebody edited the language prefix by hand, lands on the page it
 * names instead of silently falling through to the landing page. The URL is
 * then corrected to the current language's slug, so the address bar never
 * keeps a form the reader did not ask for.
 */
export function fromSlugPath(path: string): string {
  if (path === "/" || path === "") return "/";
  const { first, rest } = head(path);
  if (first === APP) {
    const { first: second, rest: deeper } = head(rest);
    const page = APP_CANONICAL[second];
    return page ? `/${APP}/${page}${deeper}` : path;
  }
  const page = CANONICAL[first];
  return page ? `/${page}${rest}` : path;
}
