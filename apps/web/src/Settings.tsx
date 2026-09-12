/**
 * The account panel, at /app/moi.
 *
 * Platform level, not a module: it is about the member, not about anything a
 * module owns, so it lives in the shell's zone and mentions no module's domain
 * (FR-B16).
 *
 * WHAT IT DELIBERATELY DOES NOT HAVE. There is no username field and no
 * institution picker, because neither exists yet: `Member` has no column for
 * either, and the first run that would collect them (FR-F4 to FR-F14) is not
 * built. A settings screen with inputs that save nowhere is worse than one that
 * says what is missing, which is the same rule the fork screen is held to
 * (FR-D28).
 */
import { useCallback, useEffect, useState } from "react";
import { LOCALES, LOCALE_NAMES, localePath, useLocale, useT } from "@studens/i18n";
import { currentRoute, linkProps } from "./router.js";

interface SessionInfo {
  signedIn: boolean;
  emailDomain?: string;
  role?: string;
}

interface LiveSession {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  current: boolean;
}

function when(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function Settings() {
  const t = useT();
  const locale = useLocale();
  const [me, setMe] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/session")
      .then((r) => (r.ok ? (r.json() as Promise<SessionInfo>) : null))
      .then(setMe)
      .catch(() => setMe(null));
    fetch("/api/sessions")
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: LiveSession[] }>) : null))
      .then((d) => setSessions(d?.sessions ?? null))
      .catch(() => setSessions(null));
  }, []);

  useEffect(load, [load]);

  async function revoke(id: string, isCurrent: boolean) {
    setBusy(id);
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      // Revoking the one you are using signs you out, so there is nothing left
      // to show: go back to the public site rather than to an empty panel.
      if (isCurrent) window.location.assign("/");
      else load();
    } finally {
      setBusy(null);
    }
  }

  if (me && !me.signedIn) {
    return (
      <section className="panel">
        <p className="lede">{t("settings.signedout")}</p>
        <a className="cta" {...linkProps("/connexion")}>
          {t("nav.signin")}
        </a>
      </section>
    );
  }

  return (
    <div className="panel-stack">
      <h2 className="panel-title">{t("settings.title")}</h2>

      <section className="panel">
        <h3>{t("settings.account")}</h3>
        <dl className="rows">
          <div>
            <dt>{t("settings.domain")}</dt>
            <dd>
              <code>{me?.emailDomain ?? "…"}</code>
              {/* FR-A10: evidence of holding an address at a domain, and never
                  presented as proof of enrolment. Said here, not implied. */}
              <span className="hint">{t("settings.domain.hint")}</span>
            </dd>
          </div>
          <div>
            <dt>{t("settings.stored")}</dt>
            <dd>
              {t("settings.stored.value")}
              <span className="hint">{t("settings.stored.hint")}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3>{t("settings.language")}</h3>
        <p className="hint">{t("settings.language.hint")}</p>
        <div className="choice-row">
          {LOCALES.map((l) => (
            <a
              key={l}
              className={l === locale ? "choice on" : "choice"}
              href={localePath(currentRoute(), l)}
              lang={l}
            >
              {LOCALE_NAMES[l]}
            </a>
          ))}
        </div>
      </section>

      {/* FR-A5. The API has had this since the session layer; nothing showed it. */}
      <section className="panel">
        <h3>{t("settings.sessions")}</h3>
        <p className="hint">{t("settings.sessions.hint")}</p>
        {sessions === null ? (
          <p className="hint">…</p>
        ) : (
          <ul className="sessions">
            {sessions.map((s) => (
              <li key={s.id} className={s.current ? "current" : ""}>
                <div>
                  <strong>
                    {s.current ? t("settings.sessions.this") : t("settings.sessions.other")}
                  </strong>
                  <span className="hint">
                    {t("settings.sessions.since", { when: when(s.startedAt, locale) })}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy === s.id}
                  onClick={() => void revoke(s.id, s.current)}
                >
                  {s.current ? t("settings.sessions.endthis") : t("settings.sessions.end")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Named, not mocked up. Everything above is real; these are not built, and
        a disabled input that looks like a setting is a promise the product has
        not made (FR-D28, and LESSONS on copy taken from a design document).
      */}
      <section className="panel muted">
        <h3>{t("settings.soon")}</h3>
        <ul className="plain">
          <li>{t("settings.soon.username")}</li>
          <li>{t("settings.soon.institution")}</li>
          <li>{t("settings.soon.contributions")}</li>
        </ul>
      </section>
    </div>
  );
}
