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
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "../ThemeToggle.js";
import { Brand } from "../Brand.js";
import { localePath, useT, type Locale } from "@studens/i18n";
import { Account } from "../Account.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { Settings } from "../Settings.js";
import { activeModuleFor, presentModules } from "./registry.js";
import { useSession } from "../session.js";
import { FIRST_RUN } from "../firstrun/FirstRun.js";
import { ModerationConsole } from "../moderation/Console.js";
import { fetchPowers, type Powers } from "../moderation/api.js";
import {
  APP_PREFIX,
  currentLocale,
  currentRoute,
  linkProps,
  moduleIdFrom,
  moduleRoute,
  navigate,
  usePath,
  useSearch,
} from "../router.js";

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

/**
 * Where signing out lands. The public home, from anywhere.
 *
 * IT USED TO STAY PUT, and to land on `/app` when the screen it was done from
 * only existed for somebody signed in. François: "be careful that logging out
 * should let us in the app as it's doing rn, otherwise someone might still be
 * using our app when logged out". He is right, and the cost is not only
 * appearances. A course page is public, so staying on one after signing out
 * looked exactly like signing out had failed: same screen, same content, and
 * the only difference a sign-in button somewhere in the corner. On a shared
 * laptop that is the person who thinks they have left and has not checked.
 *
 * `/app` was no better. It is the application, which is the thing being left.
 *
 * So: out means out, to the public home in the reader's language. Coming back
 * in is one click, and the one click is the point.
 *
 * SIGNING OUT IS A FULL PAGE LOAD, not a state change, which is why this is a
 * decision taken before leaving rather than a redirect taken after arriving.
 * The page comes back fresh with nobody signed in, so a screen that only
 * exists for somebody signed in cannot get out of its own way by reacting to
 * the session: it never sees the change. That is how signing out of the
 * console kept answering "Unknown module".
 *
 * A pure function, and exported, because the version of this written inline
 * was wrong and nothing could reach it to say so.
 */
export function signOutDestination(_routeId: string | null, locale: Locale): string {
  return localePath("", locale);
}

function Home() {
  const t = useT();
  // Presented, not raw. The registration carries a French summary as its
  // fallback and this screen was printing it verbatim, so an English page said
  // "Ce que valent vraiment les cours". `presentModules` resolves each module's
  // own strings in the active language, which is what the public zone already
  // did and what this screen should have done from the start.
  const shown = presentModules(t);
  const live = shown.filter((m) => m.presentation.status === "live");
  const planned = shown.filter((m) => m.presentation.status !== "live");

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
        {live.map((m) => (
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

      {/*
        What is announced but not built, kept visibly apart from what can be
        opened. NOT a greyed-out card: a card you cannot press is the thing the
        design note's first principle refuses. It is a different shape, it says
        what it is and why it is listed, and it offers nothing to click.

        The public site already announces this module, so leaving it out here
        would mean the two pages disagree about what Studens is.
      */}
      {planned.length > 0 && (
        <section className="planned">
          <h3>{t("app.home.planned")}</h3>
          <ul>
            {planned.map((m) => (
              <li key={m.id}>
                <span className="name">{m.name}</span>
                <span className="summary">{m.summary}</span>
                {m.presentation.statusNote && (
                  <span className="note">{m.presentation.statusNote}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
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
  /**
   * TWO SENTENCES, BECAUSE THERE ARE TWO SITUATIONS AND ONE OF THEM WAS BEING
   * TOLD SOMETHING FALSE.
   *
   * "Not onboarded" is a general state. "You have no username yet" is a
   * specific claim, and it is wrong for anybody who pressed "redo the setup"
   * from their account: that deliberately clears `onboardedAt`, so somebody
   * cannot wander out of the wizard half-answered, and the banner then told a
   * member with a perfectly good username that they had none. François hit it
   * on an account that only wanted to change its language.
   *
   * The session already carries the username, so the banner can say the thing
   * that is true rather than the thing that is usually true.
   */
  const started = session.username !== null && session.username !== undefined;
  return (
    <p className="setup-prompt">
      <span>{t(started ? "app.setup.resume" : "app.setup.prompt")}</span>
      <a {...linkProps(FIRST_RUN)}>{t("app.setup.go")}</a>
    </p>
  );
}

export function Shell() {
  const t = useT();
  const path = usePath();
  // Carried, never read. What the parameters mean is the module's business.
  const search = useSearch();
  const { session } = useSession();
  // Asked again whenever the session changes, not once per mount. The answer is
  // about who is signed in, so it stops being true the moment that does: asking
  // once meant signing in did not reveal the console until a reload, and
  // signing out left the link to it on screen.
  const [powers, setPowers] = useState<Powers | null>(null);
  useEffect(() => {
    if (session === null) return;
    if (!session.signedIn) {
      setPowers({ canModerate: false, canAppoint: false });
      return;
    }
    void fetchPowers().then(setPowers);
  }, [session]);
  const route = currentRoute(path);
  const locale = currentLocale(path);
  const routeId = moduleIdFrom(path);
  const active = activeModuleFor(path);
  const Module = active?.component;

  // The shell's own screens sit alongside the modules and are not modules:
  // they are about the member, not about anything a module owns.
  const settings = routeId === SETTINGS;
  const moderating = routeId === MODERATION;
  // Whether the console is actually being shown, which is not the same as being
  // on its URL. The breadcrumb used the second and so printed "Moderation" over
  // a body saying the id was unknown: two answers to the same question, and the
  // pair tells somebody without the power that the segment is reserved.
  const console_ = moderating && powers?.canModerate === true;

  // Signing out of a screen that only exists for somebody signed in leaves you
  // standing on it. Before this, signing out of the console kept the URL and
  // answered "Unknown module: moderation", which is the message meant for a
  // stranger guessing the address, shown to the person who had just been using
  // it. Leaving is the only sensible reading of signing out from there.
  //
  // ON THE TRANSITION, never on arrival. Somebody who simply opens the console's
  // URL without the power has to get exactly what any unknown id gets, or the
  // difference between the two answers tells them the segment is reserved and
  // undoes the reason the API answers 404 rather than 403.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (session?.signedIn) {
      wasSignedIn.current = true;
      return;
    }
    if (session && !session.signedIn && wasSignedIn.current && (moderating || settings)) {
      wasSignedIn.current = false;
      navigate(APP_PREFIX);
    }
  }, [session, moderating, settings]);

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
          <Brand />
        </a>
        <nav className="crumbs">
          <button type="button" onClick={() => navigate(APP_PREFIX)}>
            {t("app.modules")}
          </button>
          {(active || settings || console_) && (
            <>
              <span aria-hidden="true">/</span>
              <span className="here">
                {active ? active.name : console_ ? t("mod.title") : t("settings.title")}
              </span>
            </>
          )}
        </nav>
        <div className="app-bar-right">
          <LanguageSwitcher route={route} />
          <ThemeToggle />
          {/* Only where there is one. A link to a console somebody cannot open
              is a link that teaches them the console exists. */}
          {powers?.canModerate && (
            <a
              /* WHERE YOU ARE, SHOWN. The link changed colour on hover and
                 nowhere else, so standing on the console looked the same as
                 standing anywhere. `aria-current` says it to a screen reader
                 and the class says it to everybody else. */
              className={routeId === MODERATION ? "settings-link here" : "settings-link"}
              aria-current={routeId === MODERATION ? "page" : undefined}
              {...linkProps(`${APP_PREFIX}/${MODERATION}`)}
            >
              {t("mod.title")}
            </a>
          )}
          {/* An account screen is no use without an account, and offering it to
              somebody signed out sends them to a page that can only fail. */}
          {session?.signedIn && (
            <a
              className={routeId === SETTINGS ? "settings-link here" : "settings-link"}
              aria-current={routeId === SETTINGS ? "page" : undefined}
              {...linkProps(`${APP_PREFIX}/${SETTINGS}`)}
            >
              {t("settings.title")}
            </a>
          )}
          {/* The account panel and the console do not survive signing out, so
              signing out leaves them. Everything else stays where it is. */}
          <Account signOutTo={signOutDestination(routeId, locale)} />
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
          search={search}
          navigate={(to, opts) => navigate(moduleRoute(`${APP_PREFIX}/${active!.id}`, to), opts)}
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
