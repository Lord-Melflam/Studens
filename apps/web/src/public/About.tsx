/**
 * Who is behind this, and what it is not.
 *
 * The disclaimer that used to sit in the app footer belongs here, in full.
 * Studens borrows the visual register of the institutions it serves, which
 * makes it easy to mistake for an institutional product. Borrowing colours is
 * ordinary; implying affiliation is not, so this page says it in words.
 */
import { linkProps } from "../router.js";

export function About() {
  return (
    <>
      <section className="page-head">
        <h1>À propos</h1>
        <p className="lede">
          Un projet indépendant, construit par des étudiants, pour des
          étudiants.
        </p>
      </section>

      <section className="band">
        <h2>Ce que Studens n&apos;est pas</h2>
        <ul className="facts warn">
          <li>
            <strong>Ce n&apos;est pas un projet d&apos;université.</strong>
            Studens n&apos;est affilié à aucune université ni haute école, n&apos;est
            mandaté par aucune, et ne parle au nom d&apos;aucune.
          </li>
          <li>
            <strong>Ce n&apos;est pas une source officielle.</strong> Les
            informations reprises des sites institutionnels le sont à titre
            indicatif. En cas de doute, la fiche officielle fait foi, et un lien
            vers elle est affiché à chaque fois.
          </li>
          <li>
            <strong>Ce n&apos;est pas un produit commercial.</strong> Pas de
            publicité, pas de revente de données, pas d&apos;abonnement.
          </li>
        </ul>
      </section>

      <section className="band alt">
        <h2>Ouvert, et vérifiable</h2>
        <div className="two-up">
          <div>
            <p>
              Le code est public sous licence MIT. La spécification aussi, avec
              le raisonnement derrière chaque décision: ce qui a été rejeté, ce
              que ça coûte, et ce qui ferait reconsidérer le choix.
            </p>
            <p>
              Cela vaut en particulier pour les garanties de vie privée. Une
              promesse qu&apos;on ne peut pas vérifier ne vaut que la confiance
              qu&apos;on accorde à celui qui la fait.
            </p>
          </div>
          <div className="callout">
            <h3>Contribuer</h3>
            <p>
              Les contributions extérieures sont les bienvenues. Tout le code
              est relu avant d&apos;être intégré.
            </p>
            <a
              className="ghost"
              href="https://github.com/Lord-Melflam/Studens"
              rel="noopener noreferrer"
            >
              Voir le dépôt
            </a>
          </div>
        </div>
      </section>

      <section className="band final">
        <a className="ghost big" {...linkProps("/confidentialite")}>
          Comment vos données sont traitées
        </a>
      </section>
    </>
  );
}
