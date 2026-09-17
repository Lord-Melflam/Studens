/**
 * Catalogue endpoints. Read only: the catalogue is written by ingestion in the
 * worker, never by a request (docs/design/catalogue-ingestion.md).
 *
 * FR-D13: course pages are public. Reviews are not, and when they exist they
 * will sit behind a session. Nothing here needs one.
 */
import { Router } from "express";
import { DatabaseCatalogue, SnapshotCatalogue, type Catalogue } from "@studens/ref";

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
}): Promise<Router> {
  // Opened once at startup. A failure here stops the process rather than
  // serving an empty catalogue, which is the same fail-loudly rule the
  // ingestion follows.
  const catalogue: Catalogue = source.snapshotPath
    ? await SnapshotCatalogue.open(source.snapshotPath)
    : await DatabaseCatalogue.open();
  const router = Router();

  router.get("/catalogue", (_req, res) => {
    res.json({ year: catalogue.year, courses: catalogue.size });
  });

  /** FR-D1 and FR-D2: search by code, then by words in the title. */
  router.get("/courses", (req, res) => {
    const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
    if (q.trim().length < 2) {
      res.json({ query: q, results: [] });
      return;
    }
    void Promise.resolve(catalogue.search(q)).then((results) => res.json({ query: q, results }));
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
