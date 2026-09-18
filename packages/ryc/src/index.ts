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
  type NameResolver,
  PASS_BAND_FLOOR,
  REVIEWS_PER_PAGE,
  type PublishedReview,
  type Aggregate,
  type Path,
} from "./read.js";

/** FR-A15 and OPEN-46: what this module does when a Member leaves. */
export {
  RYC_MODULE,
  RYC_REVIEW_KIND,
  detachMemberReviews,
  exportMemberReviews,
  describeReviewForModeration,
  holdReview,
  releaseReview,
  reviewExists,
} from "./account.js";
