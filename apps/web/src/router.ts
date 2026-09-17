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
import { DEFAULT_LOCALE, localePath, splitLocale, type Locale } from "@studens/i18n";

/** Everything below this prefix needs a session. Everything else is public. */
export const APP_PREFIX = "/app";

export function currentPath(): string {
  // Guarded so the router can be exercised outside a browser. A module that
  // throws on import under a test runner is a module nobody writes a test for.
  if (typeof window === "undefined") return "/";
  const p = window.location.pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/**
 * The query string, `?` and all, or "" when there is none.
 *
 * WHAT IT IS FOR, because a query string is easy to mistake for a preference
 * store. A screen's own settings belong in the URL: which filters are on, what
 * was typed in a search box. Those are part of what you are looking at, so
 * Back has to restore them, a refresh has to keep them, and a link has to
 * carry them to somebody else. Held in component state instead, all three
 * fail, and the third one silently: the link works and shows the wrong thing.
 *
 * WHAT IT IS NOT FOR. Anything the person has not published yet, above all the
 * text of a review being written. A URL is read by history, by the back
 * button's list, by whatever syncs bookmarks, and by anybody looking over a
 * shoulder. FR-C9 makes an anonymous contribution unlinkable to its author;
 * putting its draft in the address bar would undo that outside our database,
 * where nothing we do can take it back. Drafts stay in memory.
 *
 * The router never reads what is in here. It carries it (FR-B16).
 */
export function currentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

/**
 * Split a route that may carry a query string.
 *
 * `?` is not part of a path, and `splitLocale` and `localePath` both work on
 * paths: handing them `/app/ryc?f=algo` would put the language prefix in front
 * of a string they would then trim the wrong end of. So the split happens once,
 * here, and the two halves never meet again until the URL is written.
 */
export function splitQuery(route: string): { path: string; search: string } {
  const i = route.indexOf("?");
  if (i < 0) return { path: route, search: "" };
  return { path: route.slice(0, i) || "/", search: route.slice(i) };
}

/**
 * A module-relative route, turned into one the router can take.
 *
 * In the shell rather than in the module because the prefix is the shell's:
 * `/app/<id>` is where it decided to mount the module. It joins two strings and
 * reads neither, so the shell still does not know what a course is (FR-B16).
 *
 * The query string is split off first. Without that, the module's root with a
 * filter on it (`/?f=algo`) fails the `to === "/"` test and produces
 * `/app/ryc/?f=algo`, a path with a trailing slash that no longer equals the
 * one the module is mounted at.
 */
export function moduleRoute(prefix: string, inner: string): string {
  const { path, search } = splitQuery(inner);
  const clean = path === "/" ? "" : path;
  return `${prefix}${clean}${search}`;
}

/**
 * The path with its language taken off: `/nl/a-propos` becomes `/a-propos`.
 *
 * Everything downstream matches on this, so no component has to know that a
 * prefix exists. Adding a fourth language changes no route.
 */
export function currentRoute(path: string = currentPath()): string {
  return splitLocale(path).rest;
}

export function currentLocale(path: string = currentPath()): Locale {
  return splitLocale(path).locale ?? DEFAULT_LOCALE;
}

/**
 * Both of these take EITHER form: `/fr/app/ryc` or `/app/ryc`.
 *
 * They strip the language themselves rather than trusting the caller to have
 * done it. That is not defensive style, it is a bug that shipped: when the
 * locale prefix was introduced, `Shell` kept passing the raw
 * `window.location.pathname`, so `isAppPath("/fr/app/ryc")` was false, the
 * module id came back null, and clicking a module changed the URL while the
 * screen stayed on the home list. Nothing caught it, because every test called
 * these with paths that had already been stripped.
 *
 * Stripping is idempotent, so a caller that already stripped loses nothing.
 */
export function isAppPath(path: string = currentPath()): boolean {
  const route = currentRoute(path);
  return route === APP_PREFIX || route.startsWith(`${APP_PREFIX}/`);
}

/** The module id inside /app, or null for the app's own home screen. */
export function moduleIdFrom(path: string = currentPath()): string | null {
  const route = currentRoute(path);
  if (!isAppPath(route)) return null;
  const rest = route.slice(APP_PREFIX.length).replace(/^\//, "");
  return rest.split("/")[0] || null;
}

/**
 * The URL a route becomes, in a given language.
 *
 * Split out of `navigate` because it is the part that can be wrong and the part
 * `navigate` cannot be tested for: `navigate` writes to `window.history`, and
 * these tests run in node. The language prefix goes in front of the path and
 * the query string stays behind it, which is the thing to get wrong.
 */
export function navigationTarget(route: string, locale: Locale): string {
  const { path, search } = splitQuery(route);
  return localePath(path, locale) + search;
}

/**
 * Navigate within the current language. Takes an unprefixed route, which may
 * carry a query string.
 *
 * `replace` IS THE WHOLE REASON THIS TAKES OPTIONS, and it is not a detail.
 * Going somewhere is a history entry; changing what you are looking at is not.
 * Pressing six filter chips pushes six entries, so Back walks backwards through
 * your own filtering instead of leaving the screen, which is worse than losing
 * the filters was. Navigation pushes, a screen's own settings replace.
 *
 * Replacing also does not scroll. Scrolling to the top is right when the screen
 * changes and wrong when a chip was pressed halfway down a list of 173 courses.
 */
export function navigate(
  route: string,
  opts: { locale?: Locale; replace?: boolean } = {},
): void {
  const target = navigationTarget(route, opts.locale ?? currentLocale());
  if (target === currentPath() + currentSearch()) return;
  if (opts.replace) window.history.replaceState({}, "", target);
  else window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (!opts.replace) window.scrollTo(0, 0);
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

/** The query string, re-read whenever it changes. Separate from usePath so a
    screen that does not use one does not re-render when another screen's
    settings change. */
export function useSearch(): string {
  const [search, setSearch] = useState(currentSearch);
  useEffect(() => {
    const onChange = (): void => setSearch(currentSearch());
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return search;
}

/**
 * An internal link.
 *
 * A real `<a href>`, so it can be opened in a new tab, copied, and read by a
 * crawler. The click handler only takes over the ordinary case: a plain left
 * click with no modifier, which is the one where a full page load would be
 * wasteful.
 */
export function linkProps(
  to: string,
  locale?: Locale,
): {
  href: string;
  onClick: (e: React.MouseEvent) => void;
} {
  const { path, search } = splitQuery(to);
  const target = localePath(path, locale ?? currentLocale()) + search;
  return {
    href: target,
    onClick: (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to, { locale });
    },
  };
}
