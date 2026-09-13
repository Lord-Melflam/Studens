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
import { useT } from "@studens/i18n";
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
  const t = useT();
  if (a.count === 0) return null;
  const of = t("ryc.stat.of");
  return (
    <div className="summary">
      <div className="stats">
        <Stat label={t("ryc.stat.recommendation")} value={a.recommendation} of={of} />
        <Stat label={t("ryc.stat.workload")} value={a.workloadVsEcts} of={of} />
        <Stat label={t("ryc.stat.difficulty")} value={a.difficulty} of={of} />
      </div>
      {/* FR-D10: a number never travels without its denominator. */}
      <p className="denominator">
        {t("ryc.reviews.denominator", {
          count: a.count,
          named: a.named,
          anonymous: a.anonymous,
        })}
        {/* Counted apart from both, never folded into the anonymous figure:
            that number is what a contributor uses to judge their own exposure
            (FR-C21), so inflating it would make the judgement wrong. */}
        {a.detached > 0 && <> {t("ryc.reviews.detached", { count: a.detached })}</>}
        {/* FR-D23: a band above a floor, never a percentage, never per review. */}
        {a.passBand && <> {t("ryc.reviews.pass", { band: a.passBand })}</>}
      </p>
    </div>
  );
}

function Review({ r }: { r: PublishedReview }) {
  const t = useT();
  return (
    <article className={`review review-${r.path}`}>
      <header>
        {r.path === "named" && <span className="chip-named">{r.author}</span>}
        {r.path === "anonymous" && <span className="chip-anon">{t("ryc.anonymous")}</span>}
        {/*
          FR-A15 and OPEN-46: published under a name, whose account is gone.
          Its own label, never "Anonyme": the text was signed and people may
          remember who wrote it, so calling it anonymous would claim a
          protection it does not have.
        */}
        {r.path === "detached" && <span className="chip-detached">{t("ryc.detached")}</span>}
        {r.path === "imported" && (
          <span className="chip-anon">{t("ryc.imported", { source: r.source ?? "?" })}</span>
        )}
        <span className="review-year">
          {t("ryc.review.taken", { from: r.academicYear, to: r.academicYear + 1 })}
        </span>
        {/* The three numbers appear here on the named path and nowhere on the
            other. Their absence is FR-D15 and is not a rendering accident. */}
        {r.recommendation !== null && (
          <span className="review-scores">
            {t("ryc.review.scores", {
              recommendation: r.recommendation,
              // Non-null inside this branch: `recommendation !== null` guards
              // it, and FR-D15 keeps all three null together on the anonymous
              // path, never one without the others.
              workload: r.workloadVsEcts ?? 0,
              difficulty: r.difficulty ?? 0,
            })}
          </span>
        )}
      </header>
      <p className="review-body">{r.body}</p>
      {r.advice && (
        <p className="review-advice">
          <strong>{t("ryc.draft.advice")}</strong> {r.advice}
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
  const t = useT();
  return (
    <section className="reviews">
      <div className="reviews-head">
        <h3>{t("ryc.reviews.title")}</h3>
        <button type="button" className="primary" onClick={onWrite}>
          {t("ryc.reviews.write")}
        </button>
      </div>

      <Summary a={aggregate} />

      {aggregate.count === 0 && (
        <p className="empty">{t("ryc.reviews.none")}</p>
      )}

      {sessionRequired && aggregate.count > 0 && (
        <p className="notice">{t("ryc.reviews.locked")}</p>
      )}

      {reviews.map((r) => (
        <Review key={r.id} r={r} />
      ))}
    </section>
  );
}
