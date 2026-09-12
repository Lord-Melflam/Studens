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
import { modules } from "../shell/registry.js";
import { linkProps } from "../router.js";

export function Landing() {
  const live = modules.filter((m) => m.presentation.status === "live");
  const first = live[0];
  const p = first?.presentation;
  const Mock = p?.showcase;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="kicker">Pour les étudiants de l&apos;enseignement supérieur</p>
          <h1>
            Ce que les étudiants savent,
            <br />
            gardé quelque part.
          </h1>
          <p className="lede">
            Chaque année, les mêmes questions sont posées aux mêmes personnes, et
            les réponses disparaissent en trois semaines. Studens est
            l&apos;endroit où elles s&apos;accumulent au lieu de se perdre.
          </p>
          <div className="hero-actions">
            <a className="cta big" {...linkProps("/connexion")}>
              Créer un compte
            </a>
            <a className="ghost big" {...linkProps("/modules")}>
              Voir ce qu&apos;il y a dedans
            </a>
          </div>
          <p className="hero-fine">
            Gratuit, sans publicité. Connexion avec votre compte Microsoft ou
            Google, aucun mot de passe à retenir, rien à installer.
          </p>
        </div>
        {Mock && (
          <div className="hero-mock">
            <Mock />
          </div>
        )}
      </section>

      <section className="band alt">
        <p className="eyebrow">Pourquoi</p>
        <h2>Le savoir pratique des étudiants n&apos;est écrit nulle part</h2>
        <div className="prose-cols">
          <p>
            Comment s&apos;organiser, à quoi s&apos;attendre, ce qui vaut le coup
            et ce qui n&apos;en vaut pas la peine : tout ça existe déjà, chez
            celles et ceux qui sont passés par là avant vous.
          </p>
          <p>
            Mais ça vit dans des conversations, des serveurs Discord et des
            groupes qui changent chaque année. Personne ne l&apos;écrit, parce
            qu&apos;il n&apos;y a pas d&apos;endroit où l&apos;écrire, et donc
            chaque promotion recommence de zéro.
          </p>
          <p>
            Studens est fait pour que ça s&apos;accumule : daté, consultable, et
            toujours là l&apos;année suivante. Un outil à la fois, ajouté quand
            le besoin est constaté et pas avant.
          </p>
        </div>
      </section>

      <section className="band">
        <p className="eyebrow">Ce qu&apos;il y a dedans</p>
        <h2>Des modules, pas une application fourre-tout</h2>
        <p className="band-lede">
          Chaque module règle un problème précis et s&apos;utilise seul. Rien
          n&apos;est annoncé comme prêt tant que ça ne l&apos;est pas : ce qui
          manque est écrit ici plutôt que promis.
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
              {m.presentation.status === "live" && (
                <a className="mc-more" {...linkProps("/modules")}>
                  En savoir plus
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="band-fine">
          D&apos;autres suivront, en fonction de ce dont les étudiants ont
          réellement besoin, pas d&apos;une feuille de route décidée à
          l&apos;avance.
        </p>
      </section>

      {/* The first module, in its own words. Not the product. */}
      {p?.problem && (
        <section className="band alt">
          <p className="eyebrow">Le premier module · {first?.name}</p>
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
            Voir {first?.name} en détail
          </a>
        </section>
      )}

      <section className="band">
        <p className="eyebrow">Ce qui vaut pour tout Studens</p>
        <h2>Quatre choses qui ne changeront pas d&apos;un module à l&apos;autre</h2>
        <ul className="highlights">
          <li>
            <h3>Vous choisissez ce que vous signez</h3>
            <p>
              À chaque publication, votre nom ou l&apos;anonymat. Ce qui est
              publié anonymement n&apos;est relié à votre compte nulle part : la
              table n&apos;a pas de champ pour ça. C&apos;est une garantie de
              structure, pas une promesse.
            </p>
          </li>
          <li>
            <h3>Indépendant de toute institution</h3>
            <p>
              Studens n&apos;est mandaté par aucune université ni haute école, ne
              parle au nom d&apos;aucune, et n&apos;a de comptes à rendre à
              aucune.
            </p>
          </li>
          <li>
            <h3>Gratuit, et rien qui vous suive</h3>
            <p>
              Pas de publicité, pas de revente de données, pas
              d&apos;abonnement. Aucun cookie d&apos;analyse non plus : il
              n&apos;y a rien à accepter en arrivant ici, parce qu&apos;il
              n&apos;y a rien qui vous piste.
            </p>
          </li>
          <li>
            <h3>Vérifiable</h3>
            <p>
              Le code est public, et la spécification aussi, avec le
              raisonnement derrière chaque décision. Une promesse qu&apos;on ne
              peut pas vérifier ne vaut que la confiance accordée à celui qui la
              fait.
            </p>
          </li>
        </ul>
        <a className="ghost" {...linkProps("/confidentialite")}>
          Ce que l&apos;anonymat ne protège pas
        </a>
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
