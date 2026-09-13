/**
 * Who is behind this, and what it is not.
 *
 * The disclaimer that used to sit in the app footer belongs here, in full.
 * Studens borrows the visual register of the institutions it serves, which
 * makes it easy to mistake for an institutional product. Borrowing colours is
 * ordinary; implying affiliation is not, so this page says it in words.
 *
 * The bold claim and its explanation are two keys: the translator interpolates
 * values, not markup, and a sentence cut in half by a tag cannot be reordered
 * by a translator who needs to.
 */
import { useT } from "@studens/i18n";
import { linkProps } from "../router.js";

function Fact({ id }: { id: string }) {
  const t = useT();
  return (
    <li>
      <strong>{t(`${id}.claim`)}</strong> {t(`${id}.body`)}
    </li>
  );
}

export function About() {
  const t = useT();
  return (
    <>
      <section className="page-head">
        <h1>{t("about.title")}</h1>
        <p className="lede">{t("about.lede")}</p>
      </section>

      <section className="band">
        <h2>{t("about.not.title")}</h2>
        <ul className="facts warn">
          <Fact id="about.not.university" />
          <Fact id="about.not.official" />
          <Fact id="about.not.commercial" />
        </ul>
      </section>

      <section className="band alt">
        <h2>{t("about.open.title")}</h2>
        <div className="two-up">
          <div>
            <p>{t("about.open.1")}</p>
            <p>{t("about.open.2")}</p>
          </div>
          <div className="callout">
            <h3>{t("about.contribute.title")}</h3>
            <p>{t("about.contribute.body")}</p>
            <a
              className="ghost"
              href="https://github.com/Lord-Melflam/Studens"
              rel="noopener noreferrer"
            >
              {t("about.contribute.cta")}
            </a>
          </div>
        </div>
      </section>

      <section className="band final">
        <a className="ghost big" {...linkProps("/confidentialite")}>
          {t("about.privacy.cta")}
        </a>
      </section>
    </>
  );
}
