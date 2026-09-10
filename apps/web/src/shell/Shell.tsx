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
    </main>
  );
}
