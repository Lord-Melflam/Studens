import { LOCALES, LOCALE_NAMES, useLocale, useT } from "@studens/i18n";
import { navigationTarget } from "./router.js";

/**
 * The language switcher.
 *
 * Plain links to the same route in another language, so switching keeps you on
 * the page you were reading instead of dropping you home, and so each language
 * has a URL that can be sent to someone.
 *
 * THE SLUG CHANGES WITH THE LANGUAGE, not just the prefix (OPEN-49). Leaving
 * `/nl/privacy` and choosing French has to give `/fr/confidentialite`, not
 * `/fr/privacy`. It goes through `navigationTarget` for that: `route` is the
 * canonical form, and the translation happens where every other URL in the
 * application is written, so this switcher cannot drift from the rest.
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
          href={navigationTarget(route, l)}
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
