/**
 * The moderator's console, and the administrator's appointment page.
 * FR-E3, FR-E10 to FR-E14.
 *
 * WHY THIS HAD TO FOLLOW FR-E8 IMMEDIATELY. Notices began arriving with the
 * previous change, and a report is actual knowledge under Article 6. A queue
 * nobody can read is a growing legal exposure, so the intake was only half a
 * mechanism until somebody could act on it.
 *
 * EVERY ROUTE CHECKS THE ROLE IN THE PLATFORM, NOT HERE. `moderationQueue`,
 * `decide` and `setRole` each refuse on their own, so a new route cannot forget
 * the check: the authorisation lives with the operation rather than with the
 * URL. This file turns `NotPermitted` into a status code and nothing else.
 *
 * 404 AND NOT 403 for somebody without the role. A 403 confirms the console
 * exists and that they are simply not on the list, which is an invitation to
 * find out who is. There is no secret here worth much, and answering "no such
 * route" costs nothing.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import {
  AppointmentRefused,
  ModerationRefused,
  NotPermitted,
  REPORT_OUTCOMES,
  ROLES,
  appointmentHistory,
  canAppoint,
  canModerate,
  decide,
  listAppointments,
  moderationHistory,
  moderationQueue,
  setRole,
  SUSPENSION_DAYS,
  allSettings,
  liftSuspension,
  suspendMember,
  suspensionOf,
  writeSetting,
  type ModeratableContent,
} from "@studens/platform";
import {
  RYC_REVIEW_KIND,
  describeReviewForModeration,
  holdReview,
  releaseReview,
  reviewExists,
} from "@studens/ryc";
import { identifyIfAny } from "../identity.js";

/**
 * What can be moderated. One entry per module with reportable content.
 *
 * The same list as the intake route's, with `release` and `describe` added: a
 * module that can be reported and not released would leave content held with
 * no way back, so the two interfaces are one.
 */
const CONTENT: ModeratableContent[] = [
  {
    kind: RYC_REVIEW_KIND,
    exists: reviewExists,
    hold: holdReview,
    release: releaseReview,
    describe: describeReviewForModeration,
  },
];

export function moderationRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "8kb" }));

  /** Turns the platform's refusals into statuses. Used by every route below. */
  function refuse(res: Parameters<Parameters<Router["get"]>[1]>[1], err: unknown): boolean {
    if (err instanceof NotPermitted) {
      res.status(404).json({ error: "not found" });
      return true;
    }
    if (err instanceof AppointmentRefused) {
      res.status(400).json({ error: "appointment", reason: err.reason });
      return true;
    }
    if (err instanceof ModerationRefused) {
      res.status(400).json({ error: "moderation", reason: err.reason });
      return true;
    }
    return false;
  }

  /**
   * Whether this person has a console at all, so the interface can offer it
   * rather than making somebody guess the URL.
   *
   * Answers for everybody, including plain members, because "no" is a normal
   * answer and refusing to say would mean the app could not decide what to draw.
   */
  router.get("/moderation/whoami", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      res.json({
        canModerate: who ? canModerate(who.role) : false,
        canAppoint: who ? canAppoint(who.role) : false,
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-E12: what has been reported, oldest first, with the counts. */
  router.get("/moderation/queue", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(404).json({ error: "not found" });
        return;
      }
      try {
        const queue = await moderationQueue(prisma, who, { content: CONTENT });

        // The module hands back a course id, since it may not join across
        // schemas (FR-B10). Turning it into something readable happens here,
        // which is the only place that knows both the module and the catalogue.
        const ids = [...new Set(queue.map((q) => q.target?.courseId).filter(Boolean))] as string[];
        const courses = ids.length
          ? await prisma.course.findMany({
              where: { id: { in: ids } },
              select: { id: true, code: true },
            })
          : [];
        const codeOf = new Map(courses.map((c) => [c.id, c.code.toUpperCase()]));

        res.json({
          queue: queue.map((q) => ({
            ...q,
            oldestAt: q.oldestAt.toISOString(),
            // `courseId` is dropped rather than passed through. It is the
            // module's identifier, the console is in the shell's zone and may
            // not name what a module owns (FR-B16), and a label is all a
            // moderator needs. The boundary gate caught this.
            target: q.target
              ? {
                  targetId: q.target.targetId,
                  path: q.target.path,
                  author: q.target.author,
                  body: q.target.body,
                  advice: q.target.advice,
                  held: q.target.held,
                  context: codeOf.get(q.target.courseId) ?? null,
                }
              : null,
          })),
        });
      } catch (err) {
        if (!refuse(res, err)) throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-E10: a decision is always a human act, and always recorded.
   *
   * A POST, and it carries a reason because the audit entry without one records
   * that something happened and not why, which is half an audit trail.
   */
  router.post("/moderation/decide", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { targetKind, targetId, action, outcome, reason } = body;

      if (
        typeof targetKind !== "string" ||
        typeof targetId !== "string" ||
        typeof reason !== "string" ||
        reason.trim().length < 5
      ) {
        res.status(400).json({ error: "invalid", field: "reason" });
        return;
      }
      if (action !== "hold" && action !== "release" && action !== "leave") {
        res.status(400).json({ error: "invalid", field: "action" });
        return;
      }
      if (typeof outcome !== "string" || !(REPORT_OUTCOMES as readonly string[]).includes(outcome)) {
        res.status(400).json({ error: "invalid", field: "outcome" });
        return;
      }

      try {
        const result = await decide(
          prisma,
          who,
          { kind: targetKind, id: targetId },
          { action, outcome: outcome as "upheld" | "rejected", reason: reason.trim() },
          { content: CONTENT },
        );
        res.json(result);
      } catch (err) {
        if (!refuse(res, err)) throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-E1 read back: what moderators have done. */
  router.get("/moderation/history", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(404).json({ error: "not found" });
        return;
      }
      try {
        const events = await moderationHistory(prisma, who);
        res.json({ events: events.map((e) => ({ ...e, at: e.at.toISOString() })) });
      } catch (err) {
        if (!refuse(res, err)) throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-E14 and FR-E3: who holds a power, and how they came to. */
  router.get("/moderation/appointments", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const [appointments, history] = await Promise.all([
        listAppointments(prisma),
        appointmentHistory(prisma),
      ]);
      res.json({
        roles: ROLES,
        appointments,
        history: history.map((h) => ({ ...h, at: h.at.toISOString() })),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * SETTINGS AN ADMINISTRATOR MAY CHANGE, and only an administrator.
   *
   * `canAppoint` is the administrator test the appointments routes below
   * already use. A moderator decides about content; changing how the product
   * behaves for everybody is a different power and stays with the smaller,
   * named set (roles.ts).
   *
   * The known keys are declared here rather than accepted from the request,
   * so that a typo cannot write a row nothing will ever read, and so the
   * screen can list what exists without guessing.
   */
  const SETTINGS = [
    { key: "ryc.reviewsPerPage", min: 3, max: 50, fallback: 10 },
  ] as const;

  router.get("/moderation/settings", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const stored = new Map((await allSettings(prisma)).map((s) => [s.key, s.value]));
      res.json({
        settings: SETTINGS.map((s) => ({
          key: s.key,
          min: s.min,
          max: s.max,
          fallback: s.fallback,
          value: stored.get(s.key) ?? null,
        })),
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.patch("/moderation/settings", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const key = typeof body["key"] === "string" ? body["key"] : "";
      const known = SETTINGS.find((s) => s.key === key);
      if (!known) {
        res.status(400).json({ error: "invalid", field: "key" });
        return;
      }
      const n = Number.parseInt(String(body["value"] ?? ""), 10);
      // Refused rather than clamped. Clamping silently would tell an
      // administrator they had set 500 when they had set 50.
      if (!Number.isFinite(n) || n < known.min || n > known.max) {
        res.status(400).json({ error: "invalid", field: "value", min: known.min, max: known.max });
        return;
      }
      await writeSetting(prisma, key, String(n), who.memberId);
      await prisma.auditLog.create({
        data: {
          actorMemberId: who.memberId,
          action: `setting:${key}=${n}`,
          targetKind: "setting",
          targetId: key,
          at: new Date(),
        },
      });
      res.json({ key, value: String(n) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * SUSPENDING AN ACCOUNT. Administrator only, and it binds an account rather
   * than a person: see the note in packages/platform/src/suspension.ts, which
   * the screen repeats to whoever is about to press the button.
   */
  router.post("/moderation/suspend", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const username = typeof body["username"] === "string" ? body["username"].trim().toLowerCase() : "";
      const reason = typeof body["reason"] === "string" ? body["reason"].trim() : "";
      const lift = body["lift"] === true;
      const days = body["days"] === null ? null : Number(body["days"]);
      if (username === "" || (!lift && reason === "")) {
        res.status(400).json({ error: "invalid", field: reason === "" ? "reason" : "username" });
        return;
      }
      if (!lift && days !== null && !SUSPENSION_DAYS.includes(days as (typeof SUSPENSION_DAYS)[number])) {
        res.status(400).json({ error: "invalid", field: "days" });
        return;
      }
      const member = await prisma.member.findUnique({ where: { username }, select: { id: true, role: true } });
      if (!member) {
        res.status(404).json({ error: "no such member" });
        return;
      }
      // An administrator may not suspend themselves out of the console, and
      // may not suspend another administrator: the same shape as the
      // appointment rules, so that the last way in cannot be closed by one
      // person having a bad day.
      if (member.id === who.memberId || member.role === "admin") {
        res.status(409).json({ error: "refused" });
        return;
      }
      if (lift) {
        await liftSuspension(prisma, member.id);
      } else {
        await suspendMember(prisma, member.id, { days: days === null ? null : days, reason });
      }
      await prisma.auditLog.create({
        data: {
          actorMemberId: who.memberId,
          action: lift ? "suspend:lift" : `suspend:${days === null ? "permanent" : `${days}d`}`,
          targetKind: "member",
          targetId: member.id,
          at: new Date(),
        },
      });
      const after = await prisma.member.findUnique({
        where: { id: member.id },
        select: { suspendedAt: true, suspendedUntil: true, suspendedReason: true },
      });
      res.json({ username, suspension: after ? suspensionOf(after) : null });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-E14: an administrator appoints, one at a time, and it is recorded.
   *
   * By username rather than by member id. An administrator knows who they mean
   * by the name they see beside a review, and pasting an internal identifier is
   * how the wrong person gets appointed.
   */
  router.post("/moderation/appointments", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { username, role } = body;
      if (typeof username !== "string" || typeof role !== "string") {
        res.status(400).json({ error: "invalid" });
        return;
      }

      const member = await prisma.member.findUnique({
        where: { username: username.trim().toLowerCase() },
        select: { id: true },
      });
      if (!member) {
        // Only an administrator reaches this line, so naming the reason costs
        // nothing: they are entitled to know the name does not exist.
        res.status(400).json({ error: "appointment", reason: "unknown-member" });
        return;
      }

      try {
        res.json(await setRole(prisma, who, member.id, role));
      } catch (err) {
        if (!refuse(res, err)) throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
