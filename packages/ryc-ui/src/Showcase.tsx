/**
 * What RYC looks like, for someone who has no account.
 *
 * Owned by the module: FR-B16 stops `apps/web` knowing what a course page
 * looks like, and a mock drawn in the shell would break that as surely as
 * prose would. Built from the real components and the real CSS, so it cannot
 * drift into showing a screen the product does not have.
 *
 * WHAT IS REAL AND WHAT IS NOT, because the first version of this file got it
 * wrong and invented both.
 *
 *   REAL, read out of the loaded catalogue on 2026-09-12: the code, the title
 *   "Projet 3", 5 credits, Q2, French, the contact hours, and the assessment
 *   text with its weightings and its second-session rule, verbatim.
 *
 *   NOT REAL: the reviews and the averages. Nobody has written a review yet,
 *   so there is nothing real to show, and the alternative to an example is an
 *   empty screen that teaches a visitor nothing.
 *
 * The difference is stated ON the mock rather than in this comment. A product
 * that asks people to trust an anonymity guarantee cannot illustrate itself
 * with numbers that look measured and are not. An earlier draft showed
 * "4.1 sur 23 avis" beside a course whose credits were also invented, which is
 * exactly the failure this project keeps recording elsewhere: presenting
 * something as real because it reads better.
 */
import { Blocks, type Block } from "./Prose.js";

/** Verbatim from ref.CourseOffering for lepl1503, trimmed to what fits. */
const ASSESSMENT: Block[] = [
  {
    kind: "p",
    lines: [[{ t: "Dans le cadre de ce cours, les étudiant·es sont évalué·es par :" }]],
  },
  {
    kind: "list",
    ordered: false,
    items: [
      [
        {
          kind: "p",
          lines: [
            [
              {
                t: "Examen écrit en session sur la maitrise de la programmation en langage C (35%)",
              },
            ],
          ],
        },
      ],
      [
        {
          kind: "p",
          lines: [
            [
              {
                t: "Evaluation du travail de groupe sur base du projet rendu et de sa documentation (55%).",
              },
            ],
          ],
        },
      ],
      [
        {
          kind: "p",
          lines: [[{ t: "Participation aux séances de travail de groupe (5%)" }]],
        },
      ],
      [
        {
          kind: "p",
          lines: [[{ t: "Peer-review de projets d'autres groupes d'étudiants (5%)" }]],
        },
      ],
    ],
  },
  {
    kind: "p",
    lines: [
      [
        {
          t: "En seconde session, seul l'examen peut être refait. Les résultats du travail de groupe et des peer-reviews ne peuvent pas être modifiés.",
        },
      ],
    ],
  },
];

export function Showcase() {
  return (
    <figure className="showcase">
      <div className="showcase-bar" aria-hidden="true">
        <span className="sb-dot" />
        <span className="sb-dot" />
        <span className="sb-dot" />
        <span className="sb-url">studens.be/app/ryc</span>
      </div>

      <div className="showcase-body">
        <h3>
          <span className="code">LEPL1503</span> Projet 3
        </h3>
        <p className="ribbon">5 ECTS · Q2 · Français · 30.0 h + 30.0 h</p>

        <div className="field">
          <dt>Évaluation</dt>
          <dd className="prose">
            <Blocks blocks={ASSESSMENT} />
          </dd>
        </div>

        <div className="showcase-split">
          <span className="example-tag">exemple</span>
          <p>
            Personne n&apos;a encore publié d&apos;avis. Ci-dessous, à quoi
            ressemblera cette partie.
          </p>
        </div>

        <article className="review review-named">
          <header>
            <span className="chip-named">marie.d</span>
            <span className="review-year">suivi en 2024-2025</span>
            <span className="review-scores">recommandé 5/5 · charge 4/5 · difficulté 4/5</span>
          </header>
          <p className="review-body">
            Le projet est long mais c&apos;est là que j&apos;ai le plus appris.
            Commencez l&apos;architecture la première semaine, pas la troisième.
          </p>
        </article>

        <article className="review review-anonymous">
          <header>
            <span className="chip-anon">Anonyme</span>
            <span className="review-year">suivi en 2023-2024</span>
          </header>
          <p className="review-body">
            Beaucoup de travail non encadré en dehors des séances, et le barème
            du travail de groupe mérite d&apos;être lu en entier avant de
            s&apos;inscrire.
          </p>
        </article>
      </div>

      <figcaption className="showcase-caption">
        La fiche du cours est réelle, reprise du catalogue UCLouvain. Les deux
        avis sont fictifs : il n&apos;y en a pas encore.
      </figcaption>
    </figure>
  );
}
