/**
 * Where this deployment lives, from the outside.
 *
 * TWO ORIGINS, because in development they differ: the API answers on 3001 and
 * the single-page application is served by Vite on 5173. In production they are
 * the same host, and the defaults below are the development pair rather than a
 * guess at production, which has to be configured.
 *
 * Shared because there are now two callers. The sign-in callback URL has to
 * match what was registered with Microsoft and Google exactly, and the email
 * confirmation link has to arrive at the API rather than the app. Two copies of
 * "strip the trailing slash and append" would drift the day one of them is
 * fixed.
 */

/** Where the API answers. Provider callbacks and mailed links point here. */
export function publicOrigin(): string {
  return (process.env["STUDENS_PUBLIC_ORIGIN"] ?? "http://localhost:3001").replace(/\/$/, "");
}

/** Where a person's browser is sent afterwards. */
export function appUrl(path: string): string {
  const base = (process.env["STUDENS_APP_ORIGIN"] ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path}`;
}
