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
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  FEEDBACK_PER_PAGE,
  feedbackAuthors,
  listFeedback,
  setFeedbackStatus,
  exportFeedback,
  decide,
  listAppointments,
  listMembers,
  readNumberSetting,
  revealAddress,
  eraseMemberAsAdmin,
  DeletionRefused,
  DIRECTORY_PER_PAGE,
  moderationHistory,
  moderationQueue,
  setRole,
  SUSPENSION_DAYS,
  allSettings,
  liftSuspension,
  suspendMember,
  writeSetting,
  type ModeratableContent,
  type Role,
} from "@studens/platform";
import {
  RYC_REVIEW_KIND,
  describeReviewForModeration,
  holdReview,
  releaseReview,
  reviewExists,
} from "@studens/ryc";
import { identifyIfAny } from "../identity.js";
import { ERASURES } from "../erasures.js";

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
  /**
   * WHAT EACH KEY ACTUALLY DOES, IN WORDS, AND WHY THE WORDS ARE HERE.
   *
   * The console showed three keys, three number fields and a range. A key is
   * the right LABEL, because it is what an administrator sees in the audit log
   * and because translating it would put a module's vocabulary in the shell,
   * which FR-B16 forbids and a gate catches. But a key is not an explanation,
   * and the three differ enormously in consequence: one changes how long a
   * page is, another changes how much anybody may publish in a week. Setting
   * the wrong one is a mistake the screen invited.
   *
   * So the text is served, not translated in the shell. This file is the
   * composition layer, the one place allowed to know both the platform and the
   * modules, so it is where a sentence about reviews may legally be written.
   * The console renders a string it was given and still contains none of the
   * vocabulary itself.
   *
   * All three languages are sent rather than the member's own. The payload is
   * a few hundred bytes, the shell already knows which language it is drawing,
   * and negotiating a locale on this one endpoint would be a second mechanism
   * for something the client already does.
   */
  const SETTINGS = [
    {
      key: "ryc.reviewsPerPage",
      min: 3,
      max: 50,
      fallback: 10,
      help: {
        fr: "Combien d'avis s'affichent d'un coup sur la fiche d'un cours, avant de devoir passer à la page suivante. N'affecte pas ce qui peut être publié.",
        nl: "Hoeveel beoordelingen tegelijk op een cursusfiche verschijnen, voor je naar de volgende pagina moet. Heeft geen invloed op wat gepubliceerd mag worden.",
        en: "How many reviews appear at once on a course page before the next page is needed. Does not affect what may be published.",
      },
    },
    {
      key: "ryc.searchResults",
      min: 5,
      max: 100,
      fallback: 25,
      help: {
        fr: "Combien de résultats de recherche arrivent par étape. Ce n'est pas un plafond : la liste indique combien de cours correspondent et s'allonge à la demande, donc aucun cours ne devient introuvable.",
        nl: "Hoeveel zoekresultaten per stap binnenkomen. Geen plafond: de lijst zegt hoeveel cursussen overeenkomen en wordt op verzoek langer, dus geen enkele cursus wordt onvindbaar.",
        en: "How many search results arrive per step. Not a ceiling: the list says how many courses matched and lengthens on request, so no course becomes unfindable.",
      },
    },
    // THE CEILING IS ANTI-TYPO, NOT POLICY. A five year degree is fifty to
    // sixty courses, and the alumnus reviewing all of them in one sitting is
    // the contributor this product most wants, so a ceiling near that number
    // is aimed at exactly the wrong person. A thousand is far past anything a
    // human writes in a week and still stops a slipped keystroke turning the
    // limit off by accident.
    //
    // The floor is 1 rather than 0. Zero would be a way to stop the product
    // accepting contributions at all from a settings form, which is a
    // different decision from rate limiting and should not wear its clothes.
    {
      key: "platform.quotaPerWindow",
      min: 1,
      max: 1000,
      fallback: 5,
      help: {
        fr: "Combien de publications un même compte peut faire par période (FR-C4). Monter ce nombre au lancement est normal : un ancien étudiant qui veut donner son avis sur les soixante cours de son cursus le fait en une fois, et c'est exactement le contributeur recherché. Le baisser restreint tout le monde, y compris de bonne foi. Ce nombre borne des COMPTES, pas des personnes : c'est un ralentisseur, jamais une garantie.",
        nl: "Hoeveel publicaties één account per periode mag doen (FR-C4). Dit bij de lancering verhogen is normaal: een oud-student die zestig cursussen wil beoordelen doet dat in één keer, en dat is precies de gewenste bijdrager. Verlagen beperkt iedereen, ook te goeder trouw. Dit getal begrenst ACCOUNTS, geen personen: een drempel, nooit een garantie.",
        en: "How many contributions one account may publish per period (FR-C4). Raising it at launch is reasonable: an alumnus reviewing the sixty courses of their degree does it in one sitting, and that is exactly the contributor this wants. Lowering it restricts everybody, including in good faith. It bounds ACCOUNTS, not people: a speed bump, never a guarantee.",
      },
    },
    // The window length. Changing it makes every stored counter belong to a
    // window that no longer exists, so every member gets one fresh allowance
    // at that moment. That is a real consequence and it is stated on screen
    // rather than being a reason to forbid the control: it can only loosen, it
    // happens once, and it is recorded in the audit log like every other
    // change here.
    {
      key: "platform.directoryPageSize",
      min: 5,
      max: 100,
      fallback: 25,
      help: {
        fr: "Combien de membres s'affichent par page dans la liste des membres. Ce n'est pas un plafond : la liste indique le nombre total et se parcourt page par page, donc personne ne devient invisible en augmentant le nombre d'inscrits.",
        nl: "Hoeveel leden per pagina in de ledenlijst verschijnen. Geen plafond: de lijst toont het totaal en wordt pagina per pagina doorlopen, dus niemand wordt onzichtbaar naarmate er meer leden bijkomen.",
        en: "How many members appear per page in the member list. Not a ceiling: the list states the total and is walked page by page, so nobody becomes invisible as the number of members grows.",
      },
    },
    {
      key: "platform.feedbackPageSize",
      min: 5,
      max: 100,
      fallback: 25,
      help: {
        fr: "Combien de retours s'affichent par page dans la liste des retours. Ce n'est pas un plafond : la liste indique le total et se parcourt page par page. C'est la liste qui grossit le plus vite, parce qu'un lien public veut dire que beaucoup de gens écrivent en même temps.",
        nl: "Hoeveel reacties per pagina in de lijst verschijnen. Geen plafond: de lijst toont het totaal en wordt pagina per pagina doorlopen. Dit is de lijst die het snelst groeit, want een publieke link betekent dat veel mensen tegelijk schrijven.",
        en: "How many pieces of feedback appear per page. Not a ceiling: the list states the total and is walked page by page. This is the fastest-growing list there is, because a public link means many people write at once.",
      },
    },
    {
      key: "platform.quotaWindowDays",
      min: 1,
      max: 365,
      fallback: 7,
      help: {
        fr: "Sur combien de jours le compteur ci-dessus est calculé. Attention : changer cette valeur remet tous les compteurs à zéro une fois, donc chacun repart avec son quota entier à cet instant. Cela ne peut qu'assouplir, jamais restreindre d'un coup, et le changement est inscrit au journal.",
        nl: "Over hoeveel dagen de teller hierboven wordt berekend. Let op: deze waarde wijzigen zet alle tellers één keer op nul, dus iedereen begint op dat moment met een volledig quotum. Dat kan alleen versoepelen, nooit plots beperken, en de wijziging komt in het logboek.",
        en: "Over how many days the count above is measured. Note: changing this resets every counter once, so everybody starts again with a full allowance at that moment. It can only loosen, never suddenly restrict, and the change is recorded in the log.",
      },
    },
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
          help: s.help,
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
      const outcome = lift
        ? await liftSuspension(prisma, member.id)
        : await suspendMember(prisma, member.id, { days: days === null ? null : days, reason });
      await prisma.auditLog.create({
        data: {
          actorMemberId: who.memberId,
          action: lift ? "suspend:lift" : `suspend:${days === null ? "permanent" : `${days}d`}`,
          targetKind: "member",
          targetId: member.id,
          at: new Date(),
        },
      });
      // `notified` travels back to the screen, because whether the person was
      // actually told is the first thing the administrator needs to know and
      // the one thing they cannot find out later: there is no confirmed
      // address on most accounts, and a console that stayed quiet about it
      // would leave somebody believing a message went out.
      res.json({ username, suspension: outcome, notified: outcome.notified });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * WHO IS SUSPENDED RIGHT NOW, and why.
   *
   * WHY IT IS A LIST AND NOT A COUNT. The suspend form takes a username, which
   * means the only way to check whether somebody is already suspended, or what
   * they were suspended for, or when it ends, was to suspend them again and
   * read the answer. A power with no register is a power nobody can review,
   * and FR-E14's reasoning about appointments applies here at least as hard:
   * this one stops a person using the platform.
   *
   * PAGED FROM THE FIRST DAY, WITH A SEARCH. There are two suspended accounts
   * today and the shape of the screen has to be the shape it will have at two
   * hundred; a list that is fine until it is not is a rewrite scheduled for
   * the least convenient moment. Twenty a page, and a filter by name, because
   * past a page the question stops being "who is suspended" and becomes "is
   * this person suspended".
   *
   * ONLY CURRENT ONES. An expired suspension is over, and the columns are left
   * behind only so the history stays readable; listing them here would turn a
   * register of who is stopped into a permanent record of who ever was, which
   * is a different and much worse thing to keep. What happened is in the audit
   * log, which is where a record of the past belongs.
   */
  const SUSPENDED_PER_PAGE = 20;

  /**
   * WHO IS REGISTERED. Administrators only, like the settings beside it.
   *
   * A moderator decides about content and needs no list of people; knowing who
   * exists is a different power and stays with the smaller named set. The
   * answer to somebody without it is 404 and not 403, so the endpoint does not
   * teach a moderator that it exists.
   *
   * Searching, filtering and windowing all happen in SQL. A thousand members
   * is a thousand rows, and sending them to the browser to filter would be the
   * unbounded response NFR-O4 exists to prevent, on the one number this
   * product actually wants to grow.
   */
  router.get("/moderation/members", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      // READABLE BY A MODERATOR, and this is the line worth stating. The LIST
      // carries a username, a role, an email DOMAIN and whether an address
      // exists; it answers "who is this person I am about to act on", which is
      // the question a moderator has while reading a report. The two things
      // that lead somewhere are the address itself and the erasure, and both
      // stay administrators' below (FR-E18, FR-E19).
      if (!who || !canModerate(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
      const asked = Number.parseInt(String(req.query["page"] ?? "1"), 10);
      // An unknown role is treated as no filter rather than as an error: it
      // comes from a URL, and a stale one should show everybody rather than
      // empty the screen with nothing to unclick (FR-B21's habit).
      const wanted = typeof req.query["role"] === "string" ? req.query["role"] : "";
      const role = ROLES.includes(wanted as Role) ? wanted : undefined;

      // NFR-O4. Bounded whatever an administrator sets: the kernel clamps to
      // 100, so a stored value of ten thousand cannot turn this back into the
      // unbounded list it was written not to be.
      const perPage = await readNumberSetting(prisma, "platform.directoryPageSize", {
        fallback: DIRECTORY_PER_PAGE,
        min: 5,
        max: 100,
      });
      const out = await listMembers({
        client: prisma,
        q,
        ...(role ? { role } : {}),
        page: Number.isFinite(asked) ? asked : 1,
        perPage,
      });
      res.json({
        ...out,
        members: out.members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
        // So the screen can build its filter from the server's own list rather
        // than hardcoding role names, the way the appointments screen does.
        roles: ROLES,
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-I3: the feedback queue.
   *
   * ADMINISTRATORS AND MODERATORS BOTH, which is not true of the member
   * directory next door. A moderator already reads what people report about
   * CONTENT; what people report about the product is the same job pointed at
   * a different thing, and hiding it from them means the person most likely
   * to notice a pattern cannot see one. They cannot export it (FR-I4), which
   * is where the identifiers are.
   */
  router.get("/moderation/feedback", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canModerate(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
      const asked = Number.parseInt(String(req.query["page"] ?? "1"), 10);
      // Unknown values are treated as no filter rather than as an error: they
      // come from a URL, and a stale one should show everything rather than
      // empty the screen with nothing to unclick.
      const wantedKind = typeof req.query["kind"] === "string" ? req.query["kind"] : "";
      const kind = (FEEDBACK_KINDS as readonly string[]).includes(wantedKind)
        ? wantedKind
        : undefined;
      const wantedStatus = typeof req.query["status"] === "string" ? req.query["status"] : "";
      const status = (FEEDBACK_STATUSES as readonly string[]).includes(wantedStatus)
        ? wantedStatus
        : undefined;
      const author = typeof req.query["author"] === "string" ? req.query["author"] : undefined;

      // NFR-O4, and this is the list most likely to grow fast: a public link
      // means many people write at once. Bounded whatever is stored, because
      // the kernel clamps to 100.
      const perPage = await readNumberSetting(prisma, "platform.feedbackPageSize", {
        fallback: FEEDBACK_PER_PAGE,
        min: 5,
        max: 100,
      });
      const out = await listFeedback({
        client: prisma,
        q,
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
        ...(author ? { author } : {}),
        page: Number.isFinite(asked) ? asked : 1,
        perPage,
      });
      res.json({
        ...out,
        items: out.items.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
          // THE ADDRESS NEVER REACHES THIS SCREEN. Whether one was left is
          // what a reader needs in order to know an answer is possible; the
          // address itself is personal data and the list is not where it is
          // read, exactly as with the member directory (FR-E18).
          contactEmail: undefined,
          hasEmail: f.contactEmail !== null,
        })),
        kinds: FEEDBACK_KINDS,
        statuses: FEEDBACK_STATUSES,
        perPage,
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** Who has written in and how often, so the screen can group by sender. */
  router.get("/moderation/feedback/authors", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canModerate(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json({ authors: await feedbackAuthors({ client: prisma }) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-I4: the whole queue as a JSON file.
   *
   * ADMINISTRATORS ONLY, unlike reading the queue. A moderator reads what
   * people wrote; an export is a copy that leaves this machine, and the full
   * scope carries addresses and usernames. That is the same line the member
   * directory draws.
   *
   * THE ANONYMISED SCOPE IS A GET, because it is a download and a link is how
   * downloads work. THE FULL SCOPE IS A POST carrying a typed confirmation,
   * because it is not the kind of thing that should happen from a link
   * somebody clicks, and because an audit row with no deliberate act behind it
   * records an accident.
   *
   * THE TYPED WORD IS THE ADMINISTRATOR'S OWN USERNAME, not a fixed word like
   * EXPORT. FR-E19 chose a typed name over a fixed word for the same reason:
   * a fixed word becomes muscle memory within a week. There is no target
   * member here to name, so the name is theirs, which also makes the audit row
   * and the act agree about who did it.
   */
  router.get("/moderation/feedback/export", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const file = await exportFeedback({
        client: prisma,
        scope: "anonymised",
        secret: process.env["STUDENS_SESSION_SECRET"] ?? "",
      });
      res.setHeader("content-disposition", 'attachment; filename="studens-feedback.json"');
      res.json(file);
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.post("/moderation/feedback/export", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const confirm = (req.body ?? {})["confirm"];
      const me = await prisma.member.findUnique({
        where: { id: who.memberId },
        select: { username: true },
      });
      if (typeof confirm !== "string" || me?.username == null || confirm.trim() !== me.username) {
        res.status(400).json({ error: "confirm" });
        return;
      }
      const file = await exportFeedback({
        client: prisma,
        scope: "full",
        secret: process.env["STUDENS_SESSION_SECRET"] ?? "",
        actorMemberId: who.memberId,
      });
      res.setHeader("content-disposition", 'attachment; filename="studens-feedback-full.json"');
      res.json(file);
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** Move one row through open, read and done. */
  router.post("/moderation/feedback/:id/status", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canModerate(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const status = (req.body ?? {})["status"];
      if (typeof status !== "string") {
        res.status(400).json({ error: "invalid" });
        return;
      }
      try {
        await setFeedbackStatus(String(req.params.id), status, { client: prisma });
        res.json({ ok: true });
      } catch {
        res.status(400).json({ error: "invalid" });
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * ONE MEMBER'S ADDRESS, read deliberately and written to the audit log.
   *
   * Separate from the list on purpose. The privacy statement tells members
   * their address is kept in order to contact them, so an administrator
   * reading one is a different purpose; the difference between that being
   * acceptable and troubling is whether anybody could tell it happened. The
   * audit row is written in the same transaction as the read, so it cannot be
   * skipped.
   */
  router.get("/moderation/members/:id/address", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const found = await revealAddress(who.memberId, String(req.params.id), { client: prisma });
      if (!found) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json(found);
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-E19: carry out an erasure the member cannot carry out themselves.
   *
   * DELETE, not POST, because that is what it is. Administrators only, 404 to
   * anybody else, and the refusals are the two states a database would be
   * needed to undo: deleting yourself, and deleting the last administrator.
   *
   * This is NOT the moderation answer to a person being a problem. That is
   * suspension, which tells them why and can be undone. The console places the
   * two apart deliberately.
   */
  router.delete("/moderation/members/:id", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who || !canAppoint(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      try {
        const out = await eraseMemberAsAdmin(prisma, who.memberId, String(req.params.id), {
          erasures: ERASURES,
        });
        res.json({ erased: true, username: out.username });
      } catch (err) {
        if (err instanceof DeletionRefused) {
          res.status(400).json({ error: err.reason });
          return;
        }
        throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.get("/moderation/suspensions", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      // Readable by a moderator: they are the people most likely to open a
      // report about an account somebody has already dealt with, and without
      // this they cannot tell. Taking a suspension is still an
      // administrator's (`/moderation/suspend` below).
      if (!who || !canModerate(who.role)) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const q = typeof req.query["q"] === "string" ? req.query["q"].trim().toLowerCase() : "";
      const asked = Number.parseInt(String(req.query["page"] ?? "1"), 10);
      const page = Number.isFinite(asked) && asked > 0 ? asked : 1;
      const now = new Date();
      const where = {
        suspendedAt: { not: null },
        // Expired ones are not suspensions any more, and the same arithmetic
        // decides it here and in suspensionOf: one rule, two readers.
        OR: [{ suspendedUntil: null }, { suspendedUntil: { gt: now } }],
        ...(q === "" ? {} : { username: { contains: q } }),
      };
      const total = await prisma.member.count({ where });
      const pages = Math.max(1, Math.ceil(total / SUSPENDED_PER_PAGE));
      const rows = await prisma.member.findMany({
        where,
        // Most recent first: the decision somebody is asking about is almost
        // always the one just taken.
        orderBy: [{ suspendedAt: "desc" }, { username: "asc" }],
        skip: (Math.min(page, pages) - 1) * SUSPENDED_PER_PAGE,
        take: SUSPENDED_PER_PAGE,
        select: {
          id: true,
          username: true,
          suspendedAt: true,
          suspendedUntil: true,
          suspendedReason: true,
          contactEmail: true,
          contactVerifiedAt: true,
        },
      });

      // Who decided, from the audit log rather than from a column on the
      // member. The log is the record (FR-E14) and duplicating the actor onto
      // the account would give two answers that can disagree.
      const entries = await prisma.auditLog.findMany({
        where: {
          targetKind: "member",
          targetId: { in: rows.map((r) => r.id) },
          action: { startsWith: "suspend:" },
        },
        orderBy: { at: "desc" },
        select: { targetId: true, actorMemberId: true },
      });
      const actorIds = [...new Set(entries.map((e) => e.actorMemberId))];
      const actors = new Map(
        (
          await prisma.member.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, username: true },
          })
        ).map((m) => [m.id, m.username]),
      );
      const decidedBy = new Map<string, string | null>();
      for (const e of entries) {
        // Newest first, so the first one seen for a member is the current one.
        if (!decidedBy.has(e.targetId)) decidedBy.set(e.targetId, actors.get(e.actorMemberId) ?? null);
      }

      res.json({
        page: Math.min(page, pages),
        pages,
        total,
        suspensions: rows.map((r) => ({
          username: r.username,
          since: r.suspendedAt,
          until: r.suspendedUntil,
          reason: r.suspendedReason,
          by: decidedBy.get(r.id) ?? null,
          // Not the address itself, only whether one exists that may be
          // written to. The console has no business reading somebody's mail
          // address to answer the question it actually has, which is whether
          // this person was reachable when the decision was taken.
          reachable: Boolean(r.contactEmail && r.contactVerifiedAt !== null),
        })),
      });
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
