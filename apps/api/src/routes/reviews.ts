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
  editAttributed,
  myReviews,
  MINE_PER_PAGE,
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
   * Course ids to something a person can read, for the list of a member's own
   * reviews. The module stores ids and may not read the catalogue itself
   * (FR-B11), so the join happens here, where both are in scope.
   */
  const coursesByIds = async (client: PrismaClient, ids: string[]) => {
    if (ids.length === 0) return new Map<string, { institution: string; code: string; title: string }>();
    const rows = await client.course.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: {
        id: true,
        code: true,
        institution: { select: { code: true } },
        // The most recent description carries the title somebody would
        // recognise. A course with no offering at all still gets its code.
        offerings: { orderBy: { year: "desc" }, take: 1, select: { title: true } },
      },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          institution: r.institution.code,
          code: r.code,
          title: r.offerings[0]?.title ?? r.code.toUpperCase(),
        },
      ]),
    );
  };

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

  /**
   * FR-D12: everything this member published under their name.
   *
   * A course label comes with each row, because a review means nothing
   * without the course it is about and the module holds the ids, not the
   * titles. Resolved here rather than in the kernel: `@studens/ryc` may not
   * read the catalogue (FR-B11), so the two are joined at the composition
   * layer, which is what this file is.
   *
   * THERE IS NO ANONYMOUS COUNTERPART AND THERE CANNOT BE. That table holds
   * no member column (FR-C20), so nothing can answer "which of these is
   * mine" for anybody, including the author. FR-C9 is that absence.
   */
  router.get("/reviews/mine", (req, res) => {
    void (async () => {
      const who = await identify(prisma, req, res);
      // `?page=` and nothing else, the same shape the course page uses and for
      // the same reason: the SIZE of a page is the module's constant, so no
      // caller can ask for every row at once. The administrator's setting is
      // shared with the course page deliberately. The quantity being bounded
      // is the same one (how many review bodies a single response carries) and
      // the reason to change it is the same (the screen is too long, or too
      // short to be worth the press). A second setting would need its own
      // explanation on a form for a difference nobody outside this file can
      // see. Accepted cost: the two screens cannot be tuned apart. Evidence
      // that they want different numbers would change the answer.
      const asked = Number.parseInt(String(req.query["page"] ?? "1"), 10);
      const perPage = await readNumberSetting(prisma, "ryc.reviewsPerPage", {
        fallback: MINE_PER_PAGE,
        min: 3,
        max: 50,
      });
      const { reviews: rows, total } = await myReviews(who.memberId, {
        client: prisma,
        page: Number.isFinite(asked) ? asked : 1,
        perPage,
      });
      const courses = await coursesByIds(prisma, rows.map((r) => r.courseId));
      res.json({
        page: Number.isFinite(asked) && asked > 1 ? asked : 1,
        pages: Math.max(1, Math.ceil(total / perPage)),
        total,
        reviews: rows.map((r) => ({
          id: r.id,
          academicYear: r.academicYear,
          recommendation: r.recommendation,
          workloadVsEcts: r.workloadVsEcts,
          difficulty: r.difficulty,
          hoursPerWeek: r.hoursPerWeek,
          passed: r.passed,
          body: r.body,
          advice: r.advice,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          /** Said plainly, because a held review looks missing otherwise. */
          held: r.status !== "published",
          course: courses.get(r.courseId) ?? null,
        })),
      });
    })().catch((err: unknown) => {
      // ANSWERED, never dropped. `identify` throws and sends nothing, so a
      // handler that returns here leaves the request open: the browser waits
      // for a response that will never come, and the screen sits on its
      // loading line for as long as somebody is willing to look at it. The
      // submission route already answered 401 here; these two did not.
      if (err instanceof NotAuthenticated) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      res.status(500).json({ error: "unavailable" });
    });
  });

  /**
   * FR-C14: the author changes what they said.
   *
   * PATCH on the review rather than a second POST to the course, because
   * this replaces one contribution rather than adding one, and the
   * difference is what keeps the quota and the one-per-course rule honest.
   *
   * The member is taken from the session and passed to the kernel, which
   * scopes its query by it. An id belonging to somebody else matches no row
   * and comes back as the same refusal as an id that does not exist, so the
   * endpoint cannot be used to learn which review ids are real.
   */
  router.patch("/reviews/:id", (req, res) => {
    void (async () => {
      const who = await identify(prisma, req, res);
      const body = req.body as Partial<ReviewInput>;
      try {
        const updated = await editAttributed(
          who.memberId,
          String(req.params.id),
          {
            recommendation: Number(body.recommendation),
            workloadVsEcts: Number(body.workloadVsEcts),
            difficulty: Number(body.difficulty),
            hoursPerWeek:
              body.hoursPerWeek === undefined || body.hoursPerWeek === null
                ? undefined
                : Number(body.hoursPerWeek),
            passed: typeof body.passed === "boolean" ? body.passed : undefined,
            body: String(body.body ?? ""),
            advice: body.advice ? String(body.advice) : undefined,
            completed: body.completed === true,
          },
          { client: prisma },
        );
        res.json({ id: updated.id, updatedAt: updated.updatedAt.toISOString() });
      } catch (err) {
        if (err instanceof ReviewInvalid) {
          res.status(400).json({ error: "invalid", field: err.field });
          return;
        }
        throw err;
      }
    })().catch((err: unknown) => {
      // Answered, never dropped: see the note on the listing route above.
      if (err instanceof NotAuthenticated) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      res.status(500).json({ error: "unavailable" });
    });
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
