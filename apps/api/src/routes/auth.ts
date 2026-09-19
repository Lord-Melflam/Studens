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
  suspensionOf,
  providerById,
} from "@studens/platform";
import { setSuspensionNotice } from "../suspensionnotice.js";
import { setSessionCookie } from "../cookies.js";
import { clearAuthState, readAuthState, setAuthState } from "../authstate.js";
import { appUrl, publicOrigin } from "../origins.js";

/** Where the provider sends the browser back. Must match the registration exactly. */
function redirectUri(providerId: string): string {
  return `${publicOrigin()}/api/auth/callback/${providerId}`;
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
    })().catch(() => res.redirect(302, appUrl("/?auth=failed")));
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
      const oauthState = typeof req.query["state"] === "string" ? req.query["state"] : null;

      if (!provider || saved.provider !== provider.id) throw new Error("provider mismatch");
      if (!code) throw new Error("no code");
      if (!oauthState || oauthState !== saved.state) throw new Error("state mismatch");

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
        // graduates. It is a current trust signal, not a historical record, so
        // it and the address it comes from are refreshed every time.
        //
        // `contactEmail` is NOT touched on update (FR-A12): it is the member's
        // to set, and silently resetting it to the provider's on every sign-in
        // would undo a change they made on purpose.
        update: { emailDomain: who.emailDomain, providerEmail: who.email },
        create: {
          provider: provider.id,
          providerSubject: who.subject,
          emailDomain: who.emailDomain,
          providerEmail: who.email,
          // A new member is reachable from the first second, at the address the
          // provider just verified. Already confirmed, because the provider
          // asserted it and FR-A13's confirmation exists for addresses WE were
          // told rather than ones we were shown proof of.
          contactEmail: who.email,
          contactVerifiedAt: new Date(),
          tenantId: tenant.id,
        },
      });

      /**
       * SUSPENDED: TOLD, NOT LET IN.
       *
       * Checked here and not in `verifySession`, which refuses a suspended
       * session the same way it refuses every other (FR-A4). That is right
       * for a request and wrong for a person: it made a suspension look
       * exactly like the site being down, so somebody would conclude the app
       * was temporarily unreachable and keep trying.
       *
       * This is the one moment we know who they are and they are watching.
       * No session is issued; a short lived signed notice says which
       * suspension this browser may be told about, and the screen reads it.
       */
      const state = suspensionOf(member);
      if (state.suspended) {
        setSuspensionNotice(res, member.id);
        res.redirect(302, appUrl("/suspendu"));
        return;
      }

      const { token } = await createSession(member.id, { client: prisma });
      setSessionCookie(res, token);
      // Into the APP, not the public home page. Landing a member who has just
      // signed in back on the marketing site is how sign-in reads as a no-op.
      // No language prefix: the browser's own preference decides, and the
      // client redirects /app to /<locale>/app on arrival.
      res.redirect(302, appUrl("/app"));
    })().catch(() => {
      // FR-A4. One destination, one message, whatever went wrong. The reason
      // stays on this side of the redirect.
      res.redirect(302, appUrl("/?auth=failed"));
    });
  });

  return router;
}
