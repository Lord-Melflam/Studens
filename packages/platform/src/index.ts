/**
 * Platform services (tier 1): identity, session, authorization, quota, audit.
 *
 * Depends on nothing. See docs/design/architecture-style.md and
 * docs/design/module-boundaries.md.
 *
 * FR-B11: modules ask this tier narrow questions; they do not fetch its data.
 * The cross-tier transaction in FR-C13 is owned here, and `withQuota` is it.
 */
export const tier = "platform" as const;

export { withQuota, quotaRemaining, type KernelTx, type WithQuotaOptions } from "./kernel.js";
export {
  windowStartFor,
  QuotaExceeded,
  QUOTA_PER_WINDOW,
  WINDOW_DAYS,
} from "./quota.js";

/**
 * Sessions (FR-A1 to FR-A5). The token lives in the browser; only its hash is
 * stored. See design/authentication.md.
 */
export {
  createSession,
  verifySession,
  revokeSession,
  listSessions,
  hashToken,
  newToken,
  secretEquals,
  NoSession,
  IDLE_DAYS,
  ABSOLUTE_DAYS,
  type SessionIdentity,
  type SessionOptions,
  type ListedSession,
} from "./session.js";
