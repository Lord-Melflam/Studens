/**
 * Catalogue endpoints. Read only: the catalogue is written by ingestion in the
 * worker, never by a request (docs/design/catalogue-ingestion.md).
 *
 * FR-D13: course pages are public. Reviews are not, and when they exist they
 * will sit behind a session. Nothing here needs one.
 */
import { Router } from "express";
import { Catalogue } from "@studens/ref";

export async function catalogueRoutes(snapshotPath: string): Promise<Router> {
  // Loaded once at startup. A failure here stops the process rather than
  // serving an empty catalogue, which is the same "fail loudly" rule the
  // ingestion follows.
  const catalogue = await Catalogue.open(snapshotPath);
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
    res.json({ query: q, results: catalogue.search(q) });
  });

  /** FR-D3: the course page. */
  router.get("/courses/:code", (req, res) => {
    const course = catalogue.get(req.params.code);
    if (!course) {
      res.status(404).json({ error: "no such course in this catalogue year" });
      return;
    }
    res.json(course);
  });

  return router;
}
