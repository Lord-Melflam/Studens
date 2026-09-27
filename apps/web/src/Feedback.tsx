/**
 * The feedback panel, reachable from every page. FR-I1, FR-I2.
 *
 * WHY IT IS A FIXED BUTTON AND NOT A LINK IN THE FOOTER. The link is going on
 * social media, so most people arriving have never seen this before, will look
 * at one or two screens, and will form an opinion they have no obvious way to
 * tell us. A footer link is found by somebody already looking for it. The
 * person worth hearing from is the one who is about to give up, and they are
 * not scrolling to the bottom to find a form.
 *
 * IT CARRIES THE PAGE, so nobody has to describe where they were. "It does not
 * work" is the most common bug report there is, and the route turns it into
 * something actionable. The query string is cut off before it is sent, in the
 * kernel rather than here, because what somebody typed into a search box is
 * theirs and is not needed to find the fault.
 *
 * SIGNED IN OR NOT. Nothing on this screen asks, and nothing changes if they
 * are: the server attaches the member when there is a session and does not
 * when there is not.
 *
 * WHAT IT SAYS IT KEEPS, it keeps. The line at the bottom naming the three
 * things stored is not decoration: it is the same promise the privacy page
 * makes, at the moment somebody is deciding whether to type.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useT } from "@studens/i18n";
import { currentRoute } from "./router.js";

type Kind = "bug" | "idea" | "other";
const KINDS: Kind[] = ["bug", "idea", "other"];

type State = "writing" | "sending" | "sent";

export function Feedback() {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("writing");
  const [problem, setProblem] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const firstField = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  // Escape closes it, like every other thing drawn on top of a page. Bound
  // only while it is open, so the page has no listener the rest of the time.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus moves into the panel when it opens, or a keyboard user is left
  // behind the page they just covered up.
  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open]);

  async function send(): Promise<void> {
    setState("sending");
    setProblem(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          kind,
          message,
          contactEmail: email.trim() === "" ? null : email.trim(),
          route: currentRoute(),
          locale,
        }),
      });
      if (res.status === 202) {
        setState("sent");
        setMessage("");
        setEmail("");
        return;
      }
      setState("writing");
      if (res.status === 429) {
        setProblem(t("feedback.err.many"));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { field?: string; problem?: string };
      if (body.field === "contactEmail") setProblem(t("feedback.err.email"));
      else if (body.problem === "too short") setProblem(t("feedback.err.short"));
      else if (body.problem === "too long") setProblem(t("feedback.err.long"));
      else setProblem(t("feedback.err.failed"));
    } catch {
      setState("writing");
      setProblem(t("feedback.err.failed"));
    }
  }

  if (!open) {
    return (
      <button type="button" className="fb-launch" onClick={() => setOpen(true)}>
        {/* A speech bubble, drawn rather than fetched, like every other mark
            here: the page ships no image and requests none. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
          <path
            d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.2A8 8 0 0 1 13 4h0a8 8 0 0 1 8 8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="fb-launch-text">{t("feedback.open")}</span>
      </button>
    );
  }

  return (
    <div className="fb-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div
        className="fb-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="fb-head">
          <h2 id={`${id}-title`}>{state === "sent" ? t("feedback.thanks.title") : t("feedback.title")}</h2>
          <button
            type="button"
            className="fb-close"
            onClick={() => setOpen(false)}
            aria-label={t("feedback.close")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
              <path
                d="m6 6 12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {state === "sent" ? (
          <>
            <p className="fb-intro">{t("feedback.thanks.body")}</p>
            <div className="fb-actions">
              <button type="button" className="fb-send" onClick={() => setState("writing")}>
                {t("feedback.again")}
              </button>
              <button type="button" className="fb-linkish" onClick={() => setOpen(false)}>
                {t("feedback.close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="fb-intro">{t("feedback.intro")}</p>

            <fieldset className="fb-kinds">
              <legend>{t("feedback.kind.legend")}</legend>
              {KINDS.map((k, i) => (
                <button
                  key={k}
                  type="button"
                  ref={i === 0 ? firstField : undefined}
                  className={k === kind ? "fb-kind on" : "fb-kind"}
                  aria-pressed={k === kind}
                  onClick={() => setKind(k)}
                >
                  {t(`feedback.kind.${k}`)}
                </button>
              ))}
            </fieldset>

            <label className="fb-field" htmlFor={`${id}-msg`}>
              {t("feedback.message.label")}
            </label>
            <textarea
              id={`${id}-msg`}
              className="fb-text"
              rows={5}
              value={message}
              maxLength={4000}
              placeholder={t("feedback.message.placeholder")}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label className="fb-field" htmlFor={`${id}-mail`}>
              {t("feedback.email.label")}
            </label>
            <input
              id={`${id}-mail`}
              className="fb-input"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="fb-help">{t("feedback.email.help")}</p>

            {problem && (
              <p className="fb-problem" role="alert">
                {problem}
              </p>
            )}

            <div className="fb-actions">
              <button
                type="button"
                className="fb-send"
                disabled={state === "sending" || message.trim().length < 5}
                onClick={() => void send()}
              >
                {state === "sending" ? t("feedback.sending") : t("feedback.send")}
              </button>
            </div>

            <p className="fb-privacy">{t("feedback.privacy")}</p>
          </>
        )}
      </div>
    </div>
  );
}
