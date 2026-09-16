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
import { useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { Account } from "../Account.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { Settings } from "../Settings.js";
import { activeModuleFor, liveModules } from "./registry.js";
import { useSession } from "../session.js";
import { FIRST_RUN } from "../firstrun/FirstRun.js";
import { ModerationConsole } from "../moderation/Console.js";
import { fetchPowers, type Powers } from "../moderation/api.js";
import { APP_PREFIX, currentRoute, linkProps, moduleIdFrom, navigate, usePath } from "../router.js";

/**
 * The shell's own screen, reachable at /app/moi.
 *
 * A reserved segment: no module may claim it. There is one today and the
 * registry is where a collision would be caught, since a module declaring this
 * id would simply never mount.
 */
const SETTINGS = "moi";

/**
 * The moderator's console. Reserved like the account panel: no module may claim
 * this id, and one declaring it would simply never mount.
 *
 * Moderation is the platform's rather than a module's, because it acts on any
 * module's content through a kind and an id (FR-E8). A console inside RYC would
 * have to be built again for the second module.
 */
const MODERATION = "moderation";

function Home() {
  const t = useT();
  return (
    <>
      <header className="page-intro">
        <h2>{t("app.home.title")}</h2>
        <p className="lede">{t("app.home.lede")}</p>
      </header>

      {/*
        Cards rather than a list of buttons. A module is a place you go and
        spend time in, and a single-line row reads like a menu item. What each
        one is for comes from the module (FR-B16), as everywhere else.
      */}
      <ul className="modules">
        {liveModules.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => navigate(`${APP_PREFIX}/${m.id}`)}>
              <span className="name">{m.name}</span>
              <span className="summary">{m.summary}</span>
              <span className="go" aria-hidden="true">
                {t("app.open")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="footnote">{t("app.home.more")}</p>
    </>
  );
}

/**
 * A standing reminder that the first run is not finished.
 *
 * The counterpart to letting somebody skip it: once the app stops forcing the
 * setup, the setup has to stay visible or it is simply lost, and a member who
 * never chose a username publishes under no name at all.
 *
 * A line, not a modal. It is a reminder about their own account, not an
 * obstacle, and it disappears the moment the setup is done.
 */
function SetupPrompt() {
  const t = useT();
  const { session } = useSession();
  if (!session?.signedIn || session.onboarded !== false) return null;
  return (
    <p className="setup-prompt">
      <span>{t("app.setup.prompt")}</span>
      <a {...linkProps(FIRST_RUN)}>{t("app.setup.go")}</a>
    </p>
  );
}

export function Shell() {
  const t = useT();
  const path = usePath();
  // Asked once per mount. The API answers for everybody, including members, so
  // the shell can decide what to draw rather than making somebody guess a URL.
  const [powers, setPowers] = useState<Powers | null>(null);
  useEffect(() => {
    void fetchPowers().then(setPowers);
  }, []);
  const route = currentRoute(path);
  const routeId = moduleIdFrom(path);
  const active = activeModuleFor(path);
  const Module = active?.component;

  // The shell's own screens sit alongside the modules and are not modules:
  // they are about the member, not about anything a module owns.
  const settings = routeId === SETTINGS;
  const moderating = routeId === MODERATION;

  // Everything below /app/<id> belongs to the module. Sliced here, never read.
  const inside = active ? route.slice(`${APP_PREFIX}/${active.id}`.length) || "/" : "/";

  return (
    <main className="app">
      <header className="app-bar">
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
          {(active || settings || moderating) && (
            <>
              <span aria-hidden="true">/</span>
              <span className="here">
                {active ? active.name : moderating ? t("mod.title") : t("settings.title")}
              </span>
            </>
          )}
        </nav>
        <div className="app-bar-right">
          <LanguageSwitcher route={route} />
          {/* Only where there is one. A link to a console somebody cannot open
              is a link that teaches them the console exists. */}
          {powers?.canModerate && (
            <a className="settings-link" {...linkProps(`${APP_PREFIX}/${MODERATION}`)}>
              {t("mod.title")}
            </a>
          )}
          <a className="settings-link" {...linkProps(`${APP_PREFIX}/${SETTINGS}`)}>
            {t("settings.title")}
          </a>
          <Account />
        </div>
      </header>

      <SetupPrompt />

      <div className="app-body">
      {settings ? (
        <Settings />
      ) : moderating ? (
        // Rendered only where the power exists. Somebody typing the URL without
        // it gets the unknown-screen message, and the API answers 404 to every
        // request behind it anyway, so nothing here is the only guard.
        powers?.canModerate ? (
          <ModerationConsole canAppoint={powers.canAppoint} />
        ) : (
          <p className="error">{t("app.unknown", { id: MODERATION })}</p>
        )
      ) : routeId && !active ? (
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
      </div>

      {/*
        Studens borrows the visual register of the institutions it serves, and a
        per-institution theme is planned. That makes it easy to mistake for an
        institutional product, and it is not one. Borrowing colours is ordinary;
        implying affiliation is not, so this line carries in words what a colour
        cannot. See docs/typeset/frontend-design.tex, section 2.

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
