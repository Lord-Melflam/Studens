/**
 * Platform services (tier 1): identity, session, authorization, quota, audit.
 *
 * Depends on nothing. See docs/design/architecture-style.md and
 * docs/design/module-boundaries.md.
 *
 * FR-B11: modules ask this tier narrow questions; they do not fetch its data.
 * The cross-tier transaction in FR-C13 is owned here (OPEN-39).
 */
export const tier = "platform" as const;
