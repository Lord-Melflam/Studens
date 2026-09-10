/**
 * The web process. One deployable, per docs/requirements.md 1.7.
 *
 * Stateless per request: session state travels in a token (CC-3, FR-A3), so
 * any instance can serve any request.
 */
export const process_role = "web" as const;
