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
