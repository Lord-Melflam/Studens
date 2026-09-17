/**
 * UCLouvain, as a source.
 *
 * A WRAPPER, AND DELIBERATELY NOTHING ELSE. Every line of the crawler it calls
 * is where it was: `ingestion/crawl.ts`, `ingestion/urls.ts` and
 * `ingestion/parse/` are unchanged by the introduction of sources. This file
 * exists so that the one crawler that has completed a full run keeps working
 * exactly as it did while a second institution is added beside it.
 *
 * If this file is ever more than delegation, something has been moved that was
 * supposed to stay put.
 */
import { crawl } from "../ingestion/crawl.js";
import { courseUrl, programmeUrl } from "../ingestion/urls.js";
import type { CatalogueSource, SourceCrawlOptions } from "./index.js";
import type { Snapshot } from "../ingestion/snapshot.js";

export const uclouvain: CatalogueSource = {
  institution: "uclouvain",
  label: "UCLouvain",
  crawl: (opts: SourceCrawlOptions = {}): Promise<Snapshot> => crawl(opts),
  courseUrl,
  programmeUrl,
};
