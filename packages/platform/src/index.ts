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

/** OpenID Connect (FR-A1, FR-A7). See design/authentication.md. */
export {
  beginAuthorization,
  completeAuthorization,
  discover,
  issuerMatches,
  challengeFor,
  emailDomainFrom,
  emailFrom,
  clearOidcCaches,
  OidcError,
  type ProviderConfig,
  type Authorization,
  type ProviderIdentity,
} from "./oidc.js";

export {
  configuredProviders,
  providerById,
  registerProvider,
  clearExtraProviders,
} from "./providers.js";

/** Signed short-lived values, used by the sign-in attempt state. */
export { signValue, readSignedValue, BadSignedValue } from "./signed.js";

/** A Member's own record and the username rule (FR-F). */
export {
  readProfile,
  writeProfile,
  usernamesFor,
  checkUsername,
  UsernameInvalid,
  USERNAME_MIN,
  USERNAME_MAX,
  USERNAME_RE,
  type Profile,
  type ProfilePatch,
} from "./profile.js";

/** FR-A15: leaving, and taking your data with you. */
export {
  deleteAccount,
  exportAccount,
  type AccountExport,
  type DeletionReport,
  type MemberErasure,
} from "./account.js";

/** FR-H: what a member agreed to be sent, and the queue that sends it. */
export {
  OPTIONAL_KINDS,
  TRANSACTIONAL,
  enqueueMail,
  isSendableKind,
  mailRelayConfigured,
  notifyMember,
  readPreferences,
  setPreference,
  wants,
  type OptionalKind,
  type Preference,
  type QueuedMail,
} from "./notifications.js";

/** FR-A12 and FR-A13: the address a member is reached at. */
export {
  CONFIRM_MAX_AGE_SECONDS,
  EmailInvalid,
  checkEmail,
  confirmEmailChange,
  requestEmailChange,
} from "./email.js";

/** What a person may type into a free text field (FR-F6, FR-F7). */
export { TEXT_LIMITS, TextInvalid, checkFreeText, countGraphemes } from "./text.js";

/** FR-E8 to FR-E12: notice and action, DSA Articles 16 and 6. */
export {
  DETAIL_MAX,
  DETAIL_MIN,
  MAX_OPEN_PER_TARGET,
  REPORT_CATEGORIES,
  ReportInvalid,
  detachMemberReports,
  holdsImmediately,
  openReportSummary,
  submitReport,
  type Moderatable,
  type NewReport,
  type ReportCategory,
  type ReportOutcome,
  type ReportSummary,
} from "./reports.js";
