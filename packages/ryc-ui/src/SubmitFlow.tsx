/**
 * The review path, end to end: form, fork, confirmation, result.
 *
 * The state machine is deliberately explicit rather than a set of booleans,
 * because one of its transitions is irreversible and a reader has to be able to
 * see where that is. Only `confirm -> sent` writes an anonymous row.
 *
 *   form ──> fork ──> sent            (named: one press)
 *              └──> confirm ──> sent  (anonymous: one press more)
 *
 * Every back arrow keeps the draft, so changing your mind about the path never
 * costs you the text you wrote.
 */
import { useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { api, SubmitFailed, type ReviewContext, type ReviewDraft } from "./api.js";
import { ReviewForm } from "./ReviewForm.js";
import { AnonymousConfirm, PathChoice } from "./PathChoice.js";
import { next, type Event, type Step } from "./flow.js";

/** What the server said. The anonymous branch has no id, by design (FR-C9). */
type SentResult = { anonymous: boolean };

function Sent({ result, onDone }: { result: SentResult; onDone: () => void }) {
  const t = useT();
  return (
    <section className="sent">
      <span className={result.anonymous ? "chip-anon" : "chip-named"}>
        {result.anonymous ? t("ryc.anonymous") : t("ryc.fork.named.chip")}
      </span>
      <h3>{t("ryc.sent.title")}</h3>
      <p>{result.anonymous ? t("ryc.sent.anon") : t("ryc.sent.named")}</p>
      <button type="button" className="primary" onClick={onDone}>
        {t("ryc.sent.back")}
      </button>
    </section>
  );
}

export function SubmitFlow({
  courseCode,
  onClose,
  onSubmitted,
}: {
  courseCode: string;
  onClose: () => void;
  /** Lets the course page reload its reviews without knowing this flow's state. */
  onSubmitted: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState<Step>("form");
  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [result, setResult] = useState<SentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .reviewContext(courseCode)
      .then(setCtx)
      .catch(() => setError("impossible de charger cette page"));
  }, [courseCode]);

  /**
   * Every button goes through here. The component chooses no destination of
   * its own: `next` does, and whether a write happens is `next`'s answer too.
   */
  function on(event: Event) {
    const t = next(step, event);
    setStep(t.step);
    if (t.send) void send(t.send === "anonymous");
  }

  async function send(anonymous: boolean) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.submitReview(courseCode, draft, anonymous);
      setResult({ anonymous: res.anonymous });
      setStep(next(step, "accepted").step);
      onSubmitted();
    } catch (err) {
      if (err instanceof SubmitFailed) {
        setError(
          err.status === 429
            ? "Vous avez atteint votre limite d'avis pour cette période. Réessayez plus tard."
            : err.status === 409
              ? "Vous avez déjà un avis nommé pour ce cours et cette année."
              : err.status === 401
                ? "Il faut être connecté pour publier un avis."
                : err.message,
        );
        // A rejected draft is still a draft. Sending the person back to the
        // form with their text intact is the only tolerable failure mode here.
        if (err.status === 400) setStep(next(step, "rejected").step);
      } else {
        setError(t("ryc.err.send"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !ctx) return <p className="error">{error}</p>;
  if (!ctx) return <p className="meta">{t("ryc.loading")}</p>;

  // No quota means no member: nobody is signed in. Saying so plainly beats a
  // form that fails on submit. The module cannot offer a sign-in itself, since
  // that is the shell's business (FR-B16), so it points at where the control is.
  if (ctx.quotaRemaining === null && step !== "sent") {
    return (
      <section className="notice">
        <p>{t("ryc.signin.required")}</p>
        <button type="button" className="back" onClick={onClose}>
          {t("ryc.form.back")}
        </button>
      </section>
    );
  }

  // FR-C4. At zero the answer will not change by writing the review first, so
  // the form does not open. The wording says what the limit counts, because a
  // limit that appears to know WHICH reviews you wrote would read as a link
  // between your account and an anonymous row, which is the thing that does
  // not exist (design/anonymous-rate-limiting.md).
  if (ctx.quotaRemaining === 0 && step !== "sent") {
    return (
      <section className="notice">
        <p>{t("ryc.quota.done")}</p>
        <p className="hint">{t("ryc.quota.note")}</p>
        <button type="button" className="back" onClick={onClose}>
          {t("ryc.form.back")}
        </button>
      </section>
    );
  }

  if (step === "sent" && result) {
    return <Sent result={result} onDone={onClose} />;
  }

  return (
    <div className="flow">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {step === "form" && (
        <ReviewForm
          courseCode={courseCode}
          quotaRemaining={ctx.quotaRemaining}
          initial={draft}
          onCancel={onClose}
          onReady={(d) => {
            setDraft(d);
            on("draft-ready");
          }}
        />
      )}

      {step === "fork" && (
        <PathChoice
          ctx={ctx}
          draft={draft}
          busy={busy}
          onBack={() => on("back")}
          onNamed={() => on("choose-named")}
          onAnonymous={() => on("choose-anonymous")}
        />
      )}

      {step === "confirm" && (
        <AnonymousConfirm
          ctx={ctx}
          draft={draft}
          busy={busy}
          onBack={() => on("back")}
          onConfirm={() => on("confirm-anonymous")}
        />
      )}
    </div>
  );
}
