/**
 * The account: the address, what may be sent to it, leaving, and taking your
 * data with you.
 *
 * FR-A11 to FR-A15, FR-H1 to FR-H4.
 *
 * THE COMPOSITION POINT. Deleting an account has to reach a module's tables,
 * and the platform may not know they exist (FR-B16). So the module hands over a
 * `MemberErasure` and this file is the only place that knows both halves,
 * exactly as it is the only place that knows the review module wants usernames
 * resolved by the platform.
 *
 * EVERY STATE-CHANGING ROUTE IS A POST, PATCH OR DELETE. The session cookie is
 * SameSite=Lax, which still travels on a cross-site top-level GET, so a
 * state-changing GET would be reachable from another site. The one exception is
 * the confirmation link, which has to be a GET because it is clicked in a mail
 * client, and which is safe precisely because its authority comes from the
 * signed token rather than from the cookie.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import {
  EmailInvalid,
  OPTIONAL_KINDS,
  confirmEmailChange,
  deleteAccount,
  exportAccount,
  readPreferences,
  requestEmailChange,
  setPreference,
  type MemberErasure,
} from "@studens/platform";
import { RYC_MODULE, detachMemberReviews, exportMemberReviews } from "@studens/ryc";
import { clearSessionCookie } from "../cookies.js";
import { identifyIfAny } from "../identity.js";
import { signingKey } from "../authstate.js";
import { appUrl, publicOrigin } from "../origins.js";

/**
 * What each module does when a Member leaves.
 *
 * Listed here and nowhere else. A module that is not in this array is a module
 * whose data survives a deletion, so adding one is a deliberate act with a
 * visible diff, which is what FR-B14 makes review for.
 */
const ERASURES: MemberErasure[] = [
  {
    module: RYC_MODULE,
    erase: detachMemberReviews,
    export: exportMemberReviews,
  },
];

export function accountRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "4kb" }));

  /** FR-H1: the optional kinds, and what this member decided about each. */
  router.get("/notifications", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const preferences = await readPreferences(prisma, who.memberId);
      res.json({
        kinds: OPTIONAL_KINDS,
        preferences: preferences.map((p) => ({
          kind: p.kind,
          enabled: p.enabled,
          decidedAt: p.decidedAt.toISOString(),
        })),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.patch("/notifications", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const body = (req.body ?? {}) as { kind?: unknown; enabled?: unknown };
      if (typeof body.kind !== "string" || typeof body.enabled !== "boolean") {
        res.status(400).json({ error: "invalid" });
        return;
      }
      try {
        await setPreference(prisma, who.memberId, body.kind, body.enabled);
      } catch {
        // An unknown kind is a bad request, not a server fault: the list of
        // optional kinds is published by the GET above.
        res.status(400).json({ error: "invalid", field: "kind" });
        return;
      }
      res.json({ kind: body.kind, enabled: body.enabled });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-A13: ask to be reached somewhere else. Nothing changes until confirmed. */
  router.post("/account/email", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const email = (req.body ?? {}).email as unknown;
      if (typeof email !== "string") {
        res.status(400).json({ error: "invalid", field: "email" });
        return;
      }
      try {
        await requestEmailChange(prisma, who.memberId, email, {
          key: signingKey(),
          baseUrl: publicOrigin(),
        });
      } catch (err) {
        if (err instanceof EmailInvalid) {
          res.status(400).json({ error: "email", reason: err.reason });
          return;
        }
        throw err;
      }
      // 202: the change has been accepted for processing and has not happened.
      // Saying "saved" here would be a lie for as long as the link is unclicked.
      res.status(202).json({ pending: true });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * The confirmation link. A GET because it is clicked in a mail client.
   *
   * Its authority is the signed token, not the session cookie, so it works in a
   * browser where nobody is signed in, which is the common case: mail is often
   * read somewhere else. It redirects rather than answering JSON, because what
   * a person sees after clicking a link in an email is a page.
   */
  router.get("/account/email/confirm", (req, res) => {
    void (async () => {
      const token = req.query["token"];
      if (typeof token !== "string") {
        res.redirect(302, appUrl("/?email=failed"));
        return;
      }
      try {
        await confirmEmailChange(prisma, token, { key: signingKey() });
      } catch {
        // One outcome for every failure. "Expired" would tell the holder of a
        // stolen link that it was once real (FR-A4's rule, applied here).
        res.redirect(302, appUrl("/?email=failed"));
        return;
      }
      res.redirect(302, appUrl("/app/moi?email=confirmed"));
    })().catch(() => res.redirect(302, appUrl("/?email=failed")));
  });

  /** FR-A15 and Article 20: everything held, as a file they can keep. */
  router.get("/account/export", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const data = await exportAccount(prisma, who.memberId, { erasures: ERASURES });
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("content-disposition", 'attachment; filename="studens-export.json"');
      res.send(JSON.stringify(data, null, 2));
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-A15 and Article 17: delete the account.
   *
   * DELETE, and it requires the member to type their own username back. Not
   * theatre: this is irreversible, it is reachable from a settings page, and a
   * misclick costs somebody their account. The username is the one thing they
   * certainly know and an attacker with a borrowed session may not have looked
   * up.
   */
  router.delete("/account", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const confirm = (req.body ?? {}).confirm as unknown;
      const member = await prisma.member.findUnique({
        where: { id: who.memberId },
        select: { username: true, contactEmail: true, contactVerifiedAt: true, locale: true },
      });
      if (!member) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      // Somebody who never finished the first run has no username to type, so
      // they confirm with the word instead. Refusing to delete an account
      // because it is half set up would be the worst possible reading of this.
      const expected = member.username ?? "supprimer";
      if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== expected) {
        res.status(400).json({ error: "confirm", expected });
        return;
      }

      const report = await deleteAccount(prisma, who.memberId, { erasures: ERASURES });

      // Queued AFTER the deletion, and to the address rather than the member,
      // because the member no longer exists. FR-H2: a receipt for something
      // irreversible is not a preference.
      if (member.contactEmail && member.contactVerifiedAt !== null) {
        await prisma.mailOutbox.create({
          data: {
            toAddress: member.contactEmail,
            kind: "account.deleted",
            locale: member.locale ?? "fr",
            payload: {},
          },
        });
      }

      clearSessionCookie(res);
      res.json(report);
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
