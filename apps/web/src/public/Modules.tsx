/**
 * What the product does, module by module.
 *
 * Every word about a module comes from the module. This file arranges them.
 */
import { modules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Modules() {
  return (
    <>
      <section className="page-head">
        <h1>Ce que ça fait</h1>
        <p className="lede">
          Studens est fait de modules. Chacun résout un problème précis, et
          n&apos;apparaît ici que lorsqu&apos;il fonctionne.
        </p>
      </section>

      {modules.map((m) => (
        <section key={m.id} className="band module-detail">
          <div className="mc-head">
            <h2>{m.name}</h2>
            <span className="badge">
              {m.presentation.status === "live" ? "disponible" : "à venir"}
            </span>
          </div>
          <p className="band-lede">{m.summary}</p>
          <p className="mc-note">{m.presentation.statusNote}</p>

          <h3>{m.presentation.problem.title}</h3>
          <div className="prose-cols">
            {m.presentation.problem.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <ol className="steps-grid">
            {m.presentation.steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-n">{i + 1}</span>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="band final">
        <a className="cta big" {...linkProps("/connexion")}>
          Créer un compte
        </a>
      </section>
    </>
  );
}
