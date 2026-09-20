/**
 * Catalogue endpoints. Read only: the catalogue is written by ingestion in the
 * worker, never by a request (docs/design/catalogue-ingestion.md).
 *
 * FR-D13: course pages are public. Reviews are not, and when they exist they
 * will sit behind a session. Nothing here needs one.
 */
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { readNumberSetting } from "@studens/platform";
import { DatabaseCatalogue, SnapshotCatalogue, type Catalogue } from "@studens/ref";

/** What a search returns per step when nothing has been configured. */
const DEFAULT_SEARCH_RESULTS = 25;

/**
 * The database is the default. A snapshot file is available for running with
 * no database at all, which is how this API worked before the catalogue was
 * loaded into Postgres.
 *
 * Note what did NOT change when the storage did: every route handler below.
 * That is what the read interface in @studens/ref is for.
 */
export async function catalogueRoutes(source: {
  snapshotPath?: string;
  /** Absent in snapshot mode, where there are no settings to read. */
  prisma?: PrismaClient | undefined;
}): Promise<Router> {
  // Opened once at startup. A failure here stops the process rather than
  // serving an empty catalogue, which is the same fail-loudly rule the
  // ingestion follows.
  const catalogue: Catalogue = source.snapshotPath
    ? await SnapshotCatalogue.open(source.snapshotPath)
    : await DatabaseCatalogue.open();
  const router = Router();

  /**
   * WHAT THE CATALOGUE HOLDS, so that nothing has to write it into copy.
   *
   * The public page used to state "546 cours" and "43 programmes" as
   * translated strings. The database holds 12,154 and 1,055, so the page was
   * wrong by a factor of twenty and had been since the crawl widened. A number
   * in a sentence is stale the moment the crawler runs again; a number fetched
   * from here cannot be.
   *
   * The institutions come with it because the same page named one university
   * as though it were the only one.
   */
  router.get("/catalogue", (_req, res) => {
    void Promise.all([
      Promise.resolve(catalogue.programmes()),
      Promise.resolve(catalogue.countsByInstitution()),
    ]).then(([programmes, institutions]) => {
      res.json({
        year: catalogue.year,
        courses: catalogue.size,
        programmes: programmes.length,
        // BROKEN DOWN BY INSTITUTION, because the app zone scopes the
        // catalogue to the member's universities and was still reporting the
        // whole thing: the same figure whether one university was chosen or
        // both. The totals stay for the public page, which is scoped to
        // nobody.
        // The PROGRAMME tally comes from this year's list, the same list the
        // total above is the length of, so the parts add up to the whole. The
        // institution table holds every programme ever loaded, which is a
        // different and larger number and would not.
        institutions: institutions.map((i) => ({
          ...i,
          programmes: programmes.filter((p) => p.institution === i.code).length,
        })),
      });
    });
  });

  /**
   * FR-D1 and FR-D2: search by code, then by words in the title.
   *
   * SCOPED BY `institutions`, comma separated, absent meaning all of them.
   * Without it the search answered from every catalogue whatever the reader
   * had chosen, so a student scoped to one university found another's courses
   * among their results. Reported from use on 2026-09-21.
   *
   * The scope is applied in the query rather than to the answer, and the
   * difference is not cosmetic: the limit is spent on whatever comes back
   * first, so narrowing afterwards truncates the catalogue the reader asked
   * for. Searching "droit" unscoped returned 24 ULB rows and 1 UCLouvain out
   * of 282 that match. See the note on `Catalogue.search`.
   */
  router.get("/courses", (req, res) => {
    const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
    if (q.trim().length < 2) {
      res.json({ query: q, results: [] });
      return;
    }
    const asked = typeof req.query["institutions"] === "string" ? req.query["institutions"] : "";
    const institutions = asked
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c !== "");
    // `total` is the catalogue's answer, `results` is the window. The page
    // said "25 of 25" without it, which is true about the array and false
    // about the catalogue: 25 is the limit, and the same query can match
    // hundreds. The real number is also the useful one, because it is what
    // tells somebody to narrow rather than scroll.
    /*
      HOW MANY COME BACK IS A PAGE SIZE, NOT A CEILING.

      It was a fixed 25 with no way past it, and the page said "25 of 25",
      which told somebody the search was complete when it was not. Telling
      them to narrow instead is no answer either: a student looking for a
      course often does not know its name, which is why they are searching.

      So `limit` lengthens the window on request, `ryc.searchResults` sets the
      step an administrator thinks is right, and the bounds are the module's
      rather than the setting's: a stored value of zero or a million must not
      be a way to take the search down, and a row can be edited by somebody
      who never saw the form.
    */
    void (async () => {
      const step = source.prisma
        ? await readNumberSetting(source.prisma, "ryc.searchResults", {
            fallback: DEFAULT_SEARCH_RESULTS,
            min: 5,
            max: 100,
          })
        : DEFAULT_SEARCH_RESULTS;
      const asked = Number.parseInt(String(req.query["limit"] ?? ""), 10);
      const limit = Math.min(
        Number.isFinite(asked) && asked > 0 ? asked : step,
        // A hard ceiling on one response, whatever the setting or the caller
        // asks for. The list grows a step at a time; it does not become a way
        // to pull the catalogue down in one request.
        500,
      );
      const [results, total] = await Promise.all([
        catalogue.search(q, { institutions, limit }),
        catalogue.searchCount(q, { institutions }),
      ]);
      res.json({ query: q, results, total, step });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  /** FR-D24 and FR-D25: browsing, for the student who does not know the code. */
  router.get("/faculties", (_req, res) => {
    void Promise.resolve(catalogue.faculties()).then((faculties) => res.json({ faculties }));
  });

  /**
   * Every programme of the year, across faculties.
   *
   * Added when the catalogue stopped being one faculty. Browsing used to make
   * somebody choose a faculty before seeing anything, which works with one and
   * fails with twenty-one: a student looking for a minor does not know which
   * faculty owns it, and UCLouvain's own catalogue does not ask.
   */
  router.get("/programmes", (_req, res) => {
    void Promise.resolve(catalogue.programmes()).then((programmes) => res.json({ programmes }));
  });

  router.get("/faculties/:code/programmes", (req, res) => {
    void Promise.resolve(catalogue.programmes(req.params.code)).then((programmes) => {
      if (programmes.length === 0) {
        res.status(404).json({ error: "no such faculty in this catalogue year" });
        return;
      }
      res.json({ faculty: req.params.code, programmes });
    });
  });

  /**
   * INSTITUTION FIRST, THEN CODE, on both of these (OPEN-48).
   *
   * A code is unique inside one catalogue and nothing more. `/courses/lepl1503`
   * had exactly one answer while one catalogue was loaded and would have had
   * two the day a second arrived, with no way for the caller to say which it
   * meant, and no way to tell from the answer which it got.
   */
  router.get("/programmes/:institution/:code/courses", (req, res) => {
    void Promise.resolve(
      catalogue.coursesOfProgramme(req.params.institution, req.params.code),
    ).then((courses) => {
      if (!courses) {
        res.status(404).json({ error: "no such programme in this catalogue year" });
        return;
      }
      res.json({ institution: req.params.institution, programme: req.params.code, courses });
    });
  });

  /** FR-D3: the course page. */
  router.get("/courses/:institution/:code", (req, res) => {
    void Promise.resolve(catalogue.get(req.params.institution, req.params.code)).then((course) => {
      if (!course) {
        res.status(404).json({ error: "no such course in this catalogue year" });
        return;
      }
      res.json(course);
    });
  });

  /**
   * Where a bare code lives, for links made before OPEN-48 was answered.
   *
   * Not a second way to fetch a course: it returns the institutions holding
   * that code and nothing else, so the caller has to go to the real address.
   * One answer means an old link can be forwarded; several mean it was always
   * ambiguous and nobody can say which was meant; none means it never existed.
   *
   * Kept deliberately thin so it cannot quietly become the address again.
   */
  router.get("/locate/:code", (req, res) => {
    void Promise.resolve(catalogue.locate(req.params.code)).then((institutions) => {
      res.json({ code: req.params.code.toLowerCase(), institutions });
    });
  });

  return router;
}
