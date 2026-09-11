/**
 * The sign-in routes, driven over real HTTP.
 *
 * The callback is the one GET in this application that creates a session, and
 * it has to be, because a provider redirect is a GET. So what protects it is
 * `state`, PKCE and single use rather than the method, and those are what this
 * file checks. See design/authentication.md and routes/auth.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from "jose";
import { PrismaClient } from "@prisma/client";
import { clearExtraProviders, clearOidcCaches, registerProvider } from "@studens/platform";
import { createApp } from "@studens/api";

const prisma = new PrismaClient();
let reachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  reachable = true;
} catch {
  reachable = false;
}
if (process.env["STUDENS_REQUIRE_DB"] === "1" && !reachable) {
  throw new Error(
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the sign-in route " +
      "tests would have been skipped. They cover the state check, PKCE single " +
      "use, and member creation on first sign-in.",
  );
}
const dbit = reachable ? it : it.skip;

const CLIENT_ID = "studens-route-test";
let idp: Server;
let idpOrigin = "";
let api: Server;
let apiOrigin = "";
let priv: KeyLike;
let pub: JWK;
let claims: Record<string, unknown> = {};
/**
 * Codes already exchanged.
 *
 * RFC 6749 section 4.1.2: "If an authorization code is used more than once,
 * the authorization server MUST deny the request." The first version of this
 * fake happily exchanged the same code twice, which is LAXER than any real
 * provider and hid the fact that single use is the provider's guarantee and
 * not ours. A fixture that is more permissive than reality is the same failure
 * as one that is tidier than it.
 */
const usedCodes = new Set<string>();

beforeAll(async () => {
  if (!reachable) return;
  const pair = await generateKeyPair("RS256");
  priv = pair.privateKey;
  pub = { ...(await exportJWK(pair.publicKey)), kid: "k", alg: "RS256", use: "sig" };

  idp = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/.well-known/openid-configuration") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            issuer: idpOrigin,
            authorization_endpoint: `${idpOrigin}/authorize`,
            token_endpoint: `${idpOrigin}/token`,
            jwks_uri: `${idpOrigin}/jwks`,
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
        for await (const c of req) body += c as string;
        const code = new URLSearchParams(body).get("code") ?? "";
        if (usedCodes.has(code)) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        usedCodes.add(code);
        const token = await new SignJWT(claims)
          .setProtectedHeader({ alg: "RS256", kid: "k" })
          .setIssuer(idpOrigin)
          .setAudience(CLIENT_ID)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(priv);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id_token: token }));
        return;
      }
      res.statusCode = 404;
      res.end();
    })();
  });
  await new Promise<void>((r) => idp.listen(0, "127.0.0.1", r));
  const a = idp.address();
  idpOrigin = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;

  const app = await createApp();
  api = createServer(app);
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const b = api.address();
  apiOrigin = `http://127.0.0.1:${typeof b === "object" && b ? b.port : 0}`;
  process.env["STUDENS_PUBLIC_ORIGIN"] = apiOrigin;
});

afterAll(async () => {
  idp?.close();
  api?.close();
  clearExtraProviders();
  if (reachable) {
    await prisma.session.deleteMany({ where: { member: { provider: "fake" } } });
    await prisma.member.deleteMany({ where: { provider: "fake" } });
  }
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (!reachable) return;
  clearOidcCaches();
  clearExtraProviders();
  registerProvider({
    id: "fake",
    label: "Fake",
    discoveryUrl: `${idpOrigin}/.well-known/openid-configuration`,
    clientId: CLIENT_ID,
    clientSecret: "s",
    scopes: "openid email profile",
    emailClaims: ["email"],
    requireEmailVerified: true,
  });
  claims = { sub: "route-subject", email: "someone@student.uclouvain.be", email_verified: true };
  usedCodes.clear();
  await prisma.session.deleteMany({ where: { member: { provider: "fake" } } });
  await prisma.member.deleteMany({ where: { provider: "fake" } });
});

/** Start a sign-in and return the state cookie plus the state the IdP would echo. */
async function start(): Promise<{ cookie: string; state: string }> {
  const res = await fetch(`${apiOrigin}/api/auth/fake/start`, { redirect: "manual" });
  expect(res.status).toBe(302);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0]!;
  const location = new URL(res.headers.get("location") ?? "");
  const state = location.searchParams.get("state")!;
  // The nonce the server generated goes into the token the fake IdP will sign.
  claims = { ...claims, nonce: location.searchParams.get("nonce") };
  return { cookie, state };
}

function callback(query: string, cookie?: string): Promise<Response> {
  return fetch(`${apiOrigin}/api/auth/callback/fake?${query}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

describe("the start of a sign-in", () => {
  dbit("redirects to the provider and writes nothing", async () => {
    const before = await prisma.session.count();
    const { cookie } = await start();
    expect(cookie).toContain("studens_auth=");
    // Abandoning here must leave no trace but an expiring cookie.
    expect(await prisma.session.count()).toBe(before);
  });

  dbit("offers only the providers that are configured", async () => {
    const res = await fetch(`${apiOrigin}/api/auth/providers`);
    const body = (await res.json()) as { providers: { id: string }[] };
    expect(body.providers.map((p) => p.id)).toContain("fake");
    // Never the secret, and never anything but id and label.
    expect(JSON.stringify(body)).not.toContain("clientSecret");
  });
});

describe("a callback that must be refused", () => {
  dbit("with no state cookie at all, which is the forged case", async () => {
    const { state } = await start();
    const res = await callback(`code=${Math.random()}&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("auth=failed");
    expect(await prisma.member.count({ where: { provider: "fake" } })).toBe(0);
  });

  dbit("with a state that does not match the cookie", async () => {
    const { cookie } = await start();
    const res = await callback("code=c&state=a-state-i-chose", cookie);
    expect(res.headers.get("location")).toContain("auth=failed");
    expect(await prisma.member.count({ where: { provider: "fake" } })).toBe(0);
  });

  dbit("with no code", async () => {
    const { cookie, state } = await start();
    const res = await callback(`state=${state}`, cookie);
    expect(res.headers.get("location")).toContain("auth=failed");
  });

  dbit("replayed: the same callback URL and cookie a second time", async () => {
    const { cookie, state } = await start();
    const first = await callback(`code=c1&state=${state}`, cookie);
    expect(first.headers.get("location")).not.toContain("auth=failed");

    // We tell the browser to clear the state cookie, but a replay does not have
    // to cooperate, so it is sent again and OUR state check passes. What stops
    // the replay is the provider refusing the reused code, which RFC 6749
    // section 4.1.2 makes a MUST. This test exists to keep that dependency
    // visible: it is the provider's guarantee, not ours.
    const again = await callback(`code=c1&state=${state}`, cookie);
    expect(again.status).toBe(302);
    expect(again.headers.get("location")).toContain("auth=failed");
    expect(await prisma.member.count({ where: { provider: "fake" } })).toBe(1);
    expect(await prisma.session.count({ where: { member: { provider: "fake" } } })).toBe(1);
  });

  dbit("every failure says exactly the same thing (FR-A4)", async () => {
    const { cookie, state } = await start();
    const outcomes = await Promise.all([
      callback(`code=${Math.random()}&state=${state}`),
      callback("code=x&state=wrong", cookie),
      callback(`state=${state}`, cookie),
    ]);
    const locations = new Set(outcomes.map((r) => r.headers.get("location")));
    expect(locations.size, "a visitor must not learn which check refused them").toBe(1);
  });
});

describe("a sign-in that succeeds", () => {
  dbit("creates the member, stores only the domain, and issues a session", async () => {
    const { cookie, state } = await start();
    const res = await callback(`code=${Math.random()}&state=${state}`, cookie);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).not.toContain("auth=failed");

    const member = await prisma.member.findFirstOrThrow({ where: { provider: "fake" } });
    expect(member.providerSubject).toBe("route-subject");
    expect(member.emailDomain).toBe("student.uclouvain.be");
    // FR-A9 and OPEN-36: the address and the provider's display name are not
    // ours to keep. Only the domain is.
    expect(JSON.stringify(member)).not.toContain("someone@");

    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toContain("studens_session=");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=Lax");
    expect(await prisma.session.count({ where: { memberId: member.id } })).toBe(1);
  });

  dbit("a second sign-in reuses the member and does not duplicate it", async () => {
    for (let i = 0; i < 2; i += 1) {
      const { cookie, state } = await start();
      await callback(`code=${Math.random()}&state=${state}`, cookie);
    }
    expect(await prisma.member.count({ where: { provider: "fake" } })).toBe(1);
    expect(await prisma.session.count({ where: { member: { provider: "fake" } } })).toBe(2);
  });

  dbit("a changed domain updates the trust signal rather than forking the account", async () => {
    let s = await start();
    await callback(`code=${Math.random()}&state=${s.state}`, s.cookie);

    // The same person, a year later, now on the alumni domain.
    claims = { ...claims, email: "someone@alumni.uclouvain.be" };
    s = await start();
    await callback(`code=${Math.random()}&state=${s.state}`, s.cookie);

    const members = await prisma.member.findMany({ where: { provider: "fake" } });
    expect(members).toHaveLength(1);
    expect(members[0]!.emailDomain).toBe("alumni.uclouvain.be");
  });
});
