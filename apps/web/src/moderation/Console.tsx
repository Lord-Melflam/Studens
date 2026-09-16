/**
 * The moderator's console, at /app/moderation. FR-E10 to FR-E14.
 *
 * IN THE SHELL'S ZONE, NOT IN A MODULE. Moderation is the platform's: it acts
 * on any module's content through a kind and an id, and a console living inside
 * RYC would have to be built again for the second module. This screen therefore
 * names no module's domain (FR-B16); it says "contribution", and what it draws
 * comes from whatever the API returned.
 *
 * WHAT IT DOES NOT SHOW, which is the part worth reading. No author, ever. An
 * anonymous contribution has none, and for the rest the console does not ask:
 * a moderator decides about content, and the ability to resolve one to a person
 * is a capability this screen has no use for and FR-E14 forbids.
 *
 * NO REMOVAL BUTTON. Hold takes it out of public view and release puts it back;
 * both are reversible and neither deletes anything. Removal publishes a
 * statement of reasons in the place the contribution occupied (FR-E9), and
 * FR-E9 is still [OPEN] pending the same qualified reader as requirements 5.1.
 * A delete button here would be either a silent deletion or a legal reading
 * nobody has agreed with.
 */
import { useCallback, useEffect, useState } from "react";
import { useT, useLocale } from "@studens/i18n";
import { useSession } from "../session.js";
import {
  decide,
  fetchAppointments,
  fetchQueue,
  appoint,
  type Appointment,
  type AppointmentEvent,
  type QueueEntry,
} from "./api.js";

function ago(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** One reported thing, with what a moderator needs to decide about it. */
function Entry({ entry, onDone }: { entry: QueueEntry; onDone: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const held = entry.target?.held ?? false;

  async function act(action: "hold" | "release" | "leave", outcome: "upheld" | "rejected") {
    if (reason.trim().length < 5) return;
    setBusy(true);
    setFailed(false);
    try {
      await decide({
        targetKind: entry.targetKind,
        targetId: entry.targetId,
        action,
        outcome,
        reason: reason.trim(),
      });
      onDone();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <article className={held ? "queue-entry held" : "queue-entry"}>
      <header>
        <span className="queue-context">{entry.target?.context ?? t("mod.gone")}</span>
        {held && <span className="chip-held">{t("mod.held")}</span>}
        {/*
          FR-E12: the count is evidence about the reporters as much as about the
          content, so it is shown WITH how many came from accounts. Many notices
          from accounts created the same week is a brigading signature, and it
          is only visible if the split is.
        */}
        <span className="queue-counts">
          {/* Two strings and not one sentence with two numbers in it. The
              plural form is chosen from a variable named `count`, so a single
              string could only ever agree with one of the two, which is how
              "1 reports" reached the screen. */}
          {t("mod.counts", { count: entry.open })}
          {entry.fromMembers > 0 && <>, {t("mod.counts.members", { count: entry.fromMembers })}</>}
        </span>
        <span className="queue-age">{t("mod.since", { when: ago(entry.oldestAt, locale) })}</span>
      </header>

      <p className="queue-categories">
        {entry.categories.map((c) => (
          <span key={c} className="chip-cat">
            {t(`mod.cat.${c}`)}
          </span>
        ))}
      </p>

      {entry.target ? (
        <>
          <p className="queue-path">{t(`mod.path.${entry.target.path}`)}</p>
          <blockquote className="queue-body">{entry.target.body}</blockquote>
          {entry.target.advice && <p className="queue-advice">{entry.target.advice}</p>}
        </>
      ) : (
        <p className="hint">{t("mod.gone.detail")}</p>
      )}

      <label className="field-label" htmlFor={`reason-${entry.targetId}`}>
        {t("mod.reason")}
      </label>
      <input
        id={`reason-${entry.targetId}`}
        className="text-input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("mod.reason.placeholder")}
      />
      {/* FR-E1: an entry recording that something happened but not why is half
          an audit trail, so the reason is required rather than encouraged. */}
      <p className="field-note">{t("mod.reason.rule")}</p>

      {failed && <p className="error">{t("mod.failed")}</p>}

      <div className="queue-actions">
        {held ? (
          <button
            type="button"
            className="ghost"
            disabled={busy || reason.trim().length < 5}
            onClick={() => void act("release", "rejected")}
          >
            {t("mod.release")}
          </button>
        ) : (
          <button
            type="button"
            className="ghost danger"
            disabled={busy || reason.trim().length < 5}
            onClick={() => void act("hold", "upheld")}
          >
            {t("mod.hold")}
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={busy || reason.trim().length < 5}
          onClick={() => void act("leave", "rejected")}
        >
          {t("mod.dismiss")}
        </button>
      </div>
      {/* Said once, here, because a moderator looking for a delete button
          should find out why there is not one rather than conclude it is
          missing. */}
      <p className="hint">{t("mod.noremoval")}</p>
    </article>
  );
}

/** FR-E14 and FR-E3. Administrators only; the API refuses everybody else. */
/**
 * Whether a role change takes a power away.
 *
 * Read from the position in the list the API sent, which is ordered from fewest
 * powers to most. That ordering is load bearing and is checked against the
 * powers themselves in the platform's tests, so a role added later gets its
 * rank without this screen being told about it.
 *
 * An unknown role counts as no change rather than as a downgrade: guessing that
 * something unrecognised is a demotion would put a confirmation in front of an
 * upgrade, and people who confirm everything confirm the one that mattered.
 */
export function takesPowerAway(roles: string[], from: string, to: string): boolean {
  const a = roles.indexOf(from);
  const b = roles.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b < a;
}

/**
 * One person who holds a power, and the control that changes it.
 *
 * A row rather than a form. Appointing used to mean typing a username and
 * picking a role again, even for somebody already on the list, so changing
 * one person's role meant retyping their name correctly. The list is the
 * thing being managed, so the control belongs in it.
 *
 * THE ROLES COME FROM THE SERVER, never from a list written here. A fourth role
 * appears in every one of these selects, and in the grouping above, without
 * this file changing. That is the whole reason the API sends them.
 */
function Holder({
  who,
  roles,
  isSelf,
  isLastAdmin,
  onChanged,
}: {
  who: Appointment;
  roles: string[];
  isSelf: boolean;
  isLastAdmin: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [choice, setChoice] = useState(who.role);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Two refusals are certain before asking, so the control says so instead of
  // letting somebody press a button that cannot work. The server refuses them
  // as well and stays the authority: this only stops the pointless round trip.
  const frozen = isSelf || isLastAdmin;
  const changed = choice !== who.role;
  // Only downwards. Giving a power is recorded and undone in two clicks; taking
  // one away lands on somebody in the middle of using it, and a select sits one
  // mis-click from the entry below the one meant.
  const removing = takesPowerAway(roles, who.role, choice);

  async function apply() {
    setBusy(true);
    setProblem(null);
    try {
      await appoint(who.username ?? "", choice);
      onChanged();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "failed");
      setChoice(who.role);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className="holder">
      <span className="holder-name">
        <strong>{who.username ?? who.memberId}</strong>
        {isSelf && <span className="holder-you">{t("mod.appoint.you")}</span>}
      </span>
      <select
        className="text-input"
        value={choice}
        disabled={frozen || busy}
        aria-label={t("mod.appoint.role")}
        onChange={(e) => {
          setChoice(e.target.value);
          setProblem(null);
        }}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {t(`mod.role.${r}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ghost"
        disabled={!changed || busy || frozen || confirming}
        onClick={() => (removing ? setConfirming(true) : void apply())}
      >
        {t("mod.appoint.change")}
      </button>
      {confirming && (
        <span className="holder-confirm">
          {/* Names the person and the role they would be left with, because
              "are you sure?" asks about nothing in particular. */}
          <span>
            {t("mod.appoint.confirm", {
              name: who.username ?? who.memberId,
              role: t(`mod.role.${choice}`),
            })}
          </span>
          <button type="button" className="ghost danger" disabled={busy} onClick={() => void apply()}>
            {t("mod.appoint.confirm.yes")}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              setChoice(who.role);
            }}
          >
            {t("mod.appoint.confirm.no")}
          </button>
        </span>
      )}
      {frozen && (
        <span className="field-note">
          {isSelf ? t("mod.appoint.err.self") : t("mod.appoint.err.last-admin")}
        </span>
      )}
      {problem && <span className="error">{t(`mod.appoint.err.${problem}`)}</span>}
    </li>
  );
}

function Appointments() {
  const t = useT();
  const locale = useLocale();
  const { session } = useSession();
  const [data, setData] = useState<{
    roles: string[];
    appointments: Appointment[];
    history: AppointmentEvent[];
  } | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("moderator");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void fetchAppointments().then(setData);
  }, []);
  useEffect(load, [load]);

  async function grant() {
    setBusy(true);
    setProblem(null);
    try {
      await appoint(username.trim(), role);
      setUsername("");
      load();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  // Grouped, strongest first, and built from the server's own list of roles so
  // a new one gets a group without this file being edited. Nobody appears under
  // the plain member role: that is what not holding a power is, and listing
  // every account would turn a page about accountability into a directory.
  const strongestFirst = [...data.roles].reverse();
  const admins = data.appointments.filter((a) => a.role === "admin");

  return (
    <section className="panel">
      <h3>{t("mod.appointments")}</h3>
      <p className="hint">{t("mod.appointments.hint")}</p>

      {strongestFirst.map((r) => {
        const holders = data.appointments.filter((a) => a.role === r);
        if (holders.length === 0) return null;
        return (
          <div className="holder-group" key={r}>
            <h4 className="sub">
              {t(`mod.group.${r}`)} <span className="count">{holders.length}</span>
            </h4>
            <ul className="holders">
              {holders.map((a) => (
                <Holder
                  key={a.memberId}
                  who={a}
                  roles={data.roles}
                  isSelf={!!session?.username && session.username === a.username}
                  isLastAdmin={a.role === "admin" && admins.length === 1}
                  onChanged={load}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {/* Still by name, because somebody who holds no power yet is not on any
          list above: the page shows the set that matters, not every account. */}
      <h4 className="sub">{t("mod.appoint.add")}</h4>
      <label className="field-label" htmlFor="appoint-username">
        {t("mod.appoint.who")}
      </label>
      <div className="inline-field">
        <input
          id="appoint-username"
          className="text-input"
          value={username}
          autoComplete="off"
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            setProblem(null);
          }}
          placeholder={t("mod.appoint.placeholder")}
        />
        <select
          className="text-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label={t("mod.appoint.role")}
        >
          {data.roles.map((r) => (
            <option key={r} value={r}>
              {t(`mod.role.${r}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost"
          disabled={busy || username.trim() === ""}
          onClick={() => void grant()}
        >
          {t("mod.appoint")}
        </button>
      </div>
      {problem && <p className="error">{t(`mod.appoint.err.${problem}`)}</p>}

      {/* FR-E14: recorded, and therefore readable. How the current set came to
          be is the only thing that makes it reviewable. */}
      <h4 className="sub">{t("mod.appointments.history")}</h4>
      <ul className="plain small">
        {data.history.map((h, i) => (
          <li key={`${h.at}-${i}`}>
            {ago(h.at, locale)} · <code>{h.action}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ModerationConsole({ canAppoint }: { canAppoint: boolean }) {
  const t = useT();
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);

  const load = useCallback(() => {
    void fetchQueue().then(setQueue);
  }, []);
  useEffect(load, [load]);

  return (
    <div className="panel-stack">
      <h2 className="panel-title">{t("mod.title")}</h2>

      <section className="panel">
        <h3>{t("mod.queue")}</h3>
        {/* Oldest first, never most reported: sorting by count would put
            whatever a group piled onto at the top, which is what a brigade is
            trying to buy (FR-E12). */}
        <p className="hint">{t("mod.queue.hint")}</p>

        {queue === null ? (
          <p className="hint">…</p>
        ) : queue.length === 0 ? (
          <p className="hint">{t("mod.queue.empty")}</p>
        ) : (
          <div className="queue">
            {queue.map((e) => (
              <Entry key={`${e.targetKind}:${e.targetId}`} entry={e} onDone={load} />
            ))}
          </div>
        )}
      </section>

      {canAppoint && <Appointments />}
    </div>
  );
}
