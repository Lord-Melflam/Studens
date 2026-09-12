/**
 * The first page a stranger sees.
 *
 * STUDENS SPEAKS FIRST. An earlier draft let the module supply the hero, the
 * problem and the whole spine, and the result read as a course review site with
 * a platform bolted underneath. That is backwards: Studens is the thing that
 * accumulates, and a module is what it accumulates into. The day MPA ships, a
 * landing page built on RYC's pitch would have to be rewritten rather than
 * extended.
 *
 * So the platform makes the platform's claim, and modules appear as what is
 * inside it. The one that is built gets a section of its own, in its own words,
 * clearly labelled as the first module rather than as the product.
 */
import { useT } from "@studens/i18n";
import { presentModules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Landing() {
  const t = useT();
  const modules = presentModules(t);
  const live = modules.filter((m) => m.presentation.status === "live");
  const first = live[0];
  const p = first?.presentation;
  const Mock = p?.showcase;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="kicker">{t("hero.kicker")}</p>
          <h1>
            {t("hero.title.1")}
            <br />
            {t("hero.title.2")}
          </h1>
          <p className="lede">{t("hero.lede")}</p>
          <div className="hero-actions">
            <a className="cta big" {...linkProps("/connexion")}>
              {t("nav.register")}
            </a>
            <a className="ghost big" {...linkProps("/modules")}>
              {t("hero.secondary")}
            </a>
          </div>
          <p className="hero-fine">{t("hero.fine")}</p>
        </div>
        {Mock && (
          <div className="hero-mock">
            <Mock />
          </div>
        )}
      </section>

      <section className="band alt">
        <p className="eyebrow">{t("why.eyebrow")}</p>
        <h2>{t("why.title")}</h2>
        <div className="prose-cols">
          <p>{t("why.p1")}</p>
          <p>{t("why.p2")}</p>
          <p>{t("why.p3")}</p>
        </div>
      </section>

      <section className="band">
        <p className="eyebrow">{t("inside.eyebrow")}</p>
        <h2>{t("inside.title")}</h2>
        <p className="band-lede">{t("inside.lede")}</p>
        <ul className="module-cards">
          {modules.map((m) => (
            <li key={m.id} className={m.presentation.status}>
              <div className="mc-head">
                <h3>{m.name}</h3>
                <span className="badge">
                  {t(m.presentation.status === "live" ? "inside.available" : "inside.planned")}
                </span>
              </div>
              <p className="mc-summary">{m.summary}</p>
              <p className="mc-note">{m.presentation.statusNote}</p>
              {m.presentation.status === "live" && (
                <a className="mc-more" {...linkProps("/modules")}>
                  {t("inside.more")}
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="band-fine">{t("inside.fine")}</p>
      </section>

      {/* The first module, in its own words. Not the product. */}
      {p?.problem && (
        <section className="band alt">
          <p className="eyebrow">{t("first.eyebrow", { name: first?.name ?? "" })}</p>
          <h2>{p.problem.title}</h2>
          <div className="prose-cols">
            {p.problem.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {p.steps && (
            <ol className="steps-grid">
              {p.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          )}
          <a className="cta" {...linkProps("/modules")}>
            {t("first.cta", { name: first?.name ?? "" })}
          </a>
        </section>
      )}

      <section className="band">
        <p className="eyebrow">{t("promises.eyebrow")}</p>
        <h2>{t("promises.title")}</h2>
        <ul className="highlights">
          <li>
            <h3>{t("promises.sign.title")}</h3>
            <p>{t("promises.sign.body")}</p>
          </li>
          <li>
            <h3>{t("promises.independent.title")}</h3>
            <p>{t("promises.independent.body")}</p>
          </li>
          <li>
            <h3>{t("promises.free.title")}</h3>
            <p>{t("promises.free.body")}</p>
          </li>
          <li>
            <h3>{t("promises.open.title")}</h3>
            <p>{t("promises.open.body")}</p>
          </li>
        </ul>
        <a className="ghost" {...linkProps("/confidentialite")}>
          Ce que l&apos;anonymat ne protège pas
        </a>
      </section>

      <section className="band alt">
        <p className="eyebrow">{t("start.eyebrow")}</p>
        <h2>{t("start.title")}</h2>
        <ol className="process">
          <li>
            <span className="pr-n">01</span>
            <h3>{t("start.1.title")}</h3>
            <p>{t("start.1.body")}</p>
          </li>
          <li>
            <span className="pr-n">02</span>
            <h3>{t("start.2.title")}</h3>
            <p>{t("start.2.body")}</p>
          </li>
          {p?.firstAction && (
            <li>
              <span className="pr-n">03</span>
              <h3>{p.firstAction.title}</h3>
              <p>{p.firstAction.body}</p>
            </li>
          )}
        </ol>
        <a className="cta big" {...linkProps("/connexion")}>
          Créer un compte
        </a>
      </section>
    </>
  );
}
