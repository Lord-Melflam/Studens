/**
 * FR-C12, on a page anyone can read without an account.
 *
 * FR-C12 is the requirement that the limits of the anonymity guarantee are
 * DISCLOSED rather than glossed. Section 3.3 of the requirements works out the
 * arithmetic of the complement problem and concludes that the exposure cannot
 * be removed, only stated. This page is where it gets stated.
 *
 * It is deliberately not written as legal terms. Terms are read by nobody, and
 * a guarantee nobody understands is not a guarantee.
 *
 * IN THREE LANGUAGES, like everything else. It was French only until
 * 2026-09-13, which was worse here than anywhere: this is the page that carries
 * the promise, and a Dutch speaker reading a French promise has been told
 * nothing. Every sentence with bold in it is two keys, a heading and a body,
 * because the translator interpolates values and not markup.
 */
import { useT } from "@studens/i18n";
import { linkProps } from "../router.js";

/** A claim and its explanation. The bold half is the claim. */
function Fact({ id }: { id: string }) {
  const t = useT();
  return (
    <li>
      <strong>{t(`${id}.claim`)}</strong> {t(`${id}.body`)}
    </li>
  );
}

export function Privacy() {
  const t = useT();
  return (
    <>
      <section className="page-head">
        <h1>{t("privacy.title")}</h1>
        <p className="lede">{t("privacy.lede")}</p>
      </section>

      <section className="band">
        <h2>{t("privacy.built.title")}</h2>
        <p className="band-lede">{t("privacy.built.lede")}</p>
        <ul className="facts">
          <Fact id="privacy.built.noid" />
          <Fact id="privacy.built.final" />
          <Fact id="privacy.built.unfindable" />
          <Fact id="privacy.built.nothing" />
        </ul>
      </section>

      <section className="band alt">
        <h2>{t("privacy.limits.title")}</h2>
        <ul className="facts warn">
          <Fact id="privacy.limits.words" />
          <Fact id="privacy.limits.complement" />
          <Fact id="privacy.limits.counting" />
          <Fact id="privacy.limits.moderation" />
          <Fact id="privacy.limits.open" />
        </ul>
      </section>

      <section className="band">
        <h2>{t("privacy.keep.title")}</h2>
        <p className="band-lede">{t("privacy.keep.lede")}</p>
        <ul className="facts">
          <li>{t("privacy.keep.subject")}</li>
          <Fact id="privacy.keep.domain" />
          <li>{t("privacy.keep.chosen")}</li>
          {/* OPEN-36 did not move when FR-A11 did: the address is kept now, the
              provider's display name is still not, and there is no column it
              could go in. */}
          <li>{t("privacy.keep.notname")}</li>
        </ul>
        {/* FR-A15. A page that lists what is held and does not say how to get
            it back or get rid of it is only half the disclosure. */}
        <p className="band-fine">{t("privacy.keep.rights")}</p>
        <p className="band-fine">{t("privacy.keep.fine")}</p>
      </section>

      <section className="band final">
        <p className="band-lede">{t("privacy.spec.lede")}</p>
        <a
          className="ghost big"
          href="https://github.com/Lord-Melflam/Studens/blob/main/docs/requirements.md"
          rel="noopener noreferrer"
        >
          {t("privacy.spec.cta")}
        </a>
        <p className="band-fine">
          <a {...linkProps("/a-propos")}>{t("privacy.about")}</a>
        </p>
      </section>
    </>
  );
}
