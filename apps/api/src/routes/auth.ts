/**
 * Sign-in: out to the provider, and back.
 *
 * THE CALLBACK IS A GET THAT CREATES A SESSION, and that is the one deliberate
 * exception to the rule in design/authentication.md 0.3. It has to be: the
 * provider redirects the browser here, and a redirect is a GET. So the defences
 * are the ones OAuth specifies rather than the HTTP method:
 *
 *   state         must equal the value in this browser's signed cookie, so a
 *                 callback forged by another site has nothing to match
 *   PKCE          the code is useless without the verifier, which never left
 *                 this server
 *   nonce         ties the id token to this authorization request
 *   single use    the PROVIDER's guarantee, not ours. RFC 6749 section 4.1.2:
 *                 "If an authorization code is used more than once, the
 *                 authorization server MUST deny the request." We clear the
 *                 state cookie on the way through, which stops an accidental
 *                 replay from a back button, but a deliberate replay can send
 *                 the cookie again and our state check will pass. The reused
 *                 code is what fails. test/auth/callback.db.test.ts keeps that
 *                 dependency visible rather than implied.
 *
 * FR-A4: every failure below renders the same page and says the same thing. A
 * visitor must not learn whether an account existed, whether a code was real,
 * or which check refused it.
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import {
  beginAuthorization,
  completeAuthorization,
  configuredProviders,
  createSession,
  providerById,
} from "@studens/platform";
import { setSessionCookie } from "../cookies.js";
import { clearAuthState, readAuthState, setAuthState } from "../authstate.js";

/** Where the provider sends the browser back. Must match the registration exactly. */
function redirectUri(providerId: string): string {
  const base = process.env["STUDENS_PUBLIC_ORIGIN"] ?? "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/api/auth/callback/${providerId}`;
}

/** Where the person lands afterwards, success or failure. */
function appUrl(path: string): string {
  const base = process.env["STUDENS_APP_ORIGIN"] ?? "http://localhost:5173";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function authRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** Which providers this deployment can offer. Names only, never secrets. */
  router.get("/auth/providers", (_req, res) => {
    res.json({
      providers: configuredProviders().map((p) => ({ id: p.id, label: p.label })),
    });
  });

  /**
   * Start. A GET, and it changes nothing on the server: it sets a cookie
   * holding one attempt's state and redirects. Nothing is written, no session
   * exists yet, and abandoning it here leaves no trace but an expiring cookie.
   */
  router.get("/auth/:provider/start", (req, res) => {
    void (async () => {
      const provider = providerById(req.params.provider);
      if (!provider) {
        res.status(404).json({ error: "unknown provider" });
        return;
      }
      const auth = await beginAuthorization(provider, redirectUri(provider.id));
      setAuthState(res, {
        provider: provider.id,
        state: auth.state,
        nonce: auth.nonce,
        codeVerifier: auth.codeVerifier,
      });
      res.redirect(302, auth.url);
    })().catch(() => res.redirect(302, appUrl("/#/?auth=failed")));
  });

  router.get("/auth/callback/:provider", (req, res) => {
    void (async () => {
      // Cleared first, whatever happens next. This stops an accidental replay,
      // a refresh or a back button; it cannot stop a deliberate one, which can
      // resend the cookie. See the note at the top about who enforces single
      // use.
      let saved;
      try {
        saved = readAuthState(req);
      } finally {
        clearAuthState(res);
      }

      const provider = providerById(req.params.provider);
      const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
      const state = typeof req.query["state"] === "string" ? req.query["state"] : null;

      if (!provider || saved.provider !== provider.id) throw new Error("provider mismatch");
      if (!code) throw new Error("no code");
      if (!state || state !== saved.state) throw new Error("state mismatch");

      const who = await completeAuthorization(provider, {
        code,
        codeVerifier: saved.codeVerifier,
        nonce: saved.nonce,
        redirectUri: redirectUri(provider.id),
      });

      // FR-A6: open registration, so a first sign-in creates the Member. The
      // identity is (provider, subject); nothing about the person is stored
      // beyond the email DOMAIN, per FR-A9 and OPEN-36.
      const tenant = await prisma.tenant.upsert({
        where: { id: "00000000-0000-0000-0000-00000000tnt1" },
        update: {},
        create: { id: "00000000-0000-0000-0000-00000000tnt1", name: "UCLouvain" },
      });
      const member = await prisma.member.upsert({
        where: {
          provider_providerSubject: { provider: provider.id, providerSubject: who.subject },
        },
        // The domain can change between sign-ins, for instance a student who
        // graduates. It is a current trust signal, not a historical record.
        update: { emailDomain: who.emailDomain },
        create: {
          provider: provider.id,
          providerSubject: who.subject,
          emailDomain: who.emailDomain,
          tenantId: tenant.id,
        },
      });

      const { token } = await createSession(member.id, { client: prisma });
      setSessionCookie(res, token);
      res.redirect(302, appUrl("/"));
    })().catch(() => {
      // FR-A4. One destination, one message, whatever went wrong. The reason
      // stays on this side of the redirect.
      res.redirect(302, appUrl("/#/?auth=failed"));
    });
  });

  return router;
}
