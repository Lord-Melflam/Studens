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
