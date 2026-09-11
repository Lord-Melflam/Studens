/**
 * The account control in the shell header.
 *
 * FR-B16: this file may not mention anything a module owns. It says who is
 * signed in and offers to sign out, and it knows nothing about courses or
 * reviews.
 *
 * FR-A7 makes real sign-in an OIDC redirect to Microsoft or Google, which is
 * not built. Until it is, the only way in is the development sign-in, and the
 * button for it appears ONLY when the API says that fence is open. In any
 * environment where it is closed, the endpoint answers 404 and this renders a
 * plain statement that signing in does not exist yet, rather than a dead button.
 */
import { useCallback, useEffect, useState } from "react";

interface SessionState {
  signedIn: boolean;
  emailDomain?: string;
  devSignInAvailable: boolean;
}

interface Provider {
  id: string;
  label: string;
}

export function Account() {
  const [state, setState] = useState<SessionState | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/session")
      .then((r) => (r.ok ? (r.json() as Promise<SessionState>) : null))
      .then(setState)
      .catch(() => setState(null));
    // Which providers this deployment can offer. Empty until the credentials
    // exist, and the buttons simply do not appear rather than failing on press.
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? (r.json() as Promise<{ providers: Provider[] }>) : null))
      .then((d) => setProviders(d?.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  useEffect(load, [load]);

  async function signIn() {
    setBusy(true);
    try {
      await fetch("/api/session/dev", { method: "POST" });
      load();
      // The catalogue is public, but what a signed-in member sees is not
      // (FR-D13), so the page is reloaded rather than patched in place.
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  if (state.signedIn) {
    return (
      <div className="account">
        {/* FR-A10: evidence of holding an address at a domain. Never described
            as proof of enrolment, here or anywhere. */}
        <span className="domain" title="adresse vérifiée chez ce domaine">
          {state.emailDomain}
        </span>
        <button type="button" onClick={() => void signOut()} disabled={busy}>
          se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="account">
      {providers.map((p) => (
        // A link, not a fetch: the browser must follow the redirect to the
        // provider itself, and an XHR cannot.
        <a key={p.id} className="signin" href={`/api/auth/${p.id}/start`}>
          se connecter avec {p.label}
        </a>
      ))}
      {state.devSignInAvailable && (
        <button type="button" onClick={() => void signIn()} disabled={busy}>
          se connecter <span className="dev">dev</span>
        </button>
      )}
      {providers.length === 0 && !state.devSignInAvailable && (
        <span className="domain">connexion pas encore disponible</span>
      )}
    </div>
  );
}
