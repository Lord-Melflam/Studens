/**
 * The frame around every public page.
 *
 * Nothing here needs a session, and nothing here may require one (FR-F2).
 *
 * FR-B16 applies to this file as much as to the app shell: no word belonging
 * to a module's domain. What a module is FOR is supplied by the module itself
 * (`ModuleRegistration.presentation`), so this file can lay out a page about
 * something it does not understand. That is the same reason the registry
 * exists, applied one zone further out.
 */
import { LOCALES, LOCALE_NAMES, localePath, useLocale, useT } from "@studens/i18n";
import { linkProps } from "../router.js";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/modules", key: "nav.modules" },
  { to: "/confidentialite", key: "nav.privacy" },
  { to: "/a-propos", key: "nav.about" },
];

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
function LanguageSwitcher({ route }: { route: string }) {
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
export function PublicLayout({ path, children }: { path: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="site">
      <header className="site-header">
        <a className="site-brand" {...linkProps("/")}>
          Studens
        </a>
        <nav className="site-nav">
          {NAV.map((item) => (
            <a
              key={item.to}
              className={path === item.to ? "on" : ""}
              aria-current={path === item.to ? "page" : undefined}
              {...linkProps(item.to)}
            >
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className="site-actions">
          {/*
            Two labels, one destination. FR-F3: registration is open (FR-A6)
            and there are no passwords (FR-A7), so someone we have not seen
            simply becomes a member. A visitor arriving to join and one coming
            back look for different words, which is the only reason both exist.
          */}
          <LanguageSwitcher route={path} />
          <a className="ghost" {...linkProps("/connexion")}>
            {t("nav.signin")}
          </a>
          <a className="cta" {...linkProps("/connexion")}>
            {t("nav.register")}
          </a>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="foot-cols">
          <div>
            <strong>Studens</strong>
            <p>{t("foot.tagline")}</p>
          </div>
          <nav>
            {NAV.map((item) => (
              <a key={item.to} {...linkProps(item.to)}>
                {t(item.key)}
              </a>
            ))}
            <a href="https://github.com/Lord-Melflam/Studens" rel="noopener noreferrer">
              {t("nav.source")}
            </a>
          </nav>
        </div>
        <p className="foot-fine">{t("foot.fine")}</p>
        {/*
          Said plainly rather than implied. A Dutch-speaking reader who lands on
          a French course description should know that is the institution's
          doing and not a gap in the product.
        */}
        <p className="foot-fine">{t("lang.note")}</p>
      </footer>
    </div>
  );
}
