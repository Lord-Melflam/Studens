/**
 * The two providers, as configuration.
 *
 * Everything here except the secrets is public: issuers, scopes and which claim
 * carries the address are facts about Microsoft and Google, not about us. The
 * credentials come from the environment and are never defaulted, so a missing
 * one means the provider is simply not offered rather than half configured.
 *
 * FR-A7 settled the list. Adding a Belgian institution's own OIDC provider
 * later is another entry here plus a redirect URI, which is the whole point of
 * 1.5 item 2, "not assuming one identity provider".
 */
import type { ProviderConfig } from "./oidc.js";

/**
 * Only the three non-sensitive scopes.
 *
 * This is not minimalism for its own sake. Google's rules say an app asking for
 * only `openid`, `email` and `profile` needs no verification, shows users no
 * warning screen, and its authorizations do not expire after seven days. One
 * sensitive scope changes all three. We need nothing more: FR-A9 wants the
 * domain, and OPEN-36 decided the display name is discarded.
 */
const SCOPES = "openid email profile";

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

function microsoft(): ProviderConfig | null {
  const clientId = env("STUDENS_MS_CLIENT_ID");
  const clientSecret = env("STUDENS_MS_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    id: "microsoft",
    label: "Microsoft",
    // `common` accepts any Entra tenant and personal accounts, which is what
    // FR-A6's open registration requires. Its metadata declares a TEMPLATED
    // issuer; see issuerMatches in oidc.ts.
    discoveryUrl: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    clientId,
    clientSecret,
    scopes: SCOPES,
    // Work accounts often carry no `email` claim; the UPN in
    // `preferred_username` is the directory's own record of the address.
    emailClaims: ["email", "preferred_username"],
    // Microsoft does not emit `email_verified` for work accounts, so requiring
    // it would reject exactly the population this is for.
    requireEmailVerified: false,
  };
}

function google(): ProviderConfig | null {
  const clientId = env("STUDENS_GOOGLE_CLIENT_ID");
  const clientSecret = env("STUDENS_GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    id: "google",
    label: "Google",
    discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
    clientId,
    clientSecret,
    scopes: SCOPES,
    emailClaims: ["email"],
    // Google does emit it, so an address it will not vouch for is refused.
    requireEmailVerified: true,
  };
}

/** Extra providers injected by tests. Never populated in a running server. */
const extra = new Map<string, ProviderConfig>();

/** Used by the tests to stand up a fake provider. */
export function registerProvider(config: ProviderConfig): void {
  extra.set(config.id, config);
}

export function clearExtraProviders(): void {
  extra.clear();
}

export function configuredProviders(): ProviderConfig[] {
  const built = [microsoft(), google()].filter((p): p is ProviderConfig => p !== null);
  return [...built, ...extra.values()];
}

export function providerById(id: string): ProviderConfig | null {
  return configuredProviders().find((p) => p.id === id) ?? null;
}
