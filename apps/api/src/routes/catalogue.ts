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

  /** FR-D3: the course page. */
  router.get("/courses/:code", (req, res) => {
    void Promise.resolve(catalogue.get(req.params.code)).then((course) => {
      if (!course) {
        res.status(404).json({ error: "no such course in this catalogue year" });
        return;
      }
      res.json(course);
    });
  });

  return router;
}
