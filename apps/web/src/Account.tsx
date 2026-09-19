/**
 * The account control, used in BOTH headers.
 *
 * It used to live only in the app shell, which produced the thing François hit
 * the first time he signed in with a real Google account: the callback landed
 * him on the public home page, the public header knew nothing about sessions,
 * so it still offered "Se connecter" and "Créer un compte" and gave no way in.
 * He had signed in successfully and the product said nothing.
 *
 * A public page must never REQUIRE a session (FR-F2). Reflecting one is a
 * different thing, and not doing so is how a product loses somebody it has just
 * persuaded to join.
 *
 * FR-B16: this file may not mention anything a module owns. It says who is
 * signed in and offers a way in or out, and knows nothing about courses.
 */
import { useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { linkProps } from "./router.js";
import { useSession } from "./session.js";

interface Provider {
  id: string;
  label: string;
}

export function Account({
  variant = "app",
  here = false,
  signOutTo,
}: {
  variant?: "app" | "public";
  /**
   * Whether these buttons lead to the page already on screen.
   *
   * Both go to `/connexion`, so on that page they were two invitations to go
   * where the visitor already was, and the filled one was the loudest thing in
   * the header. Marked current, they stop asking.
   */
  here?: boolean;
  /**
   * Where to land after signing out, when staying put would be wrong.
   *
   * Signing out is a full page load, not a state change, so a screen that only
   * exists for somebody signed in cannot get out of the way by reacting to the
   * session: the page comes back fresh on the same URL with nobody signed in.
   * That is how signing out of the console kept answering "Unknown module".
   *
   * The caller decides, because only it knows whether its screen survives
   * signing out. A course page does and should stay where it is; the console
   * does not. This file learns nothing about either.
   */
  signOutTo?: string;
}) {
  const t = useT();
  const { session: state, reload } = useSession();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Which providers this deployment can offer. Empty until the credentials
    // exist, and the buttons simply do not appear rather than failing on press.
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? (r.json() as Promise<{ providers: Provider[] }>) : null))
      .then((d) => setProviders(d?.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  async function signIn() {
    setBusy(true);
    try {
      const r = await fetch("/api/session/dev", { method: "POST" });
      // Suspended: no session, and the screen that says why.
      if (r.status === 403) {
        window.location.assign("/suspendu");
        return;
      }
      reload();
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
      // `assign` rather than `reload` where the caller named a destination, so
      // the URL of a screen that needs a session is left behind rather than
      // reloaded into a state that cannot render it.
      if (signOutTo) window.location.assign(signOutTo);
      else window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  // While the session is still being fetched, the public header renders its
  // signed-out state rather than nothing. Signed out is the common case, it is
  // what a crawler sees (it runs no fetch), and rendering nothing first makes
  // the navigation jump once the answer arrives.
  if (!state && variant === "app") return null;

  if (state?.signedIn) {
    return (
      <div className="account">
        {/* On the public site, the useful thing for someone already signed in
            is the way in, not their own domain. */}
        {variant === "public" && (
          <a className="cta" {...linkProps("/app")}>
            {t("nav.enter")}
          </a>
        )}
        {/*
          The username once there is one, and the domain until then. Not both:
          the header is not a profile, and a member who has chosen a name has
          told us what they want to be called.

          FR-A10: the domain is evidence of holding an address there, and is
          never described as proof of enrolment, here or anywhere.
        */}
        {/*
          A NAME IS NOT A DOMAIN, and it used to be drawn as one: both went
          through `.domain`, which is muted grey text, so somebody's own
          username sat in the bar looking like a caption. François, after the
          ULB session: "The pseudo on every pages, for example lordmelflam, has
          a look issue. Just sitting there like a simple text (might be
          confusing)."

          The name is who you are here, so it is drawn as a thing rather than
          as a label: an initial and the name. The domain keeps the quiet
          treatment, because it IS a caption, and FR-A10 wants it read as weak
          evidence rather than as an identity.
        */}
        {state.username ? (
          <span className="whoami" title={t("nav.whoami.hint")}>
            <span className="whoami-mark" aria-hidden="true">
              {state.username.slice(0, 1).toUpperCase()}
            </span>
            {state.username}
          </span>
        ) : (
          <span className="domain" title={t("nav.domain.hint")}>
            {state.emailDomain}
          </span>
        )}
        <button type="button" onClick={() => void signOut()} disabled={busy}>
          {t("nav.signout")}
        </button>
      </div>
    );
  }

  // Signed out on the PUBLIC site: two labels, one destination (FR-F3). The
  // provider buttons live on /connexion, so the header stays a header.
  if (variant === "public") {
    return (
      <div className="account">
        <a
          className={here ? "ghost here" : "ghost"}
          aria-current={here ? "page" : undefined}
          {...linkProps("/connexion")}
        >
          {t("nav.signin")}
        </a>
        <a
          className={here ? "cta here" : "cta"}
          aria-current={here ? "page" : undefined}
          {...linkProps("/connexion")}
        >
          {t("nav.register")}
        </a>
      </div>
    );
  }

  // Signed out inside the app: offer the providers directly, since somebody
  // here has already decided to come in.
  return (
    <div className="account">
      {providers.map((p) => (
        // A link, not a fetch: the browser must follow the redirect to the
        // provider itself, and an XHR cannot.
        <a key={p.id} className="signin" href={`/api/auth/${p.id}/start`}>
          {t("signin.with", { provider: p.label })}
        </a>
      ))}
      {state?.devSignInAvailable && (
        <button type="button" onClick={() => void signIn()} disabled={busy}>
          {t("nav.signin")} <span className="dev">dev</span>
        </button>
      )}
      {providers.length === 0 && !state?.devSignInAvailable && (
        <span className="domain">{t("signin.none")}</span>
      )}
    </div>
  );
}
