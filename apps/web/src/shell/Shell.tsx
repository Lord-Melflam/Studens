/**
 * The shell: the app zone.
 *
 * FR-B17: a Member arrives HERE, not inside a module.
 *
 * This file knows nothing about courses, reviews, ECTS or programmes. If it
 * ever does, the boundary in FR-B16 has been lost. It slices its own prefix off
 * the path and hands the rest to the module without parsing it, so a module can
 * own its URLs while the shell stays ignorant of what they mean.
 */
import { useT } from "@studens/i18n";
import { Account } from "../Account.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { activeModuleFor, liveModules } from "./registry.js";
import { APP_PREFIX, currentRoute, linkProps, moduleIdFrom, navigate, usePath } from "../router.js";

function Home() {
  const t = useT();
  return (
    <>
      <p className="lede">{t("app.home.lede")}</p>
      <ul className="modules">
        {liveModules.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => navigate(`${APP_PREFIX}/${m.id}`)}>
              <span className="name">{m.name}</span>
              <span className="summary">{m.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="footnote">{t("app.home.more")}</p>
    </>
  );
}

export function Shell() {
  const t = useT();
  const path = usePath();
  const route = currentRoute(path);
  const routeId = moduleIdFrom(path);
  const active = activeModuleFor(path);
  const Module = active?.component;

  // Everything below /app/<id> belongs to the module. Sliced here, never read.
  const inside = active ? route.slice(`${APP_PREFIX}/${active.id}`.length) || "/" : "/";

  return (
    <main>
      <header>
        {/*
          The brand goes to the public site, not to the app home. Before this,
          the app was one directional: once inside there was no way back out to
          what Studens is, who runs it, or what anonymity does not protect.
        */}
        <a className="brand" {...linkProps("/")}>
          Studens
        </a>
        <nav className="crumbs">
          <button type="button" onClick={() => navigate(APP_PREFIX)}>
            {t("app.modules")}
          </button>
          {active && (
            <>
              <span aria-hidden="true">/</span>
              <span className="here">{active.name}</span>
            </>
          )}
        </nav>
        <LanguageSwitcher route={route} />
        <Account />
      </header>

      {routeId && !active ? (
        <p className="error">
          {t("app.unknown", { id: routeId })}{" "}
          <button type="button" className="linkish" onClick={() => navigate(APP_PREFIX)}>
            {t("app.back")}
          </button>
        </p>
      ) : Module ? (
        <Module
          path={inside}
          navigate={(to) => navigate(`${APP_PREFIX}/${active!.id}${to === "/" ? "" : to}`)}
        />
      ) : (
        <Home />
      )}

      {/*
        Studens borrows the visual register of the institutions it serves, and a
        per-institution theme is planned. That makes it easy to mistake for an
        institutional product, and it is not one. Borrowing colours is ordinary;
        implying affiliation is not, so this line carries in words what a colour
        cannot. See docs/design/frontend-design.tex, section 2.

        The wording deliberately says nothing about what the modules do. The
        first draft said "the institutions whose courses it lists", which the
        FR-B16 gate rejected: that is RYC's domain, and it would be wrong the
        day MPA ships. The gate improved the copy.
      */}
      <footer className="app-footer">
        <nav>
          <a {...linkProps("/")}>{t("nav.home")}</a>
          <a {...linkProps("/confidentialite")}>{t("nav.privacy")}</a>
          <a {...linkProps("/a-propos")}>{t("nav.about")}</a>
        </nav>
        <p className="disclaimer">{t("foot.tagline")}</p>
      </footer>
    </main>
  );
}
