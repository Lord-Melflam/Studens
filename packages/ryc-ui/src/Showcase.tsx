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
import { useT } from "@studens/i18n";
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
  const t = useT();
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
        {/* Real values from the real LEPL1503 page; only the labels around
            them are translated. The scraped assessment below stays French,
            because information published by an institution stays in the
            language it was published in. */}
        <p className="ribbon">{t("ryc.mock.ribbon")}</p>

        <div className="field">
          <dt>{t("ryc.course.assessment")}</dt>
          <dd className="prose">
            <Blocks blocks={ASSESSMENT} />
          </dd>
        </div>

        <div className="showcase-split">
          <span className="example-tag">{t("ryc.mock.example")}</span>
          <p>{t("ryc.mock.explain")}</p>
        </div>

        <article className="review review-named">
          <header>
            <span className="chip-named">marie.d</span>
            <span className="review-year">{t("ryc.mock.year", { years: "2024-2025" })}</span>
            <span className="review-scores">
              {t("ryc.review.scores", { recommendation: 5, workload: 4, difficulty: 4 })}
            </span>
          </header>
          <p className="review-body">{t("ryc.mock.named.body")}</p>
        </article>

        <article className="review review-anonymous">
          <header>
            <span className="chip-anon">{t("ryc.anonymous")}</span>
            <span className="review-year">{t("ryc.mock.year", { years: "2023-2024" })}</span>
          </header>
          <p className="review-body">{t("ryc.mock.anon.body")}</p>
        </article>
      </div>

      <figcaption className="showcase-caption">{t("ryc.mock.caption")}</figcaption>
    </figure>
  );
}
