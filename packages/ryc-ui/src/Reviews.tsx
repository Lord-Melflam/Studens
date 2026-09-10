/**
 * Reading the reviews on a course page.
 *
 * This component renders whatever the server sent and hides nothing itself.
 * That is the point: FR-D15 and FR-C16 are enforced in packages/ryc/read.ts, so
 * an anonymous review arrives with `author`, `recommendation`, `workloadVsEcts`
 * and `difficulty` already null. If this file were the thing withholding them, a
 * second client would leak them on day one.
 *
 * FR-D20 draws the layout: the numbers describe the course, so they sit at the
 * top as one aggregate; the prose discusses the teaching, so it sits below, one
 * voice at a time.
 */
import type { Aggregate, PublishedReview } from "./api.js";

function Stat({ label, value, of }: { label: string; value: number | null; of: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value === null ? "n/a" : value.toFixed(1)}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-scale">{of}</span>
    </div>
  );
}

function Summary({ a }: { a: Aggregate }) {
  if (a.count === 0) return null;
  return (
    <div className="summary">
      <div className="stats">
        <Stat label="recommandé" value={a.recommendation} of="sur 5" />
        <Stat label="charge / ECTS" value={a.workloadVsEcts} of="sur 5" />
        <Stat label="difficulté" value={a.difficulty} of="sur 5" />
      </div>
      {/* FR-D10: a number never travels without its denominator. */}
      <p className="denominator">
        Sur {a.count} avis: {a.named} nommé{a.named > 1 ? "s" : ""}, {a.anonymous} anonyme
        {a.anonymous > 1 ? "s" : ""}.
        {/* FR-D23: a band above a floor, never a percentage, never per review. */}
        {a.passBand && <> Réussite: {a.passBand}.</>}
      </p>
    </div>
  );
}

function Review({ r }: { r: PublishedReview }) {
  return (
    <article className={`review review-${r.path}`}>
      <header>
        {r.path === "named" && <span className="chip-named">{r.author}</span>}
        {r.path === "anonymous" && <span className="chip-anon">Anonyme</span>}
        {r.path === "imported" && <span className="chip-anon">Repris de {r.source}</span>}
        <span className="review-year">
          suivi en {r.academicYear}-{r.academicYear + 1}
        </span>
        {/* The three numbers appear here on the named path and nowhere on the
            other. Their absence is FR-D15 and is not a rendering accident. */}
        {r.recommendation !== null && (
          <span className="review-scores">
            recommandé {r.recommendation}/5 · charge {r.workloadVsEcts}/5 · difficulté{" "}
            {r.difficulty}/5
          </span>
        )}
      </header>
      <p className="review-body">{r.body}</p>
      {r.advice && (
        <p className="review-advice">
          <strong>Conseil:</strong> {r.advice}
        </p>
      )}
    </article>
  );
}

export function Reviews({
  aggregate,
  reviews,
  sessionRequired,
  onWrite,
}: {
  aggregate: Aggregate;
  reviews: PublishedReview[];
  /** FR-D13: course pages are public, review bodies are not. */
  sessionRequired: boolean;
  onWrite: () => void;
}) {
  return (
    <section className="reviews">
      <div className="reviews-head">
        <h3>Avis</h3>
        <button type="button" className="primary" onClick={onWrite}>
          Donner mon avis
        </button>
      </div>

      <Summary a={aggregate} />

      {aggregate.count === 0 && (
        <p className="empty">
          Personne n&apos;a encore donné son avis sur ce cours. Le premier avis
          est le plus utile, et le plus exposé: le choix entre votre nom et
          l&apos;anonymat vous sera présenté avant l&apos;envoi.
        </p>
      )}

      {sessionRequired && aggregate.count > 0 && (
        <p className="notice">
          Les chiffres ci-dessus décrivent le cours et restent publics. Le texte
          des avis demande un compte (FR-D13).
        </p>
      )}

      {reviews.map((r) => (
        <Review key={r.id} r={r} />
      ))}
    </section>
  );
}
