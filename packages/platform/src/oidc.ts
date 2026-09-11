/**
 * OpenID Connect, authorization code flow with PKCE.
 *
 * One implementation. Microsoft and Google are rows in a table, not code paths
 * (design/authentication.md 0.4), because the second code path is always the
 * one exercised less and is where the bug lives.
 *
 * WHAT THIS TRUSTS, AND WHY. The id token is verified against the provider's
 * published JWKS before a single claim is read: signature, issuer, audience,
 * expiry, and the nonce this server generated. Skipping signature checks is
 * permitted by OIDC Core 3.1.3.7 when the token came straight from the token
 * endpoint over TLS, and we do it anyway. It costs one cached HTTP request and
 * it removes a whole class of "what if the token endpoint response was not what
 * we thought" from the argument.
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface ProviderConfig {
  /** Appears in the callback URL and in `Member.provider`. Never changes. */
  id: string;
  label: string;
  /**
   * The discovery document. For Microsoft's multi-tenant endpoint the `issuer`
   * inside it is a TEMPLATE, see `issuerMatches`.
   */
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  /**
   * Claims to take the email address from, in order of preference.
   *
   * FR-A9 requires a verified claim rather than user input, and providers
   * differ in which one carries it, so this is configuration rather than a
   * branch in the code.
   */
  emailClaims: string[];
  /** When true, an `email_verified` of false rejects the sign-in. */
  requireEmailVerified: boolean;
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export class OidcError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

/** Discovery documents change rarely. One fetch per process is plenty. */
const discoveryCache = new Map<string, Promise<Discovery>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function clearOidcCaches(): void {
  discoveryCache.clear();
  jwksCache.clear();
}

export async function discover(url: string): Promise<Discovery> {
  const hit = discoveryCache.get(url);
  if (hit) return await hit;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new OidcError("discovery", `${url} answered ${res.status}`);
    const doc = (await res.json()) as Partial<Discovery>;
    for (const k of ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
      if (typeof doc[k] !== "string") {
        throw new OidcError("discovery", `${url} has no ${k}`);
      }
    }
    return doc as Discovery;
  })();
  discoveryCache.set(url, p);
  try {
    return await p;
  } catch (err) {
    discoveryCache.delete(url);
    throw err;
  }
}

/**
 * Does the token's `iss` match what the provider published?
 *
 * Usually this is string equality. Microsoft's multi-tenant endpoint is the
 * exception that makes it a function: its discovery document declares
 *
 *     https://login.microsoftonline.com/{tenantid}/v2.0
 *
 * while a real token carries the signing tenant's own id in place of the
 * placeholder. Comparing the two as strings rejects every genuine token; not
 * comparing them at all accepts a token from anywhere. So the placeholder is
 * filled from the token's own `tid` claim and the result must match exactly.
 *
 * `tid` is not trusted here. It is only used to rebuild a string that must then
 * equal an issuer the provider itself published, and the whole token was
 * already verified against that provider's keys before this is reached.
 */
export function issuerMatches(published: string, actual: string, tid?: unknown): boolean {
  if (published === actual) return true;
  if (!published.includes("{tenantid}")) return false;
  if (typeof tid !== "string" || tid.length === 0) return false;
  // A tenant id is a GUID. Anything else cannot be substituted into an issuer.
  if (!/^[0-9a-fA-F-]{36}$/.test(tid)) return false;
  return published.replace("{tenantid}", tid) === actual;
}

export interface Authorization {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

function base64url(b: Buffer): string {
  return b.toString("base64url");
}

/** RFC 7636 S256. The verifier never leaves this server; only its hash does. */
export function challengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export async function beginAuthorization(
  provider: ProviderConfig,
  redirectUri: string,
): Promise<Authorization> {
  const doc = await discover(provider.discoveryUrl);
  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(64));

  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", provider.scopes);
  // state defends the callback against cross-site request forgery; nonce binds
  // the id token to THIS authorization request; PKCE defends the code itself.
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challengeFor(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return { url: url.toString(), state, nonce, codeVerifier };
}

export interface ProviderIdentity {
  /** Stable per application and per person. Becomes `Member.providerSubject`. */
  subject: string;
  /** FR-A9. The domain only: the local part is never stored. */
  emailDomain: string;
}

function claimString(payload: JWTPayload, name: string): string | null {
  const v = payload[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * The domain, and only the domain.
 *
 * The full address is read here and deliberately not returned. FR-A9 wants the
 * domain as a trust signal; the local part is personal data with no use in this
 * product, and OPEN-36 already decided that what we do not need we do not keep.
 */
export function emailDomainFrom(payload: JWTPayload, provider: ProviderConfig): string {
  if (provider.requireEmailVerified && payload["email_verified"] === false) {
    throw new OidcError("email_unverified", "the provider reports this address as unverified");
  }
  for (const claim of provider.emailClaims) {
    const value = claimString(payload, claim);
    const at = value ? value.lastIndexOf("@") : -1;
    if (value && at > 0 && at < value.length - 1) {
      return value.slice(at + 1).toLowerCase();
    }
  }
  throw new OidcError(
    "no_email",
    `no usable address in ${provider.emailClaims.join(" or ")}; FR-A9 needs a domain`,
  );
}

export interface CompleteInput {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

export async function completeAuthorization(
  provider: ProviderConfig,
  input: CompleteInput,
): Promise<ProviderIdentity> {
  const doc = await discover(provider.discoveryUrl);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code_verifier: input.codeVerifier,
  });

  const res = await fetch(doc.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
  });
  if (!res.ok) {
    // The provider's error body can quote the code and the client id. It goes
    // no further than this message, which the route turns into a generic one.
    throw new OidcError("token_endpoint", `token endpoint answered ${res.status}`);
  }
  const tokens = (await res.json()) as { id_token?: unknown };
  if (typeof tokens.id_token !== "string") {
    throw new OidcError("no_id_token", "the token response carried no id_token");
  }

  let jwks = jwksCache.get(doc.jwks_uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
    jwksCache.set(doc.jwks_uri, jwks);
  }

  let payload: JWTPayload;
  try {
    // Signature, audience and expiry. The issuer is checked below, because
    // Microsoft's is a template that jose cannot match on its own.
    ({ payload } = await jwtVerify(tokens.id_token, jwks, {
      audience: provider.clientId,
      clockTolerance: 60,
    }));
  } catch (err) {
    throw new OidcError("id_token", `id token rejected: ${(err as Error).message}`);
  }

  if (typeof payload.iss !== "string" || !issuerMatches(doc.issuer, payload.iss, payload["tid"])) {
    throw new OidcError("issuer", "id token issuer does not match the provider's own metadata");
  }

  // The nonce is what ties this token to the authorization request this server
  // started. Without it a token minted for another session of the same app
  // would pass every other check here.
  if (claimString(payload, "nonce") !== input.nonce) {
    throw new OidcError("nonce", "id token nonce does not match this sign-in attempt");
  }

  const subject = claimString(payload, "sub");
  if (!subject) throw new OidcError("no_subject", "id token carried no sub");

  return { subject, emailDomain: emailDomainFrom(payload, provider) };
}
