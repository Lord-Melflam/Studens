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
 * confirmation (docs/design/frontend-design.tex 6.1).
 *
 * The counts come from GET /review-context and are FR-C21 in one sentence.
 * Studens does not know the cohort size and never will (requirements.md 3.3),
 * so it hands over the two numbers it does have and leaves the judgement to the
 * only person who holds the third. That is informed risk, not prevented risk,
 * and the wording must not pretend otherwise.
 */
import type { ReviewContext } from "./api.js";

function Counts({ ctx }: { ctx: ReviewContext }) {
  const named = ctx.named === 0 ? "aucun avis nommé" : `${ctx.named} avis nommé${ctx.named > 1 ? "s" : ""}`;
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

export function PathChoice({
  ctx,
  onNamed,
  onAnonymous,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  onNamed: () => void;
  onAnonymous: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <section className="fork">
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        revenir au formulaire
      </button>
      <h3>Comment voulez-vous publier cet avis ?</h3>
      <p className="form-lead">
        Ce choix ne peut pas être changé après l&apos;envoi. Lisez les deux avant
        de choisir.
      </p>

      <div className="fork-cards">
        <article className="card card-named">
          <span className="chip-named">Sous mon nom</span>
          <ul>
            <li>Votre nom apparaît sur la fiche du cours.</li>
            <li>Vous pouvez le modifier plus tard.</li>
            <li>Il apparaît dans « Mes avis ».</li>
            <li>Vous pouvez demander sa suppression.</li>
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
            <li>N&apos;apparaît pas dans « Mes avis ».</li>
            <li>Vous ne pourrez pas prouver qu&apos;il est de vous.</li>
          </ul>
          <Counts ctx={ctx} />
          <button type="button" className="primary anon" onClick={onAnonymous} disabled={busy}>
            Continuer en anonyme
          </button>
        </article>
      </div>
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
  onConfirm,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <section className="confirm">
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

      <Counts ctx={ctx} />

      <div className="actions">
        <button type="button" className="primary anon" onClick={onConfirm} disabled={busy}>
          {busy ? "envoi…" : "Publier anonymement, définitivement"}
        </button>
        <button type="button" className="ghost" onClick={onBack} disabled={busy}>
          Finalement, sous mon nom
        </button>
      </div>
    </section>
  );
}
