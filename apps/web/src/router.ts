/**
 * Routing across the three zones.
 *
 * PATHS, not hashes. The previous router put the module id after a `#`, which
 * was fine while everything sat behind a sign-in: nobody shares a link to an
 * authenticated screen. A public page is the opposite. `studens.be/a-propos`
 * is a link somebody sends to a friend; `studens.be/#/a-propos` is a link that
 * looks like a mistake, and a crawler treats everything after the `#` as the
 * same page.
 *
 * COST, and it is a real one: the server must answer every unknown path with
 * index.html, or a refresh on /a-propos is a 404. Vite's dev server does this
 * by default. Production does not have it yet, and it is written down in
 * design/information-architecture.md as part of deploying.
 *
 * Twelve lines and no dependency, for the same reason as before: react-router
 * is a decision nothing here yet justifies, and if routing inside a module ever
 * gets complicated the change is contained to this file, because no module
 * imports it.
 */
import { useEffect, useState } from "react";

/** Everything below this prefix needs a session. Everything else is public. */
export const APP_PREFIX = "/app";

export function currentPath(): string {
  // Guarded so the router can be exercised outside a browser. A module that
  // throws on import in a test harness is a module nobody writes a test for.
  if (typeof window === "undefined") return "/";
  const p = window.location.pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

export function isAppPath(path: string = currentPath()): boolean {
  return path === APP_PREFIX || path.startsWith(`${APP_PREFIX}/`);
}

/** The module id inside /app, or null for the app's own home screen. */
export function moduleIdFrom(path: string = currentPath()): string | null {
  if (!isAppPath(path)) return null;
  const rest = path.slice(APP_PREFIX.length).replace(/^\//, "");
  return rest.split("/")[0] || null;
}

export function navigate(path: string): void {
  if (path === currentPath()) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = (): void => setPath(currentPath());
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return path;
}

/**
 * An internal link.
 *
 * A real `<a href>`, so it can be opened in a new tab, copied, and read by a
 * crawler. The click handler only takes over the ordinary case: a plain left
 * click with no modifier, which is the one where a full page load would be
 * wasteful.
 */
export function linkProps(to: string): {
  href: string;
  onClick: (e: React.MouseEvent) => void;
} {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
