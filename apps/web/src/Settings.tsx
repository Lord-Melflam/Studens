/**
 * The account panel, at /app/moi.
 *
 * Platform level, not a module: it is about the member, not about anything a
 * module owns, so it lives in the shell's zone and mentions no module's domain
 * (FR-B16).
 *
 * The username is editable here and the rest of the profile is not. That is not
 * laziness: FR-F14 makes the first run replayable by anyone, so the screens that
 * collect studies and institution already exist and already explain themselves.
 * Rebuilding those questions here would mean two places to keep honest, and the
 * second one always drifts.
 *
 * What is listed as missing is listed in words, not mocked up as a disabled
 * input. A control that looks like a setting is a promise the product has not
 * made (FR-D28).
 */
import { useCallback, useEffect, useState } from "react";
import { LOCALES, LOCALE_NAMES, localePath, useLocale, useT } from "@studens/i18n";
import { currentRoute, linkProps, navigate } from "./router.js";
import { useSession } from "./session.js";
import {
  PatchFailed,
  fetchInstitutions,
  fetchProfile,
  patchProfile,
  type Institution,
  type Profile,
  type UsernameProblem,
} from "./firstrun/profile.js";
import { FIRST_RUN } from "./firstrun/FirstRun.js";

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
  const { session: me, reload: reloadSession } = useSession();
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [name, setName] = useState("");
  const [nameProblem, setNameProblem] = useState<UsernameProblem | "other" | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const load = useCallback(() => {
    void (async () => {
      const p = await fetchProfile();
      if (p) {
        setProfile(p);
        setName(p.username ?? "");
      }
      setInstitutions(await fetchInstitutions());
    })();
    fetch("/api/sessions")
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: LiveSession[] }>) : null))
      .then((d) => setSessions(d?.sessions ?? null))
      .catch(() => setSessions(null));
  }, []);

  async function saveName() {
    setBusy("username");
    setNameProblem(null);
    setNameSaved(false);
    try {
      const saved = await patchProfile({ username: name });
      setProfile(saved);
      setNameSaved(true);
      // The header shows the name, and it lives in the session answer.
      reloadSession();
    } catch (err) {
      setNameProblem(err instanceof PatchFailed ? (err.reason ?? "other") : "other");
    } finally {
      setBusy(null);
    }
  }

  /**
   * FR-F14: anyone can replay the first run.
   *
   * Clearing `onboardedAt` is what makes it a replay rather than a visit: the
   * app sends an un-onboarded member to the wizard, so leaving it set would let
   * someone wander out of it halfway and end up in a half-answered state with
   * no way back in.
   */
  async function redoFirstRun() {
    setBusy("redo");
    try {
      await patchProfile({ onboardedAt: false });
      navigate(FIRST_RUN);
    } finally {
      setBusy(null);
    }
  }

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
        <h3>{t("settings.profile")}</h3>

        <label className="field-label" htmlFor="set-username">
          {t("settings.username")}
        </label>
        <div className="inline-field">
          <input
            id="set-username"
            className="text-input"
            value={name}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            onChange={(e) => {
              setName(e.target.value.toLowerCase());
              setNameProblem(null);
              setNameSaved(false);
            }}
          />
          <button
            type="button"
            className="ghost"
            disabled={
              busy === "username" || name.trim().length < 3 || name === (profile?.username ?? "")
            }
            onClick={() => void saveName()}
          >
            {t("settings.save")}
          </button>
        </div>
        {/* FR-F6 and FR-F7: the one profile field other people see, said where
            it is edited rather than only where it was first asked for. */}
        <span className="hint">{t("settings.username.hint")}</span>
        {nameProblem && <p className="error">{t(`firstrun.2.err.${nameProblem}`)}</p>}
        {nameSaved && <p className="saved">{t("settings.saved")}</p>}

        <dl className="rows">
          <div>
            <dt>{t("settings.institution")}</dt>
            <dd>
              {institutions.find((i) => i.code === profile?.institutionCode)?.name ??
                t("settings.unset")}
              {/* FR-F13: self-declared, and it opens nothing. */}
              <span className="hint">{t("settings.institution.hint")}</span>
            </dd>
          </div>
          <div>
            <dt>{t("settings.studies")}</dt>
            <dd>
              {[profile?.studies, profile?.yearOfStudy ? `${profile.yearOfStudy}` : null]
                .filter(Boolean)
                .join(" · ") || t("settings.unset")}
              {/* FR-F7, repeated where the data is shown, not only where it is asked. */}
              <span className="hint">{t("settings.studies.hint")}</span>
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="linkish"
          disabled={busy === "redo"}
          onClick={() => void redoFirstRun()}
        >
          {t("settings.redo")}
        </button>
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
        Named, not mocked up. Everything above is real; this is not built, and a
        disabled control that looks like a setting is a promise the product has
        not made (FR-D28, and LESSONS on copy taken from a design document).
      */}
      <section className="panel muted">
        <h3>{t("settings.soon")}</h3>
        <ul className="plain">
          <li>{t("settings.soon.contributions")}</li>
        </ul>
      </section>
    </div>
  );
}
