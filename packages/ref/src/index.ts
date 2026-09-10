/**
 * Reference module (tier 2): the course catalogue.
 *
 * FR-B9: holds no data about Members. Third-party data from a public source,
 * such as lecturer names, is permitted; anything identifying a platform user
 * is not.
 *
 * Read by feature modules, written only by ingestion.
 * See docs/design/catalogue-ingestion.md.
 */
export const tier = "reference" as const;
