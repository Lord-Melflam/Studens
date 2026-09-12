/**
 * The entry point, and the only place that decides zone and language.
 *
 * THE LANGUAGE IS IN THE PATH. A visitor arriving at `/` with no prefix is
 * sent to the one their browser asks for, and from then on the URL says which
 * language it is, so the link can be shared and will look the same to whoever
 * opens it. See docs/design/internationalisation.md.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, localePath, preferredLocale, splitLocale } from "@studens/i18n";
import { Shell } from "./shell/Shell.js";
import { PublicZone } from "./public/index.js";
import { bundle } from "./bundle.js";
import { currentRoute, isAppPath, usePath } from "./router.js";
import "./shell.css";
import "./public/public.css";

function Studens() {
  const path = usePath();
  const { locale } = splitLocale(path);
  const route = currentRoute(path);

  // No prefix: choose one and replace the entry in history, so Back does not
  // bounce the visitor straight out again.
  if (locale === null) {
    const chosen = preferredLocale(navigator.languages ?? [navigator.language]);
    window.history.replaceState({}, "", localePath(route, chosen) + window.location.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return null;
  }

  return (
    <I18nProvider locale={locale} bundle={bundle}>
      {isAppPath(route) ? <Shell /> : <PublicZone path={route} />}
    </I18nProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("no #root element");
createRoot(root).render(
  <StrictMode>
    <Studens />
  </StrictMode>,
);
