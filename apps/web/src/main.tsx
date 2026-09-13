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
 * A member who has signed in but not finished the first run is sent to it when
 * they try to enter the app, and only then. The public site never redirects
 * (FR-F2): a public page must not require a session, so it must not require a
 * finished setup either. Someone can sign in, read the privacy page, close the
 * tab, and come back tomorrow.
 */
function Zone({ route }: { route: string }) {
  const { session } = useSession();

  // Both conditions test the session EXPLICITLY, never for falsiness: `null`
  // means the answer has not arrived, and treating that as "not signed in"
  // would bounce people out of the app for the half second before it does.
  const unfinished = isAppPath(route) && session?.signedIn === true && session.onboarded === false;
  const strayed = isFirstRunPath(route) && session !== null && !session.signedIn;

  useEffect(() => {
    if (unfinished) navigate(FIRST_RUN);
    else if (strayed) navigate("/connexion");
  }, [unfinished, strayed]);

  if (isFirstRunPath(route)) {
    // Signed out and standing in the wizard: there is nothing to set up.
    if (strayed) return null;
    return <FirstRun route={route} onDone={() => navigate(APP_PREFIX)} />;
  }

  if (isAppPath(route)) {
    if (unfinished) return null;
    return <Shell />;
  }

  return <PublicZone path={route} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("no #root element");
createRoot(root).render(
  <StrictMode>
    <Studens />
  </StrictMode>,
);
