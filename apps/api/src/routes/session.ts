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
import { contactAddress, suspensionOf } from "@studens/platform";
import {
  clearSuspensionNotice,
  readSuspensionNotice,
  setSuspensionNotice,
} from "../suspensionnotice.js";
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
        // FR-F5: the shell needs both on the very first paint, because an
        // un-onboarded member is sent to the first run before anything else
        // renders. A second round trip here would show the app for a frame and
        // then replace it, which reads as a bug.
        username: who.username,
        onboarded: who.onboarded,
        // Zero means the first run has never been opened, which is the only
        // state that sends somebody there instead of prompting them in place.
        onboardingStep: who.onboardingStep,
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
  /**
   * WHAT THE SUSPENSION SCREEN READS.
   *
   * Answers only about the member whose sign-in this browser just completed,
   * proved by the short lived signed notice the callback set. No session is
   * needed and none is granted: a suspended person is not signed in, and the
   * one thing they are entitled to is the explanation.
   *
   * 404 when there is no notice, rather than an empty answer, so that the
   * address is not a way to ask about anybody in general.
   */
  router.get("/suspension", (req, res) => {
    void (async () => {
      const memberId = readSuspensionNotice(req);
      if (!memberId) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: {
          suspendedAt: true,
          suspendedUntil: true,
          suspendedReason: true,
        },
      });
      if (!member) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const state = suspensionOf(member);
      if (!state.suspended) {
        // Lifted between the redirect and this request, or expired. Clearing
        // the notice stops the screen insisting on something already over.
        clearSuspensionNotice(res);
        res.json({ suspended: false });
        return;
      }
      res.json({
        suspended: true,
        // Null means permanent, which the screen says in words rather than
        // leaving a reader to infer it from a missing date.
        until: state.until ? state.until.toISOString() : null,
        reason: state.reason,
        /* Where to write. The administrators' own addresses are not published
           here: FR-B12 lets a moderator be named to a member, but handing out
           a mailbox on a page anybody can reach after one sign-in is a
           different thing. One address, answered by whoever holds it. */
        contact: contactAddress(),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

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
          // FR-A11, as in identity.ts: the development path stores an address
          // because the real one does.
          providerEmail: "developpeur.local@student.uclouvain.be",
          contactEmail: "developpeur.local@student.uclouvain.be",
          contactVerifiedAt: new Date(),
          tenantId: tenant.id,
        },
      });
      /*
        THE SAME DIVERSION AS THE REAL PATH, and for two reasons.

        The development sign-in exists so that everything downstream is
        production's code path; a suspension that this door walked straight
        past would make it a different door, and the screen it is supposed to
        reach would be unreachable on the only machine anybody can test it on.

        It answers 403 with a destination rather than redirecting, because the
        caller is a fetch and not a navigation: the browser would follow a 302
        here and hand the page JSON.
      */
      const state = suspensionOf(member);
      if (state.suspended) {
        setSuspensionNotice(res, member.id);
        res.status(403).json({ suspended: true, goTo: "/suspendu" });
        return;
      }
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
