/**
 * One screen for signing in and for creating an account, because FR-F3 says
 * they are the same act: registration is open (FR-A6) and there are no
 * passwords (FR-A7), so a provider subject we have not seen becomes a Member.
 *
 * The providers come from the API. When none is configured the buttons do not
 * appear at all, rather than appearing and failing, and the page says so.
 */
import { useEffect, useState } from "react";
import { linkProps } from "../router.js";

interface Provider {
  id: string;
  label: string;
}

export function SignIn() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [dev, setDev] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? (r.json() as Promise<{ providers: Provider[] }>) : null))
      .then((d) => setProviders(d?.providers ?? []))
      .catch(() => setProviders([]));
    fetch("/api/session")
      .then((r) => (r.ok ? (r.json() as Promise<{ devSignInAvailable: boolean }>) : null))
      .then((d) => setDev(d?.devSignInAvailable ?? false))
      .catch(() => setDev(false));
  }, []);

  async function devSignIn() {
    await fetch("/api/session/dev", { method: "POST" });
    window.location.assign("/app");
  }

  return (
    <section className="signin">
      <h1>Entrer</h1>
      <p className="lede">
        Pas de mot de passe à créer ni à retenir. Vous utilisez un compte que
        vous avez déjà, et nous n&apos;en voyons jamais le mot de passe.
      </p>

      <div className="signin-buttons">
        {providers?.map((p) => (
          // A real link: the browser has to leave for the provider, which an
          // in-page request cannot do.
          <a key={p.id} className="provider" href={`/api/auth/${p.id}/start`}>
            Continuer avec {p.label}
          </a>
        ))}

        {providers?.length === 0 && !dev && (
          <p className="notice">
            La connexion n&apos;est pas encore ouverte sur cette installation.
          </p>
        )}

        {dev && (
          <button type="button" className="provider dev" onClick={() => void devSignIn()}>
            Continuer en mode développement
            <span className="dev-tag">dev</span>
          </button>
        )}
      </div>

      <p className="signin-fine">
        En continuant, vous créez un compte si vous n&apos;en avez pas encore.
        Nous conservons le domaine de votre adresse, jamais l&apos;adresse
        elle-même, et pas votre nom.{" "}
        <a {...linkProps("/confidentialite")}>Ce que ça implique</a>.
      </p>
    </section>
  );
}
