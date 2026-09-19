/**
 * Light, dark, or whatever the device says.
 *
 * NOT IN THE URL, and that is a deliberate exception to FR-B21. What is on
 * screen goes in the address so a link shows its reader the same screen; a
 * colour scheme is a property of the reader's eyes and their device, not of
 * the page, and a link that forced dark on somebody would be the rule doing
 * the opposite of its job.
 *
 * NOT ON THE PROFILE EITHER. A phone at night and a laptop in a library want
 * different answers from the same person, so this is per device. It also means
 * a visitor with no account gets it, which a profile field could never do.
 *
 * `localStorage` can throw: Safari in private mode, and any browser with site
 * data blocked. Every read and write is guarded, and the fallback is to follow
 * the system, which is the right answer when we know nothing.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "studens.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/**
 * Apply it to the document.
 *
 * "system" REMOVES the attribute rather than writing a value, so the media
 * query in shell.css decides and keeps deciding: somebody who follows their
 * system and changes it at sunset sees the page change with it, without
 * reloading and without us listening for anything.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // A preference that cannot be stored still applies to this page.
  }
}
