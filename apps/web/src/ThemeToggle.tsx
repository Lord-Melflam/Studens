/**
 * The scheme, in the header, in every zone.
 *
 * It lived only on the account panel, which meant a visitor reading the public
 * pages at night could not reach it at all, and somebody with an account had
 * to know it was there. Somebody went looking for it and did not find it,
 * which is the whole argument.
 *
 * ONE BUTTON, TWO STATES, and "follow the device" is not one of them. Most
 * people want the opposite of what they are looking at; the third choice is
 * the default until somebody touches it, and going back to it is on the
 * account panel where there is room to say what it means. A three way control
 * in a header is either three buttons nobody reads or one button that cycles,
 * and a cycling button gives no idea what the next press does.
 *
 * It shows the scheme it will SWITCH TO, which is what a person about to press
 * it wants to know, and the label says so in words for anybody who cannot see
 * the icon.
 */
import { useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { applyTheme, readTheme } from "./theme.js";

/** What is on screen right now, resolving "system" against the device. */
function effective(): "light" | "dark" {
  const chosen = readTheme();
  if (chosen !== "system") return chosen;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeToggle() {
  const t = useT();
  const [now, setNow] = useState<"light" | "dark">(() => effective());

  /**
   * Follow the device while nobody has chosen, so a page open at sunset
   * changes with the system rather than going stale until a reload.
   */
  useEffect(() => {
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (): void => setNow(effective());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const next = now === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        applyTheme(next);
        setNow(next);
      }}
      title={t(`theme.to.${next}`)}
      aria-label={t(`theme.to.${next}`)}
    >
      {next === "dark" ? (
        /* A moon, for going dark. */
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M16 12.3A6.8 6.8 0 0 1 7.7 4a6.8 6.8 0 1 0 8.3 8.3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* A sun, for coming back. */
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4" />
          </g>
        </svg>
      )}
    </button>
  );
}
