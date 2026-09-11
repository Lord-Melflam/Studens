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
import { linkProps } from "../router.js";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/modules", label: "Ce que ça fait" },
  { to: "/confidentialite", label: "Vie privée" },
  { to: "/a-propos", label: "À propos" },
];

/**
 * `path` is a prop rather than read from `window` inside here. The zone above
 * already knows it, so reaching for the global would be a second source of the
 * same truth, and it makes the layout impossible to render outside a browser.
 */
export function PublicLayout({ path, children }: { path: string; children: React.ReactNode }) {
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
              {item.label}
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
          <a className="ghost" {...linkProps("/connexion")}>
            Se connecter
          </a>
          <a className="cta" {...linkProps("/connexion")}>
            Créer un compte
          </a>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="foot-cols">
          <div>
            <strong>Studens</strong>
            <p>
              Un projet indépendant, sans but lucratif, affilié à aucune
              université ni haute école.
            </p>
          </div>
          <nav>
            {NAV.map((item) => (
              <a key={item.to} {...linkProps(item.to)}>
                {item.label}
              </a>
            ))}
            <a href="https://github.com/Lord-Melflam/Studens" rel="noopener noreferrer">
              Code source
            </a>
          </nav>
        </div>
        <p className="foot-fine">
          Le code est ouvert, sous licence MIT. Ce qui est publié ici vient des
          étudiants, pas des institutions.
        </p>
      </footer>
    </div>
  );
}
