/**
 * The first page a stranger sees.
 *
 * Its job is to be understood by someone who has never heard of this, in the
 * order they will ask: what is it, what problem does it solve, how does it
 * work, can I trust it with what I write, and what does it cost me.
 *
 * Every concrete claim about a module comes from that module's own
 * `presentation`. This file knows there are modules and nothing more.
 */
import { modules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Landing() {
  const live = modules.filter((m) => m.presentation.status === "live");
  const first = live[0] ?? modules[0];

  return (
    <>
      <section className="hero">
        <p className="kicker">Pour les étudiants de l&apos;enseignement supérieur</p>
        <h1>
          Ce que personne ne vous dit
          <br />
          avant de choisir.
        </h1>
        <p className="lede">
          Studens rassemble, au même endroit et de façon durable, ce que les
          étudiants savent déjà et se répètent chaque année. Gratuit, indépendant,
          et ouvert.
        </p>
        <div className="hero-actions">
          <a className="cta big" {...linkProps("/connexion")}>
            Créer un compte
          </a>
          <a className="ghost big" {...linkProps("/modules")}>
            Voir ce que ça fait
          </a>
        </div>
        <p className="hero-fine">
          Connexion avec votre compte Microsoft ou Google. Aucun mot de passe à
          retenir, et rien à installer.
        </p>
      </section>

      {first && (
        <section className="band">
          <h2>{first.presentation.problem.title}</h2>
          <div className="prose-cols">
            {first.presentation.problem.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {first && (
        <section className="band alt">
          <h2>Comment ça marche</h2>
          <ol className="steps-grid">
            {first.presentation.steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="band">
        <h2>Ce qui existe, et ce qui n&apos;existe pas encore</h2>
        <p className="band-lede">
          Rien n&apos;est affiché ici comme disponible tant que ça ne l&apos;est
          pas. Une petite chose qui marche vraiment vaut mieux qu&apos;une grande
          qui ne marche pas.
        </p>
        <ul className="module-cards">
          {modules.map((m) => (
            <li key={m.id} className={m.presentation.status}>
              <div className="mc-head">
                <h3>{m.name}</h3>
                <span className="badge">
                  {m.presentation.status === "live" ? "disponible" : "à venir"}
                </span>
              </div>
              <p className="mc-summary">{m.summary}</p>
              <p className="mc-note">{m.presentation.statusNote}</p>
            </li>
          ))}
        </ul>
        <p className="band-fine">
          D&apos;autres suivront, en fonction de ce dont les étudiants ont
          réellement besoin, pas d&apos;une feuille de route décidée à
          l&apos;avance.
        </p>
      </section>

      {/*
        The anonymity pitch is the hardest thing on this page to write
        honestly. FR-C12 requires the limits to be stated, not just the
        promise, so the summary here links to the page that states them rather
        than claiming more than the design can deliver.
      */}
      <section className="band alt">
        <h2>Dire les choses sans les payer</h2>
        <div className="two-up">
          <div>
            <p>
              Vous choisissez, à chaque publication, entre votre nom et
              l&apos;anonymat. L&apos;anonymat n&apos;est pas un réglage de
              confiance: ce que vous publiez anonymement n&apos;est relié à
              votre compte nulle part, pas même dans notre base de données.
            </p>
            <p>
              C&apos;est aussi définitif. Personne ne peut le modifier ni le
              retirer, y compris nous, parce que personne ne peut savoir lequel
              est le vôtre.
            </p>
          </div>
          <div className="callout">
            <h3>Ce que ça ne protège pas</h3>
            <p>
              Aucune garantie n&apos;est absolue, et nous préférons le dire ici
              plutôt que dans des conditions que personne ne lit.
            </p>
            <a className="ghost" {...linkProps("/confidentialite")}>
              Lire les limites
            </a>
          </div>
        </div>
      </section>

      <section className="band final">
        <h2>Commencer</h2>
        <p className="band-lede">
          Un compte prend moins d&apos;une minute et ne demande ni mot de passe
          ni carte bancaire.
        </p>
        <a className="cta big" {...linkProps("/connexion")}>
          Créer un compte
        </a>
      </section>
    </>
  );
}
