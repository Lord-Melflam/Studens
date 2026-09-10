/**
 * RYC (tier 3): Rate Your Courses. The first feature module.
 *
 * Owns its own storage. Reads the catalogue through @studens/ref and asks
 * @studens/platform narrow questions (FR-B11). Never reaches into another
 * feature module (FR-B10).
 *
 * Requirements in docs/requirements.md 3.4.
 */
export const tier = "feature" as const;

export {
  submitAttributed,
  submitAnonymous,
  validate,
  ReviewInvalid,
  MIN_BODY,
  MAX_BODY,
  type ReviewInput,
  type SubmitOptions,
} from "./submit.js";

export {
  reviewsFor,
  PASS_BAND_FLOOR,
  type PublishedReview,
  type Aggregate,
  type Path,
} from "./read.js";
