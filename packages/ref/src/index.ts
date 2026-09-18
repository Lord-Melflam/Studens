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
/**
 * The block model for the long course-page fields. Exported because the API
 * hands these to the browser: the shape is part of the contract, not an
 * internal detail of the parser.
 */
export { richBlocks, blocksToText, type Block, type Span } from "./ingestion/parse/rich.js";
export { academicYearFor, candidateYears, ROLLOVER } from "./ingestion/year.js";
export { courseUrl } from "./ingestion/urls.js";
export {
  ParseError,
  FetchError,
  BudgetExceeded,
  TooManyUnavailable,
} from "./ingestion/errors.js";
export { loadSnapshot, type LoadResult, type LoadOptions } from "./ingestion/load.js";
/** Refusing to replace a catalogue with a much smaller one. */
export {
  SHRINK_LIMIT,
  shrinkVerdict,
  shrinkMessage,
  type ShrinkVerdict,
} from "./ingestion/shrink.js";
export {
  type Catalogue,
  SnapshotCatalogue,
  DatabaseCatalogue,
  type CourseSummary,
  type CourseDetail,
  type FacultySummary,
  type ProgrammeSummary,
} from "./read.js";
export { listInstitutions, type InstitutionSummary } from "./institutions.js";
export {
  programmeShape,
  type ProgrammeKind,
  type ProgrammeShape,
} from "./ingestion/parse/programme.js";
export { parseSearchRows, slug, type SearchRow } from "./ingestion/parse/search.js";

/**
 * SOURCES: one institution's catalogue, and how to read it.
 *
 * UCLouvain's crawler is not moved into this seam, it is wrapped by it, on
 * François's instruction: it is the only crawler here that has completed a full
 * run and every defect it has met is written into it. See sources/index.ts.
 */
export { uclouvain } from "./sources/uclouvain.js";
export type { CatalogueSource, SourceCrawlOptions } from "./sources/index.js";
export {
  parseListing,
  parseListingFully,
  parseCredits,
  type ListedCourse,
  type ParsedListing,
  isPlaceholderCode,
} from "./sources/ulb/listing.js";
export {
  ulb,
  listingUrl,
  programmeUrlsFrom,
  latestYearIn,
  defaultYearFrom,
  SITEMAP as ULB_SITEMAP,
} from "./sources/ulb/index.js";
export {
  parseFaculties,
  facultyOf,
  normaliseName,
  type UlbFaculty,
} from "./sources/ulb/faculties.js";
export {
  parseProgramme,
  kindFromCode,
  programmeCodeFrom,
  type UlbProgramme,
} from "./sources/ulb/programme.js";

/** ULB's per-course prose, read by the second pass. */
export { parseCourseProse, type UlbCourseProse } from "./sources/ulb/course.js";
