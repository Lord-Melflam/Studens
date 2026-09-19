/**
 * The screen a suspended account sees after signing in.
 *
 * WHY IT EXISTS. A suspended session was refused like any other failure, which
 * from the outside is indistinguishable from the site being down. A tester
 * said what anybody would conclude: the app is temporarily unreachable, try
 * again later. Somebody stopped from using a product is owed the reason, and
 * the moment to give it is the one where they have just proved who they are.
 *
 * WHAT IT SAYS, in this order: that it is a decision and not a fault; the
 * reason, in the words the moderator wrote; when it ends, or that it does not;
 * and where to write. Nothing else. A screen that also explained the rules, or
 * argued, would be a screen somebody reads as a lecture at the moment they are
 * least able to hear one.
 *
 * THE MOTION IS NOT DECORATION AND IS DELIBERATELY SMALL. It arrives once,
 * settles, and stops: enough that the screen reads as something that happened
 * rather than a page that failed to load, and not so much that it performs the
 * severity at somebody. Nothing loops, nothing pulses, and under
 * prefers-reduced-motion nothing moves at all.
 */
import { useEffect, useState } from "react";
import { useLocale, useT } from "@studens/i18n";
import { linkProps } from "../router.js";

interface Suspension {
  suspended: boolean;
  until: string | null;
  reason: string | null;
  contact: string | null;
}

export function Suspended() {
  const t = useT();
  const locale = useLocale();
  const [state, setState] = useState<Suspension | null>(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/suspension")
      .then((r) => (r.ok ? (r.json() as Promise<Suspension>) : null))
      .then((s) => {
        if (!live) return;
        setState(s);
        setAsked(true);
      })
      .catch(() => live && setAsked(true));
    return () => {
      live = false;
    };
  }, []);

  // Nothing known: somebody who typed this address, or whose notice expired.
  // It says so plainly rather than implying they are suspended.
  if (asked && (!state || !state.suspended)) {
    return (
      <section className="page-head">
        <h1>{t("suspended.none.title")}</h1>
        <p className="lede">{t("suspended.none.body")}</p>
        <p>
          <a className="cta" {...linkProps("/connexion")}>
            {t("suspended.none.signin")}
          </a>
        </p>
      </section>
    );
  }
  if (!state) return null;

  const until =
    state.until === null
      ? null
      : new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(state.until));

  return (
    <section className="suspended">
      <div className="suspended-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M14 34 34 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <h1>{t("suspended.title")}</h1>
      <p className="lede">{t("suspended.lede")}</p>

      {/* The moderator's own words, not a paraphrase. A reason rewritten by
          the interface is a reason nobody can be held to. */}
      {state.reason && (
        <div className="suspended-reason">
          <h2>{t("suspended.reason")}</h2>
          <p>{state.reason}</p>
        </div>
      )}

      <dl className="suspended-facts">
        <div>
          <dt>{t("suspended.until")}</dt>
          <dd>{until ?? t("suspended.until.permanent")}</dd>
        </div>
        {state.contact && (
          <div>
            <dt>{t("suspended.contact")}</dt>
            <dd>
              <a href={`mailto:${state.contact}`}>{state.contact}</a>
            </dd>
          </div>
        )}
      </dl>

      {/* Said plainly, because it is the question somebody actually has and
          the answer is not obvious: an anonymous contribution cannot be traced
          to an account (FR-C2), so a suspension cannot reach one either, in
          either direction. What was published stays published unless a
          moderator removes that piece on its own merits (FR-C10). */}
      <p className="hint">{t("suspended.published")}</p>
    </section>
  );
}
