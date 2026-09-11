/**
 * The first page a stranger sees.
 *
 * The order follows the questions someone actually asks, in the order they ask
 * them: what is this, what problem does it solve, how does it work, what does
 * it look like, what exists today, where does the information come from, can I
 * trust it with what I write, and how do I start.
 *
 * Every concrete claim comes from a module's own `presentation`, including the
 * mock. This file knows there are modules and nothing more (FR-B16).
 */
import { modules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Landing() {
  const live = modules.filter((m) => m.presentation.status === "live");
  const first = live[0] ?? modules[0];
  const p = first?.presentation;
  const Mock = p?.showcase;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="kicker">Pour les étudiants de l&apos;enseignement supérieur</p>
          <h1>
            Moins de temps à deviner.
            <br />
            Plus de temps à choisir.
          </h1>
          <p className="lede">
            Studens rassemble ce que les étudiants savent déjà et se répètent
            chaque année. Au même endroit, daté, et qui ne disparaît pas en
            septembre.
          </p>
          {/* The concrete promise is the module's to make, not the shell's. */}
          {first && <p className="hero-module">{first.summary}</p>}
          <div className="hero-actions">
            <a className="cta big" {...linkProps("/connexion")}>
              Créer un compte
            </a>
            <a className="ghost big" {...linkProps("/modules")}>
              Voir ce que ça fait
            </a>
          </div>
          <p className="hero-fine">
            Gratuit. Connexion avec votre compte Microsoft ou Google, aucun mot
            de passe à retenir, rien à installer.
          </p>
        </div>
        {Mock && (
          <div className="hero-mock">
            <Mock />
          </div>
        )}
      </section>

      {p && (
        <section className="band alt">
          <h2>{p.problem.title}</h2>
          <div className="prose-cols">
            {p.problem.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {p && (
        <section className="band">
          <p className="eyebrow">Comment ça marche</p>
          <h2>Trois étapes, et vous n&apos;écrivez qu&apos;à la troisième</h2>
          <ol className="steps-grid">
            {p.steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {p && (
        <section className="band alt">
          <p className="eyebrow">Ce que ça vous apporte</p>
          <h2>Les détails qui changent une décision</h2>
          <ul className="highlights">
            {p.highlights.map((h) => (
              <li key={h.title}>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </li>
            ))}
          </ul>
          <a className="cta" {...linkProps("/connexion")}>
            Créer un compte
          </a>
        </section>
      )}

      {p && (
        <section className="band sources">
          <p className="eyebrow">D&apos;où viennent les informations</p>
          <h2>{p.sources.title}</h2>
          <p className="band-lede">{p.sources.body}</p>
          <ul className="chips">
            {p.sources.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="band alt">
        <p className="eyebrow">Ce qui existe</p>
        <h2>Rien n&apos;est annoncé comme prêt tant que ça ne l&apos;est pas</h2>
        <p className="band-lede">
          Une petite chose qui fonctionne vraiment vaut mieux qu&apos;une grande
          qui ne fonctionne pas. Ce qui manque est écrit ici plutôt que promis.
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
              <a className="mc-more" {...linkProps("/modules")}>
                En savoir plus
              </a>
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
        FR-C12 requires the LIMITS to be stated, not only the promise. The
        summary here links to the page that states them rather than claiming
        more than the design can deliver.
      */}
      <section className="band">
        <p className="eyebrow">Dire les choses sans les payer</p>
        <h2>L&apos;anonymat est une garantie de structure, pas une promesse</h2>
        <div className="two-up">
          <div>
            <p>
              Vous choisissez, à chaque publication, entre votre nom et
              l&apos;anonymat. Ce que vous publiez anonymement n&apos;est relié à
              votre compte nulle part : la table n&apos;a pas de champ pour ça.
            </p>
            <p>
              C&apos;est aussi définitif. Personne ne peut le modifier ni le
              retirer, nous compris, parce que personne ne peut savoir lequel est
              le vôtre.
            </p>
            <p>
              <strong>Et aucun cookie d&apos;analyse.</strong> Il n&apos;y a rien
              à accepter en arrivant ici, parce qu&apos;il n&apos;y a rien qui
              vous suit.
            </p>
          </div>
          <div className="callout">
            <h3>Ce que ça ne protège pas</h3>
            <p>
              Aucune garantie n&apos;est absolue. Ce que vous écrivez peut vous
              désigner, et nous préférons l&apos;écrire ici plutôt que dans des
              conditions que personne ne lit.
            </p>
            <a className="ghost" {...linkProps("/confidentialite")}>
              Lire les limites
            </a>
          </div>
        </div>
      </section>

      <section className="band alt">
        <p className="eyebrow">Commencer</p>
        <h2>Moins d&apos;une minute</h2>
        <ol className="process">
          <li>
            <span className="pr-n">01</span>
            <h3>Vous vous connectez</h3>
            <p>
              Avec le compte Microsoft ou Google que vous avez déjà. Pas de mot
              de passe à créer, pas de carte bancaire, pas de vérification
              d&apos;inscription.
            </p>
          </li>
          <li>
            <span className="pr-n">02</span>
            <h3>Vous choisissez un pseudonyme</h3>
            <p>
              C&apos;est lui qui apparaît quand vous publiez quelque chose sous
              votre nom. Nous ne gardons pas le nom que votre fournisseur nous
              envoie, et du reste de votre profil, rien n&apos;est obligatoire.
            </p>
          </li>
          {p && (
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
