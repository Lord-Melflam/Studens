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
import { useT } from "@studens/i18n";
import { Brand } from "../Brand.js";
import { linkProps } from "../router.js";
import { Account } from "../Account.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/modules", key: "nav.modules" },
  { to: "/confidentialite", key: "nav.privacy" },
  { to: "/a-propos", key: "nav.about" },
];

export function PublicLayout({ path, children }: { path: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="site">
      <header className="site-header">
        <a className="site-brand" {...linkProps("/")}>
          <Brand />
        </a>
        <nav className="site-nav">
          {NAV.map((item) => (
            <a
              key={item.to}
              className={path === item.to ? "here" : ""}
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
          {/*
            Session aware. Signed out it offers the two labels FR-F3 explains;
            signed in it offers the way into the app and the way out. A header
            that ignores the session tells someone who has just joined that
            nothing happened.
          */}
          {/* `here` so the sign-in buttons can say so too: they lead to the
              page a visitor may already be standing on. */}
          <Account variant="public" here={path === "/connexion"} />
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
