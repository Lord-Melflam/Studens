/**
 * Reference module (tier 2): the course catalogue.
 *
 * FR-B9: holds no data about Members. Third-party data from a public source,
 * such as lecturer names, is permitted; anything identifying a platform user is
 * not.
 *
 * Read by feature modules, written only by ingestion. See
 * docs/design/catalogue-ingestion.md and docs/design/module-boundaries.md.
 */
export const tier = "reference" as const;

export { crawl, resolveYear, type CrawlOptions } from "./ingestion/crawl.js";
export { PoliteFetcher, USER_AGENT, type FetcherOptions } from "./ingestion/http.js";
export {
  promote,
  load,
  validate,
  SnapshotInvalid,
  type Snapshot,
  type DiscoveredFaculty,
} from "./ingestion/snapshot.js";
export { parseOffering, detectEra, type ParsedOffering, type Era } from "./ingestion/parse/offering.js";
export { academicYearFor, candidateYears, ROLLOVER } from "./ingestion/year.js";
export { courseUrl } from "./ingestion/urls.js";
export { ParseError, FetchError } from "./ingestion/errors.js";
export { loadSnapshot, type LoadResult, type LoadOptions } from "./ingestion/load.js";
export {
  type Catalogue,
  SnapshotCatalogue,
  DatabaseCatalogue,
  type CourseSummary,
  type CourseDetail,
  type FacultySummary,
  type ProgrammeSummary,
} from "./read.js";
