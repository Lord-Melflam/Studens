/**
 * Session endpoints: who am I, sign out, and the FR-A5 session list.
 *
 * There is no real sign-in here yet. FR-A7 makes that an OIDC redirect to
 * Microsoft or Google, which is the next pull request. What exists is the
 * development sign-in, fenced the same way the development identity always was,
 * and it issues a real session so every other route runs production's code path.
 *
 * Everything that changes state is a POST or a DELETE, never a GET. The session
 * cookie is SameSite=Lax, which still travels on a cross-site top-level GET, so
 * a state-changing GET would be reachable from another site.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import { createSession, listSessions, revokeSession } from "@studens/platform";
import { clearSessionCookie, setSessionCookie } from "../cookies.js";
import { devIdentityEnabled, identifyIfAny } from "../identity.js";

export function sessionRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "4kb" }));

  /** Who is signed in. Never 401: "nobody" is a normal answer to this question. */
  router.get("/session", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.json({ signedIn: false, devSignInAvailable: devIdentityEnabled() });
        return;
      }
      res.json({
        signedIn: true,
        // FR-A9 and FR-A10: the domain is evidence of holding an address there,
        // and is never presented as proof of enrolment.
        emailDomain: who.emailDomain,
        role: who.role,
        devSignInAvailable: devIdentityEnabled(),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * Development sign-in. Not a login page: a stand-in for a provider.
   *
   * FR-A7 permits no self-managed credentials, and this takes none: it signs in
   * one fixed member, and only where the fence allows it.
   */
  router.post("/session/dev", (_req, res) => {
    void (async () => {
      if (!devIdentityEnabled()) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const tenant = await prisma.tenant.upsert({
        where: { id: "00000000-0000-0000-0000-00000000dev0" },
        update: {},
        create: { id: "00000000-0000-0000-0000-00000000dev0", name: "UCLouvain" },
      });
      const member = await prisma.member.upsert({
        where: { provider_providerSubject: { provider: "dev", providerSubject: "local" } },
        update: {},
        create: {
          provider: "dev",
          providerSubject: "local",
          emailDomain: "student.uclouvain.be",
          displayName: "Développeur local",
          tenantId: tenant.id,
        },
      });
      const { token } = await createSession(member.id, { client: prisma });
      setSessionCookie(res, token);
      res.status(201).json({ signedIn: true, emailDomain: member.emailDomain });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-A2: end this session, on this device.
   *
   * Revokes rather than deletes, so the row remains for FR-E1's audit trail.
   * Answers 204 whether or not there was a session: a caller learns nothing
   * about whether the token it sent was real (FR-A4).
   */
  router.delete("/session", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (who) await revokeSession(who.sessionId, { client: prisma });
      clearSessionCookie(res);
      res.status(204).end();
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-A5: the member's own live sessions. */
  router.get("/sessions", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const sessions = await listSessions(who.memberId, who.sessionId, { client: prisma });
      res.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          startedAt: s.issuedAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
          current: s.current,
        })),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-A5: revoke one of them.
   *
   * Scoped to the caller's own sessions by the `memberId` in the update, so a
   * guessed identifier belonging to someone else matches nothing. The response
   * is the same either way, so it cannot be used to test whether an id exists.
   */
  router.delete("/sessions/:id", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      await prisma.session.updateMany({
        where: { id: req.params.id, memberId: who.memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (req.params.id === who.sessionId) clearSessionCookie(res);
      res.status(204).end();
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
