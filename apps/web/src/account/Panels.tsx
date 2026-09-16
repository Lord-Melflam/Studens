/**
 * The three panels that were specification until now: the address, what may be
 * sent to it, and leaving.
 *
 * FR-A13, FR-A15, FR-H1, FR-H2.
 *
 * They live beside the account screen rather than inside it because each is a
 * different weight of action. Changing an address completes somewhere else;
 * turning a notification on is instant; deleting is irreversible and asks
 * twice. One component holding all three would hide that difference.
 */
import { useCallback, useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import {
  EmailRejected,
  deleteAccount,
  downloadExport,
  fetchNotifications,
  requestEmailChange,
  setNotification,
  type EmailProblem,
  type NotificationPreference,
} from "./api.js";

/**
 * FR-A12 and FR-A13: where a Member is reached.
 *
 * Two addresses exist and only one is shown as editable. The provider's is
 * identity and is displayed as a fact, because a field somebody cannot change
 * still has to be a field they can see.
 */
export function EmailPanel({
  contactEmail,
  verified,
  providerEmail,
  onChanged,
}: {
  contactEmail: string | null;
  verified: boolean;
  providerEmail: string | null;
  onChanged: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(contactEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const [pending, setPending] = useState<null | { deliverable: boolean }>(null);

  useEffect(() => setValue(contactEmail ?? ""), [contactEmail]);

  async function submit() {
    setBusy(true);
    setProblem(null);
    setPending(null);
    try {
      const { deliverable } = await requestEmailChange(value);
      setPending({ deliverable });
      onChanged();
    } catch (err) {
      setProblem(err instanceof EmailRejected ? err.reason : "other");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h3>{t("account.email")}</h3>
      <p className="hint">{t("account.email.hint")}</p>

      <label className="field-label" htmlFor="contact-email">
        {t("account.email.contact")}
      </label>
      <div className="inline-field">
        <input
          id="contact-email"
          className="text-input"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setProblem(null);
            setPending(null);
          }}
        />
        <button
          type="button"
          className="ghost"
          disabled={busy || value.trim() === "" || value.trim() === contactEmail}
          onClick={() => void submit()}
        >
          {t("account.email.send")}
        </button>
      </div>

      {/*
        Not "saved". Nothing has changed until the link is opened, and saying
        otherwise would be wrong for as long as it sits unread.

        And not "a message has gone to you" when nothing can go anywhere. With
        no relay configured the row is queued and cannot leave, so the screen
        says that instead of leaving somebody waiting for a link that is not
        coming. Reported by François on 2026-09-13, who waited for one.
      */}
      {pending?.deliverable && (
        <p className="saved">{t("account.email.pending", { email: value.trim() })}</p>
      )}
      {pending && !pending.deliverable && (
        <p className="error">{t("account.email.undeliverable", { email: value.trim() })}</p>
      )}
      {problem && <p className="error">{t(`account.email.err.${problem}`)}</p>}

      {contactEmail && !verified && pending === null && (
        <p className="error">{t("account.email.unverified")}</p>
      )}

      <dl className="rows">
        <div>
          <dt>{t("account.email.provider")}</dt>
          <dd>
            <code>{providerEmail ?? t("settings.unset")}</code>
            {/* FR-A12: identity, not preference. Editable would mean somebody
                could edit the field their own sign-in is matched on. */}
            <span className="hint">{t("account.email.provider.hint")}</span>
            {/*
              An account created before FR-A11 has none: the address was
              genuinely never stored, so there is nothing to backfill, and it
              arrives on the next sign-in. Saying so beats a bare "Not given",
              which reads as a fault.
            */}
            {!providerEmail && <span className="hint">{t("account.email.provider.absent")}</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** FR-H1 and FR-H2: one switch per kind, and only the optional kinds are here. */
export function NotificationsPanel() {
  const t = useT();
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [deliverable, setDeliverable] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchNotifications().then((r) => {
      setPrefs(r.preferences);
      setDeliverable(r.deliverable);
    });
  }, []);
  useEffect(load, [load]);

  async function toggle(kind: string, enabled: boolean) {
    setBusy(kind);
    // Optimistic, because a switch that waits for a round trip feels broken,
    // and the failure path reloads the truth.
    setPrefs((p) => p?.map((x) => (x.kind === kind ? { ...x, enabled } : x)) ?? null);
    try {
      await setNotification(kind, enabled);
    } catch {
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <h3>{t("account.notifications")}</h3>
      <p className="hint">{t("account.notifications.hint")}</p>
      {/* Said because the screen holds both kinds of saving: the username has a
          button, these do not, and a person who has just used the button looks
          for another one here and does not trust what they cannot see happen. */}
      <p className="hint">{t("account.notifications.auto")}</p>

      {prefs === null ? (
        <p className="hint">…</p>
      ) : (
        <ul className="switches">
          {prefs.map((p) => (
            <li key={p.kind}>
              <label>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={busy === p.kind}
                  onChange={(e) => void toggle(p.kind, e.target.checked)}
                />
                <span>
                  <strong>{t(`account.kind.${p.kind}`)}</strong>
                  <span className="hint">{t(`account.kind.${p.kind}.hint`)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* Said before anybody switches something on and waits for it. */}
      {!deliverable && <p className="error">{t("account.notifications.undeliverable")}</p>}

      {/* FR-H2: the mail that is not a preference, named so its absence from
          this list is not read as an oversight. */}
      <p className="hint strong">{t("account.notifications.transactional")}</p>
      {/* FR-H3, and it is not a limitation we chose. */}
      <p className="hint">{t("account.notifications.anonymous")}</p>
    </section>
  );
}

/**
 * FR-A15: taking your data with you, and leaving.
 *
 * Together, because they are the same decision at two levels of finality, and
 * because somebody about to delete should have the export in front of them.
 */
export function LeavingPanel({ username }: { username: string | null }) {
  const t = useT();
  const [asked, setAsked] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Somebody who never finished the first run has no username to type, so the
  // word stands in. Refusing to delete a half-finished account would be the
  // worst possible reading of a right to erasure.
  const expected = username ?? "supprimer";

  async function remove() {
    setBusy(true);
    setFailed(false);
    try {
      await deleteAccount(confirm);
      // Out of the app entirely: there is no account left to render.
      window.location.assign("/?compte=supprime");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <section className="panel danger">
      <h3>{t("account.leaving")}</h3>

      <p className="hint">{t("account.export.hint")}</p>
      <button type="button" className="ghost" onClick={() => void downloadExport()}>
        {t("account.export")}
      </button>

      <hr />

      {!asked ? (
        <>
          <p className="hint">{t("account.delete.hint")}</p>
          <button type="button" className="ghost danger" onClick={() => setAsked(true)}>
            {t("account.delete")}
          </button>
        </>
      ) : (
        <>
          {/*
            What actually happens, said before the button and not after it.
            The third line is the one people do not expect: the text of a
            signed review stays, without the name. It is what François chose
            (OPEN-46) and it has to be stated, not discovered.
          */}
          <ul className="plain">
            <li>{t("account.delete.what.account")}</li>
            <li>{t("account.delete.what.named")}</li>
            <li>{t("account.delete.what.anonymous")}</li>
            <li>{t("account.delete.what.text")}</li>
          </ul>

          <label className="field-label" htmlFor="delete-confirm">
            {t("account.delete.type", { word: expected })}
          </label>
          <div className="inline-field">
            <input
              id="delete-confirm"
              className="text-input"
              value={confirm}
              autoComplete="off"
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button
              type="button"
              className="ghost danger"
              disabled={busy || confirm.trim().toLowerCase() !== expected}
              onClick={() => void remove()}
            >
              {t("account.delete.now")}
            </button>
          </div>
          {failed && <p className="error">{t("account.delete.failed")}</p>}
          <button type="button" className="linkish" onClick={() => setAsked(false)}>
            {t("account.delete.cancel")}
          </button>
        </>
      )}
    </section>
  );
}
