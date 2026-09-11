/**
 * The OIDC flow, against a provider that really exists for the length of the test.
 *
 * A fake provider rather than a mocked fetch: it serves a discovery document
 * and a JWKS over HTTP, and signs real RS256 tokens with a real key. So the
 * signature verification, the JWKS fetch and the claim checks are the code that
 * will face Microsoft, not a stub standing in for them. Mocking `fetch` would
 * have tested that our mock returns what we told it to.
 *
 * No credentials are needed, which is the point: everything here is provable
 * before the applications are registered.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from "jose";
import {
  beginAuthorization,
  challengeFor,
  clearOidcCaches,
  completeAuthorization,
  emailDomainFrom,
  issuerMatches,
  OidcError,
  type ProviderConfig,
} from "@studens/platform";

const CLIENT_ID = "studens-test-client";
const REDIRECT = "http://localhost:3001/api/auth/callback/fake";

let server: Server;
let origin = "";
let priv: KeyLike;
let pub: JWK;

/** What the token endpoint will sign next. Set by each test. */
let nextClaims: Record<string, unknown> = {};
let nextIssuer = "";
let nextAudience = CLIENT_ID;
let lastTokenRequest: URLSearchParams | null = null;
/** When set, the token endpoint serves a token whose signature is one byte off. */
let tamperNextToken = false;

async function mint(): Promise<string> {
  return await new SignJWT(nextClaims)
    .setProtectedHeader({ alg: "RS256", kid: "fake-key" })
    .setIssuer(nextIssuer)
    .setAudience(nextAudience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(priv);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  priv = pair.privateKey;
  pub = { ...(await exportJWK(pair.publicKey)), kid: "fake-key", alg: "RS256", use: "sig" };

  server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", origin || "http://localhost");
      if (url.pathname === "/.well-known/openid-configuration") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            issuer: nextIssuer,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            jwks_uri: `${origin}/jwks`,
          }),
        );
        return;
      }
      if (url.pathname === "/jwks") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [pub] }));
        return;
      }
      if (url.pathname === "/token") {
        let body = "";
        for await (const chunk of req) body += chunk as string;
        lastTokenRequest = new URLSearchParams(body);
        let idToken = await mint();
        if (tamperNextToken) {
          const parts = idToken.split(".");
          const sig = parts[2]!;
          idToken = `${parts[0]}.${parts[1]}.${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id_token: idToken, token_type: "Bearer" }));
        return;
      }
      res.statusCode = 404;
      res.end();
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  origin = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  nextIssuer = origin;
});

afterAll(() => {
  server.close();
});

function fake(over: Partial<ProviderConfig> = {}): ProviderConfig {
  clearOidcCaches();
  return {
    id: "fake",
    label: "Fake",
    discoveryUrl: `${origin}/.well-known/openid-configuration`,
    clientId: CLIENT_ID,
    clientSecret: "fake-secret",
    scopes: "openid email profile",
    emailClaims: ["email"],
    requireEmailVerified: true,
    ...over,
  };
}

async function signIn(provider = fake()): Promise<{ subject: string; emailDomain: string }> {
  const auth = await beginAuthorization(provider, REDIRECT);
  nextClaims = { ...nextClaims, nonce: auth.nonce };
  return await completeAuthorization(provider, {
    code: "an-authorization-code",
    codeVerifier: auth.codeVerifier,
    nonce: auth.nonce,
    redirectUri: REDIRECT,
  });
}

describe("the authorization request", () => {
  it("carries PKCE, state and nonce, and never the verifier", async () => {
    const auth = await beginAuthorization(fake(), REDIRECT);
    const url = new URL(auth.url);

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(auth.state);
    expect(url.searchParams.get("nonce")).toBe(auth.nonce);

    // The verifier is the secret half of PKCE. If it travelled in the URL the
    // whole mechanism would be decoration.
    expect(auth.url).not.toContain(auth.codeVerifier);
    expect(url.searchParams.get("code_challenge")).toBe(challengeFor(auth.codeVerifier));
  });

  it("is different every time", async () => {
    const a = await beginAuthorization(fake(), REDIRECT);
    const b = await beginAuthorization(fake(), REDIRECT);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  it("computes the challenge as RFC 7636 says: base64url of SHA-256", () => {
    const verifier = "a-known-verifier";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challengeFor(verifier)).toBe(expected);
  });
});

describe("a good sign-in", () => {
  it("returns the subject and the email DOMAIN, never the address", async () => {
    nextClaims = { sub: "subject-123", email: "Marie.Dupont@student.UCLouvain.be", email_verified: true };
    const who = await signIn();

    expect(who.subject).toBe("subject-123");
    expect(who.emailDomain).toBe("student.uclouvain.be");
    // FR-A9 wants the domain as a trust signal. The local part is personal data
    // with no use in this product, so it must not come back at all.
    expect(JSON.stringify(who).toLowerCase()).not.toContain("marie");
  });

  it("sends the code, the verifier and the client secret to the token endpoint", async () => {
    nextClaims = { sub: "s", email: "a@b.be", email_verified: true };
    const auth = await beginAuthorization(fake(), REDIRECT);
    nextClaims = { ...nextClaims, nonce: auth.nonce };
    await completeAuthorization(fake(), {
      code: "the-code",
      codeVerifier: auth.codeVerifier,
      nonce: auth.nonce,
      redirectUri: REDIRECT,
    });

    expect(lastTokenRequest?.get("grant_type")).toBe("authorization_code");
    expect(lastTokenRequest?.get("code")).toBe("the-code");
    expect(lastTokenRequest?.get("code_verifier")).toBe(auth.codeVerifier);
    expect(lastTokenRequest?.get("client_secret")).toBe("fake-secret");
    expect(lastTokenRequest?.get("redirect_uri")).toBe(REDIRECT);
  });
});

describe("tokens that must be refused", () => {
  it("a nonce from another sign-in attempt", async () => {
    const provider = fake();
    const auth = await beginAuthorization(provider, REDIRECT);
    nextClaims = { sub: "s", email: "a@b.be", email_verified: true, nonce: "someone-elses-nonce" };

    await expect(
      completeAuthorization(provider, {
        code: "c",
        codeVerifier: auth.codeVerifier,
        nonce: auth.nonce,
        redirectUri: REDIRECT,
      }),
    ).rejects.toThrow(/nonce/);
  });

  it("a token minted for a different application", async () => {
    nextClaims = { sub: "s", email: "a@b.be", email_verified: true };
    nextAudience = "some-other-app";
    await expect(signIn()).rejects.toThrow(OidcError);
    nextAudience = CLIENT_ID;
  });

  it("a token from an issuer the discovery document does not name", async () => {
    nextClaims = { sub: "s", email: "a@b.be", email_verified: true };
    const provider = fake();
    // Discovery says one issuer; the token claims another. Everything else,
    // including the signature, is valid.
    const auth = await beginAuthorization(provider, REDIRECT);
    nextIssuer = "https://accounts.google.com";
    nextClaims = { ...nextClaims, nonce: auth.nonce };
    await expect(
      completeAuthorization(provider, {
        code: "c",
        codeVerifier: auth.codeVerifier,
        nonce: auth.nonce,
        redirectUri: REDIRECT,
      }),
    ).rejects.toThrow(/issuer/);
    nextIssuer = origin;
  });

  it("a token whose signature has been tampered with", async () => {
    // The provider itself serves the bad token, so this goes through the real
    // flow: fetch the JWKS, verify, refuse. Verifying a tampered token directly
    // with jose would only prove that jose works.
    nextClaims = { sub: "s", email: "a@b.be", email_verified: true };
    tamperNextToken = true;
    try {
      await expect(signIn()).rejects.toThrow(OidcError);
    } finally {
      tamperNextToken = false;
    }
    // And the same token, untampered, is accepted: so the refusal above was
    // the signature and not something incidental about the test.
    expect((await signIn()).subject).toBe("s");
  });

  it("a token carrying no subject", async () => {
    nextClaims = { email: "a@b.be", email_verified: true };
    await expect(signIn()).rejects.toThrow(/sub/);
  });
});

describe("FR-A9: where the domain comes from", () => {
  const provider = () => fake();

  it("takes the domain, lowercased, from the configured claim", () => {
    expect(emailDomainFrom({ email: "X@Student.UCLouvain.BE" }, provider())).toBe(
      "student.uclouvain.be",
    );
  });

  it("refuses an address the provider will not vouch for", () => {
    expect(() =>
      emailDomainFrom({ email: "x@b.be", email_verified: false }, provider()),
    ).toThrow(/unverified/);
  });

  it("accepts an unverified flag where the provider does not emit one", () => {
    const ms = fake({ requireEmailVerified: false, emailClaims: ["email", "preferred_username"] });
    expect(emailDomainFrom({ preferred_username: "x@uclouvain.be" }, ms)).toBe("uclouvain.be");
  });

  it("falls back through the claims in order", () => {
    const ms = fake({ requireEmailVerified: false, emailClaims: ["email", "preferred_username"] });
    expect(emailDomainFrom({ email: "a@first.be", preferred_username: "b@second.be" }, ms)).toBe(
      "first.be",
    );
  });

  it("refuses when no claim carries a usable address", () => {
    expect(() => emailDomainFrom({ sub: "s" }, provider())).toThrow(/no usable address/);
    expect(() => emailDomainFrom({ email: "not-an-address" }, provider())).toThrow();
    expect(() => emailDomainFrom({ email: "@nothing-before" }, provider())).toThrow();
    expect(() => emailDomainFrom({ email: "nothing-after@" }, provider())).toThrow();
  });
});

describe("issuerMatches: the Microsoft template", () => {
  const TEMPLATE = "https://login.microsoftonline.com/{tenantid}/v2.0";
  const TID = "9188040d-6c67-4c5b-b112-36a304b66dad";

  it("plain equality, which is the usual case", () => {
    expect(issuerMatches("https://accounts.google.com", "https://accounts.google.com")).toBe(true);
  });

  it("fills the placeholder from the token's own tenant id", () => {
    expect(issuerMatches(TEMPLATE, `https://login.microsoftonline.com/${TID}/v2.0`, TID)).toBe(true);
  });

  it("refuses a tenant id that is not a tenant id", () => {
    // Without this, a `tid` of "../../evil" or an empty string could be
    // substituted into the issuer and made to match something unintended.
    for (const bad of ["", "..", "not-a-guid", `${TID}x`, 42, null, undefined, {}]) {
      expect(issuerMatches(TEMPLATE, `https://login.microsoftonline.com/${TID}/v2.0`, bad)).toBe(
        false,
      );
    }
  });

  it("refuses an issuer that does not match once filled", () => {
    expect(issuerMatches(TEMPLATE, "https://login.evil.example/x/v2.0", TID)).toBe(false);
  });

  it("refuses a mismatch when there is no placeholder to fill", () => {
    expect(issuerMatches("https://accounts.google.com", "https://accounts.evil.example")).toBe(
      false,
    );
  });
});
