/**
 * What RYC looks like, for someone who has no account.
 *
 * A static mock, owned by the module. The public zone places it and cannot
 * read it: FR-B16 forbids `apps/web` from knowing what a course or a review
 * is, and a screenshot of RYC drawn in the shell would break that as surely as
 * prose would.
 *
 * Honest by construction: it is built from the same components and the same
 * CSS as the real screen, so it cannot drift into showing something the
 * product does not do. In particular the anonymous review below carries no
 * numbers and no author, because that is what the server actually returns
 * (FR-D15, FR-C16). A marketing mock that showed them would be advertising a
 * different product.
 */
import { Blocks } from "./Prose.js";

const ASSESSMENT = [
  { kind: "p" as const, lines: [[{ t: "L’évaluation se fait sur base de deux côtes :" }]] },
  {
    kind: "list" as const,
    ordered: false,
    items: [
      [{ kind: "p" as const, lines: [[{ t: "Examen écrit : 12 points" }]] }],
      [{ kind: "p" as const, lines: [[{ t: "Travail journalier : 8 points" }]] }],
    ],
  },
];

export function Showcase() {
  return (
    <div className="showcase" aria-hidden="true">
      <div className="showcase-bar">
        <span className="sb-dot" />
        <span className="sb-dot" />
        <span className="sb-dot" />
        <span className="sb-url">studens.be/app/ryc</span>
      </div>

      <div className="showcase-body">
        <h3>
          <span className="code">LEPL1503</span> Projet 3 : systèmes informatiques
        </h3>
        <p className="ribbon">6 ECTS · Q2 · Français · 2025-2026</p>

        <div className="stats">
          <div className="stat">
            <span className="stat-value">4.1</span>
            <span className="stat-label">recommandé</span>
            <span className="stat-scale">sur 5</span>
          </div>
          <div className="stat">
            <span className="stat-value">4.6</span>
            <span className="stat-label">charge / ECTS</span>
            <span className="stat-scale">sur 5</span>
          </div>
          <div className="stat">
            <span className="stat-value">3.8</span>
            <span className="stat-label">difficulté</span>
            <span className="stat-scale">sur 5</span>
          </div>
        </div>
        <p className="denominator">Sur 23 avis : 14 nommés, 9 anonymes.</p>

        <div className="field">
          <dt>Évaluation</dt>
          <dd className="prose">
            <Blocks blocks={ASSESSMENT} />
          </dd>
        </div>

        <article className="review review-named">
          <header>
            <span className="chip-named">marie.d</span>
            <span className="review-year">suivi en 2024-2025</span>
            <span className="review-scores">recommandé 5/5 · charge 4/5 · difficulté 4/5</span>
          </header>
          <p className="review-body">
            Le projet est long mais c’est le cours où j’ai le plus appris. Commencez
            l’architecture la première semaine, pas la troisième.
          </p>
        </article>

        <article className="review review-anonymous">
          <header>
            <span className="chip-anon">Anonyme</span>
            <span className="review-year">suivi en 2023-2024</span>
          </header>
          <p className="review-body">
            Beaucoup de travail non encadré en dehors des séances. Le barème n’a pas été
            annoncé avant la remise, et ça change tout.
          </p>
        </article>
      </div>
    </div>
  );
}
