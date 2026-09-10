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
import { api, SubmitFailed, type ReviewContext, type ReviewDraft } from "./api.js";
import { ReviewForm } from "./ReviewForm.js";
import { AnonymousConfirm, PathChoice } from "./PathChoice.js";
import { next, type Event, type Step } from "./flow.js";

/** What the server said. The anonymous branch has no id, by design (FR-C9). */
type SentResult = { anonymous: boolean };

function Sent({ result, onDone }: { result: SentResult; onDone: () => void }) {
  return (
    <section className="sent">
      <span className={result.anonymous ? "chip-anon" : "chip-named"}>
        {result.anonymous ? "Anonyme" : "Sous mon nom"}
      </span>
      <h3>Avis envoyé</h3>
      {result.anonymous ? (
        <p>
          Il part en modération sans rien qui le relie à vous. Il n&apos;apparaîtra
          pas dans « Mes avis », et cette page ne peut pas vous le montrer: nous
          ne savons pas lequel est le vôtre.
        </p>
      ) : (
        <p>
          Il part en modération sous votre nom. Vous le retrouverez dans « Mes
          avis », où vous pourrez le modifier.
        </p>
      )}
      <button type="button" className="primary" onClick={onDone}>
        Retour à la fiche
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
        setError("l'envoi a échoué");
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !ctx) return <p className="error">{error}</p>;
  if (!ctx) return <p className="meta">chargement…</p>;

  // FR-A is not built, so there may be no member at all. Saying so plainly
  // beats a form that fails on submit.
  if (ctx.quotaRemaining === null && step !== "sent") {
    return (
      <section className="notice">
        <p>
          Publier un avis demande un compte. La connexion n&apos;est pas encore
          en place (FR-A), donc le formulaire n&apos;est pas ouvert ici.
        </p>
        <button type="button" className="back" onClick={onClose}>
          retour à la fiche
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
          busy={busy}
          onBack={() => on("back")}
          onNamed={() => on("choose-named")}
          onAnonymous={() => on("choose-anonymous")}
        />
      )}

      {step === "confirm" && (
        <AnonymousConfirm
          ctx={ctx}
          busy={busy}
          onBack={() => on("back")}
          onConfirm={() => on("confirm-anonymous")}
        />
      )}
    </div>
  );
}
