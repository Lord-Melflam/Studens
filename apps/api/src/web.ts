/**
 * Serving the built single-page application from the web process.
 *
 * ONE DEPLOYABLE, which is what requirements 1.7 already says the web process
 * is. In development Vite serves the app on 5173 and proxies `/api` to 3001; in
 * production there is no Vite, and something has to answer `GET /fr/app/ryc`
 * with `index.html` or a refresh on any page but the root is a 404. That was
 * the last thing standing between this repository and a URL.
 *
 * WHY HERE AND NOT IN A REVERSE PROXY. A proxy in front is needed anyway, for
 * TLS, and it could serve these files itself with one directive. It is not done
 * that way for one reason: a second place that knows which paths are the
 * application's is a second place that can disagree with this one, and the
 * disagreement shows up as a 404 on one route in production and nowhere else.
 * Keeping it here also means the production artefact runs on a laptop with no
 * proxy at all, so the thing that gets deployed is the thing that was tested.
 *
 * THE ORDER IS THE WHOLE DESIGN. This mounts AFTER the `/api` 404, never
 * before. A fallback that catches everything catches a mistyped API path too,
 * and then a request for `/api/corses/lepl1503` gets `index.html` with status
 * 200, the client parses HTML as JSON, and the error says nothing about the
 * typo. The API keeps answering JSON for its own 404s and this never sees them.
 */
import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Where the built application is, or null when it has not been built.
 *
 * Absent is the normal case in development and under the tests, and it must
 * stay silent rather than throwing: `npm run dev` runs this process beside Vite
 * and never builds `dist`.
 */
export function webRoot(explicit?: string): string | null {
  const candidate =
    explicit ??
    process.env["STUDENS_WEB_ROOT"] ??
    // From `apps/api/dist/web.js`, the built application is a sibling package.
    new URL("../../web/dist", import.meta.url).pathname;
  return existsSync(join(candidate, "index.html")) ? candidate : null;
}

/**
 * Two caching rules, and they are not a nicety.
 *
 * Vite names every asset with a hash of its contents, so `index-C1EcmZ01.js` is
 * that exact file forever and can be cached hard. `index.html` is the opposite:
 * it is the only unhashed file, it names the hashed ones, and a deploy replaces
 * the assets it points at. Cached even briefly, a returning visitor gets an
 * index that asks for files which no longer exist, and the application fails to
 * start with no error a person can act on.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const NEVER = "no-store";

/**
 * Whether a path is asking for a file rather than for a page.
 *
 * Found by probing the built process: `GET /assets/nope.js` returned
 * `index.html` with status 200. A browser that asked for a script and was
 * handed a page fails with a syntax error pointing at line 1 of the HTML, which
 * says nothing about the file being missing. That is the same failure as
 * answering a mistyped API path with a page, one layer down, and it is the one
 * that bites after a deploy: a stale `index.html` naming assets that no longer
 * exist would otherwise get 200s for all of them.
 *
 * The rule is the last segment carrying a dot. It holds because no route in
 * this application has one: locale, `app`, a module id, a course code, a
 * programme code. A module that ever routes on a path with a dot in it breaks
 * this, which is why it is one named function with a test rather than an
 * expression inside the handler.
 */
export function looksLikeAFile(path: string): boolean {
  const last = path.split("/").pop() ?? "";
  return last.includes(".");
}

export function mountWebApp(app: Express, explicitRoot?: string): boolean {
  const root = webRoot(explicitRoot);
  if (root === null) return false;
  const index = join(root, "index.html");

  app.use(
    express.static(root, {
      // `index.html` is served by the fallback below, in one place, with one
      // set of headers. Letting express.static serve it for `/` as well would
      // give the root a different answer from every other route.
      index: false,
      setHeaders: (res, path) => {
        res.setHeader("Cache-Control", path.endsWith(".html") ? NEVER : IMMUTABLE);
      },
    }),
  );

  /**
   * Everything else is the application's own routing.
   *
   * A middleware with no path, not `app.get("*")`. Express 5 parses a route
   * string with path-to-regexp v8, where a bare `*` is no longer a wildcard but
   * a parameter missing its name, and the process refuses to start: "Missing
   * parameter name at index 1". `/*splat` would work and would tie this file to
   * one major version of a parser it has no other reason to know about.
   *
   * GET and HEAD only. A POST to a path that does not exist is a mistake, and
   * answering it with a page pretends it was a navigation: the caller gets 200
   * and HTML where it expected an error, which is the same failure as the API
   * one above, one layer out.
   */
  app.use((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(404).type("text/plain").send("not found");
      return;
    }
    if (looksLikeAFile(req.path)) {
      res.status(404).type("text/plain").send("not found");
      return;
    }
    res.setHeader("Cache-Control", NEVER);
    res.sendFile(index);
  });

  return true;
}
