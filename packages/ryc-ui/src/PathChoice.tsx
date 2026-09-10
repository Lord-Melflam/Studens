/**
 * Step 2 of the review path: the fork.
 *
 * A screen of its own, with two cards side by side and no default. The two
 * halves are deliberately not symmetric:
 *
 *   - the named card sends on one press
 *   - the anonymous card leads to one more screen
 *
 * Only one of the two cannot be undone, so only one of the two costs an extra
 * confirmation (docs/design/frontend-design.tex 6, FR-C23).
 *
 * WHAT THE CARDS MAY SAY. This is the screen where a person makes a permanent
 * choice by comparing two lists, so a claim on either list that is not true
 * today is a thumb on the scale. Editing an attributed review (FR-C14) and
 * "Mes avis" (FR-D12) are specified and NOT BUILT, so the named card does not
 * offer them as reasons to choose it. They are named as planned, once, in the
 * one place where the difference between the branches is permanent anyway.
 * test/ui/path-honesty.test.ts holds this.
 */
import type { ReviewContext, ReviewDraft } from "./api.js";
import { Steps } from "./Steps.js";

function Counts({ ctx }: { ctx: ReviewContext }) {
  const named =
    ctx.named === 0 ? "aucun avis nommé" : `${ctx.named} avis nommé${ctx.named > 1 ? "s" : ""}`;
  const anon =
    ctx.anonymous === 0
      ? "aucun avis anonyme"
      : `${ctx.anonymous} avis anonyme${ctx.anonymous > 1 ? "s" : ""}`;
  return (
    <p className="counts">
      Ce cours a <strong>{named}</strong> et <strong>{anon}</strong>.
      {ctx.anonymous === 0 && " Vous seriez le premier."}
      <em>
        Plus il y a d&apos;avis anonymes, moins le vôtre ressort. Vous seul savez
        combien d&apos;étudiants ont suivi ce cours: nous ne le savons pas.
      </em>
    </p>
  );
}

/**
 * What you are about to publish, collapsed.
 *
 * The choice on this screen is about the text, and until now the text was on
 * the previous screen. Deciding whether you want your name on something you
 * cannot currently see is a decision made half blind.
 */
export function DraftSummary({ draft }: { draft: ReviewDraft | null }) {
  if (!draft) return null;
  return (
    <details className="draft">
      <summary>
        Relire mon avis
        <span className="draft-facts">
          {draft.academicYear}-{draft.academicYear + 1} · recommandé{" "}
          {draft.recommendation}/5 · charge {draft.workloadVsEcts}/5 · difficulté{" "}
          {draft.difficulty}/5 · {draft.body.length} caractères
        </span>
      </summary>
      <p className="draft-body">{draft.body}</p>
      {draft.advice && (
        <p className="draft-advice">
          <strong>Conseil:</strong> {draft.advice}
        </p>
      )}
    </details>
  );
}

export function PathChoice({
  ctx,
  draft,
  onNamed,
  onAnonymous,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  draft: ReviewDraft | null;
  onNamed: () => void;
  onAnonymous: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <section className="fork">
      <Steps current="fork" />
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        revenir au formulaire
      </button>
      <h3>Comment voulez-vous publier cet avis ?</h3>
      <p className="form-lead">
        Ce choix ne peut pas être changé après l&apos;envoi. Lisez les deux avant
        de choisir.
      </p>

      <DraftSummary draft={draft} />

      <div className="fork-cards">
        <article className="card card-named">
          <span className="chip-named">Sous mon nom</span>
          <ul>
            <li>Votre nom apparaît sur la fiche du cours.</li>
            <li>On peut vous demander des précisions, ou vous contredire.</li>
            <li>Vous restez rattaché à cet avis, y compris dans un an.</li>
          </ul>
          <button type="button" className="primary named" onClick={onNamed} disabled={busy}>
            Publier sous mon nom
          </button>
        </article>

        <article className="card card-anon">
          <span className="chip-anon">Anonyme</span>
          <p className="card-lead">Définitif</p>
          <ul>
            <li>Aucun nom, aucune faculté, aucun domaine.</li>
            <li>
              <strong>Impossible à modifier ou à supprimer.</strong>
            </li>
            <li>Vous ne pourrez pas prouver qu&apos;il est de vous.</li>
          </ul>
          <Counts ctx={ctx} />
          <button type="button" className="primary anon" onClick={onAnonymous} disabled={busy}>
            Continuer en anonyme
          </button>
        </article>
      </div>

      {/*
        Said once, below both cards, and not as an argument for either. A
        feature that does not exist yet belongs in a footnote, not in the list
        someone reads to make a decision they cannot take back.
      */}
      <p className="fork-note">
        La modification d&apos;un avis nommé est prévue et n&apos;est pas encore
        en place. Elle ne concernera jamais un avis anonyme: personne, nous y
        compris, ne peut retrouver lequel est le vôtre.
      </p>
    </section>
  );
}

/**
 * Step 3, on the anonymous branch only.
 *
 * The extra screen exists because of what happens after it: once the row is
 * written there is no member id attached to it anywhere, so nobody, including
 * an administrator with the database open, can find it again on your behalf
 * (FR-C9). It is the last moment at which the decision is still reversible.
 */
export function AnonymousConfirm({
  ctx,
  draft,
  onConfirm,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  draft: ReviewDraft | null;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <section className="confirm">
      <Steps current="confirm" />
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        revenir au choix
      </button>
      <span className="chip-anon">Anonyme</span>
      <h3>Dernière étape avant l&apos;envoi</h3>

      <ul className="confirm-points">
        <li>
          Cet avis sera publié <strong>sans aucun lien avec votre compte</strong>.
        </li>
        <li>
          Vous ne pourrez plus le modifier, le corriger ni le retirer.{" "}
          <em>Nous non plus, à votre demande: nous ne saurons pas lequel est le vôtre.</em>
        </li>
        <li>
          Un modérateur pourra le retirer s&apos;il pose problème, sans savoir qui
          l&apos;a écrit.
        </li>
      </ul>

      {/* Last chance to reread it, on the screen where rereading still matters. */}
      <DraftSummary draft={draft} />

      <Counts ctx={ctx} />

      <div className="actions">
        <button type="button" className="primary anon" onClick={onConfirm} disabled={busy}>
          {busy ? "envoi…" : "Publier anonymement, définitivement"}
        </button>
        {/*
          A second way out, beside the irreversible button. Someone who has
          scrolled this far and hesitates should not have to scroll back up to
          the link at the top to change their mind. It says what it does: it
          does not publish anything, it returns to the choice.
        */}
        <button type="button" className="ghost" onClick={onBack} disabled={busy}>
          Revenir en arrière
        </button>
      </div>
    </section>
  );
}
