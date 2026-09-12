import { LOCALES, LOCALE_NAMES, localePath, useLocale, useT } from "@studens/i18n";

/**
 * The language switcher.
 *
 * Plain links to the same route in another language, so switching keeps you on
 * the page you were reading instead of dropping you home, and so each language
 * has a URL that can be sent to someone.
 *
 * Names are in their own language and are never translated: "Nederlands" is
 * what a Dutch speaker looks for, and "Néerlandais" is not.
 */
export function LanguageSwitcher({ route }: { route: string }) {
  const active = useLocale();
  const t = useT();
  return (
    <nav className="lang" aria-label={t("nav.language")}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={localePath(route, l)}
          className={l === active ? "on" : ""}
          aria-current={l === active ? "true" : undefined}
          lang={l}
        >
          {l.toUpperCase()}
          <span className="lang-full">{LOCALE_NAMES[l]}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * `path` is a prop rather than read from `window` inside here. The zone above
 * already knows it, so reaching for the global would be a second source of the
 * same truth, and it makes the layout impossible to render outside a browser.
 */
