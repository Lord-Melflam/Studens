/**
 * What the product does, module by module.
 *
 * Every word about a module comes from the module. This file arranges them.
 */
import { useT } from "@studens/i18n";
import { presentModules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Modules() {
  const t = useT();
  const modules = presentModules(t);
  return (
    <>
      <section className="page-head">
        <h1>{t("modules.title")}</h1>
        <p className="lede">{t("modules.lede")}</p>
      </section>

      {modules.map((m) => (
        <section key={m.id} className="band module-detail">
          <div className="mc-head">
            <h2>{m.name}</h2>
            <span className="badge">
              {t(m.presentation.status === "live" ? "inside.available" : "inside.planned")}
            </span>
          </div>
          <p className="band-lede">{m.summary}</p>
          <p className="mc-note">{m.presentation.statusNote}</p>

          {/* A planned module has a name, a line and a status, and nothing
              else. There is nothing honest to render here for one. */}
          {m.presentation.problem && (
            <>
              <h3>{m.presentation.problem.title}</h3>
              <div className="prose-cols">
                {m.presentation.problem.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </>
          )}

          {m.presentation.steps && (
            <ol className="steps-grid">
              {m.presentation.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="step-n">{i + 1}</span>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          )}

          {m.presentation.sources && (
            <div className="sources-inline">
              <h4>{m.presentation.sources.title}</h4>
              <p>{m.presentation.sources.body}</p>
              <ul className="chips">
                {m.presentation.sources.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {m.presentation.highlights && (
            <ul className="highlights">
              {m.presentation.highlights.map((h) => (
                <li key={h.title}>
                  <h4>{h.title}</h4>
                  <p>{h.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="band final">
        <a className="cta big" {...linkProps("/connexion")}>
          {t("nav.register")}
        </a>
      </section>
    </>
  );
}
