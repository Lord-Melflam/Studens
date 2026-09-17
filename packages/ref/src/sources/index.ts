/**
 * ONE INSTITUTION'S CATALOGUE, AND HOW TO READ IT.
 *
 * Studens starts with UCLouvain and ULB (François, 2026-09-17), and those two
 * publish their catalogues in shapes that have nothing in common. UCLouvain
 * walks faculty indexes and has a search application beside them; ULB has a
 * sitemap, a programme endpoint that returns rendered HTML inside JSON, and
 * course pages in the same path namespace as its programmes. The parts that
 * differ are the crawl and the URL grammar. The part that must not differ is
 * what comes out: a `Snapshot`, which the loader already knows how to store.
 *
 * WHY AN INTERFACE AND NOT A SECOND SCRIPT. A second script duplicates the
 * orchestration, and the orchestration is where the hard-won parts live: the
 * retry policy, the budget, the progress reporting, the accounting for what a
 * run could not reach. Duplicated, the second copy gets the lessons the first
 * one learned only if somebody remembers to copy them across.
 *
 * WHY THE UCLOUVAIN CRAWLER IS NOT MOVED INTO IT. François, 2026-09-18: "keep
 * the uclouvain crawler untouched". It is the only crawler here that has ever
 * completed a full run, 78 minutes and about ten thousand requests, and every
 * defect it has met is written into it. So `uclouvain.ts` DELEGATES to it and
 * changes nothing: `crawl.ts`, `urls.ts` and `parse/` are byte for byte what
 * they were. A refactor would have been tidier and would have put the one
 * working thing at risk to make room for a thing that does not exist yet.
 *
 * The cost accepted: the interface is shaped by the source that already works,
 * so it may fit ULB less well than a design drawn from both would have. That
 * is the right way round. It can be widened when ULB shows where it pinches,
 * and widening an interface with two implementations is a smaller act than
 * rewriting a crawler with one.
 */
import type { Snapshot } from "../ingestion/snapshot.js";
import type { PoliteFetcher } from "../ingestion/http.js";

export interface SourceCrawlOptions {
  year?: number;
  /** Restrict to these faculty codes. Empty means every faculty discovered. */
  onlyFaculties?: string[];
  /** Stop after this many offerings. For a scoped run, not for correctness. */
  maxOfferings?: number;
  fetcher?: PoliteFetcher;
  now?: Date;
  onProgress?: (msg: string) => void;
}

export interface CatalogueSource {
  /**
   * The institution's code, matching `ref.Institution.code`.
   *
   * The join between a crawl and the row its results are filed under, and the
   * reason a load cannot invent an institution: `load.ts` looks this up and
   * fails when it names nothing, rather than creating a university.
   */
  readonly institution: string;
  /** For logs and for the progress lines a person reads during a crawl. */
  readonly label: string;
  crawl(opts?: SourceCrawlOptions): Promise<Snapshot>;
  /**
   * The institution's own page for a course or a programme.
   *
   * Here because it is a fact about one institution's URL grammar, and it was
   * living in `read.ts` as a single UCLouvain-shaped function used for every
   * course whatever its institution. That is correct today and wrong the hour
   * ULB data is loaded, which is why it moves before ULB is crawled rather
   * than after.
   */
  courseUrl(year: number, code: string): string;
  programmeUrl(year: number, code: string): string;
}
