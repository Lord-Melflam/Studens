/**
 * The distinction that keeps "fail loudly" workable across a decade of page
 * layouts (docs/design/catalogue-ingestion.md sections 3.1 and 6).
 *
 * A field can be missing for two very different reasons:
 *
 *   - The era genuinely lacks it. The 2012 pages carry no Q1/Q2 field at all.
 *     That is not an error, and treating it as one would make every archived
 *     year fail.
 *   - The parse broke. The label is on the page but the value could not be
 *     read, which means the layout changed and we are about to store nonsense.
 *
 * The rule that separates them: if the LABEL is absent, the field is absent by
 * era. If the label is present but the value is not, that is a ParseError.
 */

export class ParseError extends Error {
  constructor(
    readonly url: string,
    readonly field: string,
    detail: string,
  ) {
    super(`${field}: ${detail} (${url})`);
    this.name = "ParseError";
  }
}

export class FetchError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    /** From `Retry-After`, when the server said how long to wait. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "FetchError";
  }
}

/**
 * The crawl asked for more of the university's time than it was allowed.
 *
 * Its own limit, not one UCLouvain imposes: robots.txt sets no crawl delay, so
 * every restraint here is self-imposed (section 4). A run that hits this has
 * produced an incomplete catalogue and must not replace the live one.
 */
export class BudgetExceeded extends Error {
  constructor(
    readonly limit: number,
    readonly url: string,
  ) {
    super(
      `request budget of ${limit} exhausted at ${url}. ` +
        `Raise --max-requests if this run is meant to be that large.`,
    );
    this.name = "BudgetExceeded";
  }
}

/**
 * Too many course pages could not be fetched at all.
 *
 * A few is the catalogue: `cours-2025-mlsmm2219` answers 503 on every attempt
 * while its 2024 edition is served fine, and a run of thousands meets several.
 * Many is us: being blocked or rate limited fails everything at once, and a
 * catalogue quietly missing a tenth of its courses is exactly the "wrong data"
 * the snapshot rules exist to refuse.
 */
export class TooManyUnavailable extends Error {
  constructor(
    readonly codes: string[],
    readonly tolerated: number,
  ) {
    super(
      `${codes.length} course pages could not be fetched, more than the ${tolerated} tolerated. ` +
        `That is a pattern rather than a few broken pages. First few: ${codes.slice(0, 5).join(", ")}`,
    );
    this.name = "TooManyUnavailable";
  }
}
