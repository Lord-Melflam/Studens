/**
 * The shell.
 *
 * FR-B17: a Member arrives HERE, not inside a module. Landing directly in RYC
 * was a development convenience and is not the product.
 *
 * This file knows nothing about courses, reviews, ECTS or programmes. If it
 * ever does, the boundary in FR-B16 has been lost.
 */
import { modules } from "./registry.js";
import { navigate, useRoute } from "./route.js";

function Home() {
  return (
    <>
      <p className="lede">
        Studens rassemble des outils pour les étudiants. Choisissez un module.
      </p>
      <ul className="modules">
        {modules.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => navigate(m.id)}>
              <span className="name">{m.name}</span>
              <span className="summary">{m.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="footnote">
        D&apos;autres modules suivront. Rien n&apos;est affiché ici tant qu&apos;il
        n&apos;existe pas.
      </p>
    </>
  );
}

export function Shell() {
  const routeId = useRoute();
  const active = modules.find((m) => m.id === routeId) ?? null;
  const Module = active?.component;

  return (
    <main>
      <header>
        <button type="button" className="brand" onClick={() => navigate(null)}>
          Studens
        </button>
        {active && (
          <nav className="crumbs">
            <button type="button" onClick={() => navigate(null)}>
              modules
            </button>
            <span aria-hidden="true">/</span>
            <span className="here">{active.name}</span>
          </nav>
        )}
      </header>

      {routeId && !active ? (
        <p className="error">
          Module inconnu: « {routeId} ».{" "}
          <button type="button" className="linkish" onClick={() => navigate(null)}>
            retour aux modules
          </button>
        </p>
      ) : Module ? (
        <Module />
      ) : (
        <Home />
      )}

      {/*
        Studens borrows the visual register of the institutions it serves, and a
        per-institution theme is planned. That makes it easy to mistake for an
        institutional product, and it is not one. Borrowing colours is ordinary;
        implying affiliation is not, so this line carries in words what a colour
        cannot. See docs/design/frontend-design.tex, section 2.

        The wording deliberately says nothing about what the modules do. The
        first draft said "the institutions whose courses it lists", which the
        FR-B16 gate rejected: that is RYC's domain, and it would be wrong the
        day MPA ships. The gate improved the copy.
      */}
      <footer className="disclaimer">
        Studens est un projet indépendant. Il n&apos;est affilié à aucune
        université ni haute école.
      </footer>
    </main>
  );
}
