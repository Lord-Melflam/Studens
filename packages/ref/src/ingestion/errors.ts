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
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "FetchError";
  }
}
