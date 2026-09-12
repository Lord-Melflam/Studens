/**
 * One screen for signing in and for creating an account, because FR-F3 says
 * they are the same act: registration is open (FR-A6) and there are no
 * passwords (FR-A7), so a provider subject we have not seen becomes a Member.
 *
 * The providers come from the API. When none is configured the buttons do not
 * appear at all, rather than appearing and failing, and the page says so.
 */
import { useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { linkProps } from "../router.js";

interface Provider {
  id: string;
  label: string;
}

export function SignIn() {
  const t = useT();
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
      <h1>{t("signin.title")}</h1>
      <p className="lede">{t("signin.lede")}</p>

      <div className="signin-buttons">
        {providers?.map((p) => (
          // A real link: the browser has to leave for the provider, which an
          // in-page request cannot do.
          <a key={p.id} className="provider" href={`/api/auth/${p.id}/start`}>
            {t("signin.with", { provider: p.label })}
          </a>
        ))}

        {providers?.length === 0 && !dev && (
          <p className="notice">{t("signin.none")}</p>
        )}

        {dev && (
          <button type="button" className="provider dev" onClick={() => void devSignIn()}>
            {t("signin.dev")}
            <span className="dev-tag">dev</span>
          </button>
        )}
      </div>

      <p className="signin-fine">
        {t("signin.fine")}{" "}
        <a {...linkProps("/confidentialite")}>{t("signin.fine.link")}</a>.
      </p>
    </section>
  );
}
