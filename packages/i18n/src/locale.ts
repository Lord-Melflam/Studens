/**
 * Three languages, because the name was chosen for them.
 *
 * `Studens` reads natively in French, Dutch and English, and that was one of
 * the reasons for picking it (README, "The name"). Shipping a French-only
 * product under that name is a claim the product does not honour, and Belgian
 * higher education is split along exactly this line: the Flemish Community and
 * the French Community legislate separately, so a platform meant for both
 * cannot be monolingual.
 *
 * French is the source language. It is the one the first institution teaches
 * in, and the one the person writing the copy thinks in, so translating out of
 * it loses least.
 */
export const LOCALES = ["fr", "nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Shown in the language switcher. In the language itself, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  nl: "Nederlands",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Split `/nl/a-propos` into its locale and the rest.
 *
 * THE LOCALE IS IN THE PATH, not in a cookie alone.
 *
 * A cookie cannot be shared: a Flemish student sending a link to a French
 * speaking friend would send them a page in Dutch, or worse, a page in
 * whichever language the recipient last used, so the same URL would show
 * different things to different people. A path can be copied, sent, bookmarked
 * and crawled, and it says what it is.
 *
 * The cost is that every route carries a prefix and every internal link has to
 * build one. That is one function, used everywhere, and it is why this lives
 * here rather than being open-coded.
 */
export function splitLocale(path: string): { locale: Locale | null; rest: string } {
  const trimmed = path.replace(/\/+$/, "") || "/";
  const [, head = "", ...tail] = trimmed.split("/");
  if (!isLocale(head)) return { locale: null, rest: trimmed };
  const rest = `/${tail.join("/")}`.replace(/\/+$/, "") || "/";
  return { locale: head, rest };
}

/** Build a path in a given language: `("/a-propos", "nl")` -> `/nl/a-propos`. */
export function localePath(rest: string, locale: Locale): string {
  const clean = rest === "/" ? "" : rest.replace(/\/+$/, "");
  return `/${locale}${clean}`;
}

/**
 * The best language for a visitor who has not chosen one.
 *
 * Reads the browser's own preference list rather than guessing from anything
 * else. A Belgian browser set to Dutch gets Dutch; one set to something we do
 * not have falls back to French rather than to English, because the first
 * institution served teaches in French.
 */
export function preferredLocale(
  accepted: readonly string[] = [],
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  for (const tag of accepted) {
    const base = tag.toLowerCase().split("-")[0] ?? "";
    if (isLocale(base)) return base;
  }
  return fallback;
}
