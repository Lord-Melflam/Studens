/**
 * Putting a screen's own settings in the address bar, and taking them out again.
 *
 * THE RULE, and it is the module's not this file's: what you are looking at
 * goes in the URL. The course, the programme and the screen already did;
 * filters and the search box did not, so opening a course and pressing Back
 * lost them. Three things fail when a setting is held in component state, and
 * the third fails quietly: Back cannot restore what was never written down, a
 * refresh cannot either, and a link to a filtered list shows its reader a
 * different list.
 *
 * WHAT STAYS OUT. Anything not published yet, and the text of a review above
 * all. Browser history, bookmark sync and whoever is looking at the screen all
 * read a URL, and FR-C9's promise about an anonymous contribution cannot reach
 * any of them. A draft lives in memory and dies there.
 *
 * Three small functions and no hook. There is no state here to keep in step:
 * the settings are derived from the URL on every render, and changing them is
 * a navigation. A hook would exist only to hold a copy, and a copy is the bug.
 */

/** Parse what the shell handed over. `?` and all, or "". */
export function queryOf(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

/** A route with its query string, or without one when there is nothing to say. */
export function withQuery(path: string, params: URLSearchParams): string {
  const q = params.toString();
  return q === "" ? path : `${path}?${q}`;
}

/**
 * Replace exactly the parameters one codec owns, and leave every other one
 * alone.
 *
 * The search screen carries `q`, the question asked of the server, and the
 * filter over its results carries `f` and the rest. Writing the filter by
 * handing over a whole new query string would drop `q` and empty the screen the
 * filter was narrowing. So a codec declares its keys and only those move.
 */
export function replaceKeys(
  current: URLSearchParams,
  owned: readonly string[],
  next: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of current.entries()) {
    if (!owned.includes(k)) out.append(k, v);
  }
  for (const [k, v] of next.entries()) out.append(k, v);
  return out;
}

/**
 * The route to navigate to when a screen's settings change.
 *
 * One function so the two filter bars cannot drift, and so the composition is
 * testable without a browser: everything about writing a setting is here, and
 * the components only decide when to call it.
 *
 * ALWAYS PAIRED WITH `replace`, at the call site. Pressing a chip is not going
 * anywhere. Six chips as six history entries turns Back into a walk back
 * through your own filtering, which is worse than losing the filters was.
 */
export function settingsRoute(
  here: string,
  search: string,
  owned: readonly string[],
  next: URLSearchParams,
): string {
  return withQuery(here, replaceKeys(queryOf(search), owned, next));
}
