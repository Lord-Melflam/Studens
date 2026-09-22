/**
 * The worker process. Same codebase and database as the web process,
 * separate process, per docs/requirements.md 1.7.
 *
 * Exists because two workloads must not run in a request path:
 *   - moderation (FR-E4 to FR-E6)
 *   - catalogue ingestion (docs/design/catalogue-ingestion.md)
 *
 * FR-E7 and CC-13: a moderation queue entry must not carry a member
 * reference. The queue is storage, even though it looks like plumbing.
 */
export const process_role = "worker" as const;

/**
 * What the messages say, for the tests that render them.
 *
 * Exported here rather than reached at by path, because the deep-import ban
 * (FR-B2, FR-B10) applies to tests as hard as to application code: a test that
 * reaches into `apps/worker/src` escapes the boundary checks, and lint refuses
 * it. Going through the entry point means a template that stops being
 * reachable fails the test that renders it, which is the contract being
 * checked rather than assumed.
 */
export { TEMPLATED_KINDS, renderMail } from "./mail-templates.js";

/** How a rendered message becomes something a server accepts, for its tests. */
export { encodeHeader, mimeMessage, textToHtml } from "./mime.js";
export { LOGO_BASE64, LOGO_CID, LOGO_NAME, LOGO_TYPE } from "./logo.js";
