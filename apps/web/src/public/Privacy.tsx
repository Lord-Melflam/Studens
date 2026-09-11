/**
 * FR-C12 in plain French, on a page anyone can read without an account.
 *
 * FR-C12 is the requirement that the limits of the anonymity guarantee are
 * DISCLOSED rather than glossed. Section 3.3 of the requirements works out the
 * arithmetic of the complement problem and concludes that the exposure cannot
 * be removed, only stated. This page is where it gets stated.
 *
 * It is deliberately not written as legal terms. Terms are read by nobody, and
 * a guarantee nobody understands is not a guarantee.
 */
import { linkProps } from "../router.js";

export function Privacy() {
  return (
    <>
      <section className="page-head">
        <h1>Ce que l&apos;anonymat protège, et ce qu&apos;il ne protège pas</h1>
        <p className="lede">
          Cette page dit les limites. Elle existe parce qu&apos;une garantie
          dont on ne donne que la moitié n&apos;en est pas une.
        </p>
      </section>

      <section className="band">
        <h2>Ce qui est vrai par construction</h2>
        <p className="band-lede">
          Ces points ne dépendent pas de notre bonne volonté. Ils dépendent de
          la façon dont la base de données est faite, ce qui est vérifiable dans
          le code.
        </p>
        <ul className="facts">
          <li>
            <strong>Une publication anonyme ne porte aucun identifiant de son
            auteur.</strong> Pas de colonne vide, pas de référence chiffrée: la
            table n&apos;a pas de champ pour ça.
          </li>
          <li>
            <strong>Elle est définitive.</strong> Ni modification, ni
            suppression par son auteur, jamais. C&apos;est la conséquence du
            point précédent, pas une règle que nous avons choisie.
          </li>
          <li>
            <strong>Nous ne pouvons pas la retrouver pour vous.</strong> Même
            avec un accès complet à la base, il n&apos;y a rien à joindre.
          </li>
          <li>
            <strong>Aucune information sur vous n&apos;apparaît dessus.</strong>
            Ni établissement, ni domaine d&apos;adresse, ni quoi que ce soit
            venant de votre profil.
          </li>
        </ul>
      </section>

      <section className="band alt">
        <h2>Ce que ça ne protège pas</h2>
        <ul className="facts warn">
          <li>
            <strong>Ce que vous écrivez peut vous désigner.</strong> Une
            tournure, un détail que seules trois personnes connaissent, une
            situation particulière: aucun système ne peut retirer ça d&apos;un
            texte que vous avez écrit vous-même.
          </li>
          <li>
            <strong>Publier sous son nom réduit l&apos;anonymat des autres.</strong>
            Si presque tout le monde signe, celles et ceux qui ne signent pas
            forment un groupe petit et facile à deviner. C&apos;est pourquoi les
            chiffres vous sont montrés avant que vous choisissiez: vous êtes la
            seule personne à savoir combien d&apos;autres auraient pu écrire la
            même chose.
          </li>
          <li>
            <strong>Nous comptons combien vous publiez.</strong> Une limite par
            période existe pour éviter les abus. Elle compte des publications,
            jamais lesquelles.
          </li>
          <li>
            <strong>Un modérateur peut retirer un contenu</strong> sans savoir
            qui l&apos;a écrit. C&apos;est nécessaire: un texte peut être
            diffamatoire ou nommer quelqu&apos;un qui n&apos;a pas demandé à
            l&apos;être.
          </li>
          <li>
            <strong>Créer un compte est ouvert à tous.</strong> Rien ne vérifie
            que vous êtes inscrit quelque part. Les limites portent donc sur des
            comptes, pas sur des personnes, et nous ne les présentons pas comme
            plus que ça.
          </li>
        </ul>
      </section>

      <section className="band">
        <h2>Ce que nous gardons sur vous</h2>
        <p className="band-lede">
          Le strict nécessaire, et rien qui serve à vous identifier auprès de
          quelqu&apos;un d&apos;autre.
        </p>
        <ul className="facts">
          <li>
            L&apos;identifiant que votre fournisseur (Microsoft ou Google) nous
            donne, qui ne dit rien de vous par lui-même.
          </li>
          <li>
            <strong>Le domaine</strong> de votre adresse, par exemple
            <code> uclouvain.be</code>, jamais l&apos;adresse elle-même. Nous ne
            gardons pas non plus le nom que votre fournisseur nous envoie.
          </li>
          <li>Le pseudonyme que vous choisissez, et vos préférences.</li>
        </ul>
        <p className="band-fine">
          Le domaine est une indication, pas une preuve d&apos;inscription, et
          n&apos;est jamais présenté comme telle.
        </p>
      </section>

      <section className="band final">
        <p className="band-lede">
          Le raisonnement complet, y compris l&apos;arithmétique, est public
          dans le dépôt.
        </p>
        <a
          className="ghost big"
          href="https://github.com/Lord-Melflam/Studens/blob/main/docs/requirements.md"
          rel="noopener noreferrer"
        >
          Lire la spécification
        </a>
        <p className="band-fine">
          <a {...linkProps("/a-propos")}>À propos de ce projet</a>
        </p>
      </section>
    </>
  );
}
