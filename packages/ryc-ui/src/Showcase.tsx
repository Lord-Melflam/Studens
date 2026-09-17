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
 *   REAL, re-read out of the loaded catalogue on 2026-09-17: the code, the
 *   title "Projet 3", 5 credits, Q2, French, the contact hours, and the opening
 *   of the assessment text with its first weighting, verbatim and in French.
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
import { Blocks, CATALOGUE_LANG, CatalogueLanguageNote, type Block } from "./Prose.js";

/**
 * VERBATIM FROM THE CATALOGUE, and French on purpose.
 *
 * `ref.CourseOffering` for lepl1503, trimmed to what fits. It is a quotation of
 * what UCLouvain published, not copy written here, which is why it is not in
 * the three catalogues with everything else: translating it would make the one
 * real thing on this mock the one invented thing on it.
 *
 * It is also the whole product's situation in miniature. Every course page in
 * RYC shows French blocks under labels in the visitor's language, because the
 * crawl fetched the French edition. The mock showing exactly that is correct;
 * the mock showing it without saying so was the bug. `CatalogueLanguageNote`
 * says it, here and on the real page, in the visitor's language.
 *
 * Re-read from the loaded catalogue on 2026-09-17 and updated: the 2026
 * edition weights the written exam at 40%, the 2025 edition at 35%, and this
 * mock still carried the 2025 figure. It links to a page serving 2026, so the
 * two disagreed about the same course. A mock that quotes the catalogue has
 * to be re-read whenever the catalogue is.
 *
 * TRIMMED TO THE OPENING LINE AND THE FIRST ITEM. The stored field runs to
 * three items, a weighting paragraph with a list of its own, a paragraph on
 * generative AI and one on the second session.
 *
 * The hero clips this mock and fades it, deliberately, so that it reads as a
 * window rather than a diagram. The full field filled the whole frame and the
 * two reviews below it never appeared, which left the hero showing only the
 * part of a course page RYC did not write. A quotation may be cut short; it
 * may not be altered, and nothing here is.
 */
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
                t: "Examen écrit en session sur la maitrise de la programmation en langage C (40%)",
              },
            ],
          ],
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
            them are translated. */}
        <p className="ribbon">{t("ryc.mock.ribbon")}</p>

        <CatalogueLanguageNote />
        <div className="field">
          <dt>{t("ryc.course.assessment")}</dt>
          {/* `lang` for the same reason as on the real page: without it a
              screen reader on the English home page reads this French
              paragraph with English phonemes. */}
          <dd className="prose" lang={CATALOGUE_LANG}>
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
