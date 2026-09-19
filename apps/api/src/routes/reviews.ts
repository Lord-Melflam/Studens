/**
 * Review endpoints.
 *
 * The submission route is the only one in the application that touches the
 * anonymity kernel. It does as little as possible: identify, validate the
 * target, hand off. Everything that matters happens in @studens/platform.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import { QuotaExceeded, quotaRemaining, readNumberSetting, usernamesFor } from "@studens/platform";
import {
  REVIEWS_PER_PAGE,
  ReviewInvalid,
  reviewsFor,
  submitAnonymous,
  submitAttributed,
  type ReviewInput,
} from "@studens/ryc";
import { identify, identifyIfAny, NotAuthenticated } from "../identity.js";

export function reviewRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "32kb" }));

  /**
   * How many published reviews each course has, for the whole catalogue.
   *
   * This is what makes a "has reviews" filter possible, and at launch it is the
   * most useful filter there is: 10 courses of 547 have anything to read, so
   * without it browsing is mostly opening empty pages.
   *
   * It returns a TOTAL per course and not the named/anonymous split. The split
   * is public per course (FR-C21 puts it in front of a contributor before they
   * choose), but it is needed at one screen and publishing it in bulk widens
   * the surface for nothing: a per-course pair across the whole catalogue is a
   * far better starting point for the complement reasoning in 3.3 than the same
   * pair fetched one course at a time.
   *
   * Only published reviews are counted, so a held or removed one leaves no
   * trace here (FR-E).
   *
   * NOT under /courses. The catalogue router is mounted first and owns
   * /courses/:code, so /courses/review-counts was read as a course whose code
   * is "review-counts" and answered 404.
   */
  router.get("/reviews/counts", (_req, res) => {
    void (async () => {
      const [named, anon] = await Promise.all([
        prisma.reviewAttributed.groupBy({
          by: ["courseId"],
          where: { status: "published" },
          _count: { _all: true },
        }),
        prisma.reviewAnonymous.groupBy({
          by: ["courseId"],
          where: { status: "published" },
          _count: { _all: true },
        }),
      ]);

      const totals = new Map<string, number>();
      for (const row of [...named, ...anon]) {
        totals.set(row.courseId, (totals.get(row.courseId) ?? 0) + row._count._all);
      }
      if (totals.size === 0) {
        res.json({ counts: {} });
        return;
      }

      const courses = await prisma.course.findMany({
        where: { id: { in: [...totals.keys()] } },
        select: { id: true, code: true, institution: { select: { code: true } } },
      });
      // KEYED BY INSTITUTION AND CODE, because a bare code is not a course
      // (OPEN-48). Keyed by code alone, two universities sharing a string
      // would have had one of their counts overwrite the other's, and the
      // number on screen would have been wrong with nothing to notice it.
      const counts: Record<string, number> = {};
      for (const c of courses) {
        counts[`${c.institution.code}/${c.code}`] = totals.get(c.id) ?? 0;
      }
      res.json({ counts });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * A course, by the institution and code in the URL (OPEN-48).
   *
   * It took a bare code until 2026-09-18 and ordered the ambiguity away, which
   * was stable and was still a guess. It matters more here than on the read
   * path: attaching a review to the wrong university's course is a wrong row,
   * not a wrong page, and nothing downstream would ever notice.
   *
   * `findFirst` rather than `findUnique` only because the unique key is on ids
   * and this matches on two codes.
   */
  const courseByCode = (client: PrismaClient, institution: string, code: string) =>
    client.course.findFirst({
      where: {
        code: code.toLowerCase(),
        institution: { code: institution.toLowerCase() },
      },
    });

  /**
   * FR-C21: the counts a contributor needs BEFORE choosing a path.
   *
   * Both numbers are already public on the course page, so this discloses
   * nothing new. It exists so the choice can be made with them in view.
   */
  router.get("/courses/:institution/:code/review-context", (req, res) => {
    void (async () => {
      const course = await courseByCode(prisma, req.params.institution, req.params.code);
      if (!course) {
        res.status(404).json({ error: "no such course" });
        return;
      }
      const [named, anonymous] = await Promise.all([
        prisma.reviewAttributed.count({ where: { courseId: course.id, status: "published" } }),
        prisma.reviewAnonymous.count({ where: { courseId: course.id, status: "published" } }),
      ]);

      // A GET must not start a session: SameSite=Lax sends the cookie on a
      // cross-site top-level GET, so a GET that changes state is reachable from
      // another site. See docs/design/authentication.md 0.3.
      const who = await identifyIfAny(prisma, req);
      const remaining = who ? await quotaRemaining(who.memberId, { client: prisma }) : null;
      res.json({ course: course.code, named, anonymous, quotaRemaining: remaining });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /**
   * FR-D13: course pages are public, reviews are not.
   *
   * Without a session this returns the AGGREGATE and no review bodies. The
   * aggregate is a property of the course rather than of any contributor, and
   * withholding it would make the course page useless to a visitor for no
   * privacy gain.
   */
  router.get("/courses/:institution/:code/reviews", (req, res) => {
    void (async () => {
      const course = await courseByCode(prisma, req.params.institution, req.params.code);
      if (!course) {
        res.status(404).json({ error: "no such course" });
        return;
      }
      // The composition point: the module asks for names, the platform
      // answers. Neither one gains the other's access (FR-B11).
      // `?page=` and nothing else. The SIZE of a page is not a parameter: a
      // caller that could ask for ten thousand reviews in one request is the
      // unbounded response this exists to prevent, so it is the module's
      // constant and the client does not get a say.
      const asked = Number.parseInt(String(req.query["page"] ?? "1"), 10);
      // HOW MANY FIT ON A PAGE IS AN ADMINISTRATOR'S CHOICE, read here rather
      // than baked in. Ten per page is a guess, not a fact: five may suit
      // better, and whoever runs the platform is the one who can tell. The
      // bounds are the module's, not the setting's: a stored
      // value of zero or of a million must not be a way to take a page down,
      // and a row can be edited by somebody who never saw the form.
      const perPage = await readNumberSetting(prisma, "ryc.reviewsPerPage", {
        fallback: REVIEWS_PER_PAGE,
        min: 3,
        max: 50,
      });
      const { reviews, aggregate, page, pages, total } = await reviewsFor(prisma, course.id, {
        names: (ids) => usernamesFor(prisma, ids),
        page: Number.isFinite(asked) ? asked : 1,
        perPage,
      });

      const signedIn = (await identifyIfAny(prisma, req)) !== null;
      if (!signedIn) {
        // The counts still go out. They describe the course, not any
        // contributor, and FR-D13 withholds the bodies rather than the shape.
        res.json({ aggregate, reviews: [], sessionRequired: true, page, pages, total });
        return;
      }
      res.json({ aggregate, reviews, sessionRequired: false, page, pages, total });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.post("/courses/:institution/:code/reviews", (req, res) => {
    void (async () => {
      const who = await identify(prisma, req, res);

      const course = await courseByCode(prisma, req.params.institution, req.params.code);
      if (!course) {
        res.status(404).json({ error: "no such course" });
        return;
      }

      const body = req.body as Partial<ReviewInput> & { anonymous?: unknown };
      const anonymous = body.anonymous === true;
      const input: ReviewInput = {
        courseId: course.id,
        academicYear: Number(body.academicYear),
        recommendation: Number(body.recommendation),
        workloadVsEcts: Number(body.workloadVsEcts),
        difficulty: Number(body.difficulty),
        hoursPerWeek: body.hoursPerWeek === undefined || body.hoursPerWeek === null
          ? undefined
          : Number(body.hoursPerWeek),
        passed: typeof body.passed === "boolean" ? body.passed : undefined,
        body: String(body.body ?? ""),
        advice: body.advice ? String(body.advice) : undefined,
        completed: body.completed === true,
      };

      // The two paths are called separately and share no branch beyond this
      // point. FR-C6 in code: not one function with a flag.
      const created = anonymous
        ? await submitAnonymous(who.memberId, input, { client: prisma })
        : await submitAttributed(who.memberId, input, { client: prisma });

      // The response carries the id ONLY for the attributed path. Returning it
      // for an anonymous submission would hand the client a handle to a row
      // nobody is supposed to be able to point at (FR-C9).
      res.status(201).json(anonymous ? { anonymous: true } : { anonymous: false, id: created.id });
    })().catch((err: unknown) => {
      if (err instanceof NotAuthenticated) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      if (err instanceof ReviewInvalid) {
        res.status(400).json({ error: "invalid", field: err.field, detail: err.message });
        return;
      }
      if (err instanceof QuotaExceeded) {
        res.status(429).json({ error: "quota exhausted", detail: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        res.status(409).json({ error: "already reviewed", detail: "FR-D9: one review per course per year" });
        return;
      }
      res.status(500).json({ error: "unavailable" });
    });
  });

  return router;
}
