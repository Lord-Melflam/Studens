/**
 * The entry point, and the only place that decides zone and language.
 *
 * THE LANGUAGE IS IN THE PATH. A visitor arriving at `/` with no prefix is
 * sent to the one their browser asks for, and from then on the URL says which
 * language it is, so the link can be shared and will look the same to whoever
 * opens it. See docs/design/internationalisation.md.
 */
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, localePath, preferredLocale, splitLocale } from "@studens/i18n";
import { Shell } from "./shell/Shell.js";
import { PublicZone } from "./public/index.js";
import { bundle } from "./bundle.js";
import { APP_PREFIX, currentRoute, isAppPath, navigate, usePath } from "./router.js";
import { SessionProvider, useSession } from "./session.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FIRST_RUN, FirstRun, isFirstRunPath } from "./firstrun/FirstRun.js";
import "./shell.css";
import "./public/public.css";
import "./firstrun/firstrun.css";

function Studens() {
  const path = usePath();
  const { locale } = splitLocale(path);
  const route = currentRoute(path);

  // No prefix: choose one and replace the entry in history, so Back does not
  // bounce the visitor straight out again.
  //
  // In an effect, not during render. Changing the history entry dispatches the
  // event `usePath` listens to, and doing that while React is rendering is a
  // state update from inside a render pass, which React is right to complain
  // about. Nothing else changes: this rendered null before, and it still does.
  useEffect(() => {
    if (locale !== null) return;
    const chosen = preferredLocale(navigator.languages ?? [navigator.language]);
    window.history.replaceState({}, "", localePath(route, chosen) + window.location.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [locale, route]);

  if (locale === null) return null;

  return (
    <I18nProvider locale={locale} bundle={bundle}>
      <SessionProvider>
        <Zone route={route} />
      </SessionProvider>
    </I18nProvider>
  );
}

/**
 * Three zones, and the one rule that connects them.
 *
 * A member who has NEVER OPENED the first run is sent to it the first time they
 * enter the app (FR-F4). Anyone who has opened it once, even only to press
 * "later", goes straight into the app and is prompted there instead.
 *
 * THE FIRST VERSION DIVERTED ON `onboarded === false` AND WAS A TRAP. Every
 * /app route bounced to the wizard, the only visible way out of the wizard went
 * to the public home, and the public home's way in went to /app, which bounced
 * again. There was no route into the product that did not pass through
 * finishing the setup, and nothing on screen said so: clicking a module simply
 * put you somewhere else. That contradicts the reasoning FR-F6 is built on, in
 * its own words, that a first run which cannot be escaped is a first run people
 * lie to.
 *
 * The public site never redirects at all (FR-F2): a public page must not
 * require a session, so it must not require a finished setup either.
 */
function Zone({ route }: { route: string }) {
  const { session } = useSession();

  // Tested EXPLICITLY, never for falsiness: `null` means the answer has not
  // arrived, and treating that as "not signed in" would bounce people out of
  // the app for the half second before it does.
  const neverOpened =
    session?.signedIn === true && session.onboarded === false && session.onboardingStep === 0;
  const divert = isAppPath(route) && neverOpened;
  const strayed = isFirstRunPath(route) && session !== null && !session.signedIn;

  useEffect(() => {
    if (divert) {
      // Remember what they asked for, so finishing lands them there rather
      // than at the app's front door. Without this, clicking a module and
      // completing the setup drops you somewhere you did not ask to be.
      rememberDestination(route);
      navigate(FIRST_RUN);
    } else if (strayed) {
      navigate("/connexion");
    }
  }, [divert, strayed, route]);

  if (isFirstRunPath(route)) {
    // Signed out and standing in the wizard: there is nothing to set up.
    if (strayed) return null;
    return <FirstRun route={route} onDone={() => navigate(takeDestination())} />;
  }

  if (isAppPath(route)) {
    if (divert) return null;
    return <Shell />;
  }

  return <PublicZone path={route} />;
}

/**
 * Where to go once the first run is done.
 *
 * `sessionStorage` because the wizard is resumable and a reload must not lose
 * it, and because it is per tab: two tabs setting up at once should not fight.
 * Every access is guarded, since a private window or blocked site data makes
 * these throw rather than return nothing, and the fallback is simply the app's
 * front door.
 */
const DESTINATION = "studens.after-first-run";

function rememberDestination(route: string): void {
  try {
    sessionStorage.setItem(DESTINATION, route);
  } catch {
    // A convenience, never a requirement.
  }
}

function takeDestination(): string {
  try {
    const saved = sessionStorage.getItem(DESTINATION);
    sessionStorage.removeItem(DESTINATION);
    // Only ever an app path, so a stale or tampered value cannot send somebody
    // to another site or out of the zone they just set themselves up for.
    if (saved && isAppPath(saved)) return saved;
  } catch {
    // Fall through to the default.
  }
  return APP_PREFIX;
}

const root = document.getElementById("root");
if (!root) throw new Error("no #root element");
createRoot(root).render(
  <StrictMode>
    {/* Outside everything, so it survives a failure in the translator, the
        session, the router or any module. A blank page is not an error
        message. */}
    <ErrorBoundary>
      <Studens />
    </ErrorBoundary>
  </StrictMode>,
);
