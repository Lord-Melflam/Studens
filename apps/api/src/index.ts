/**
 * The web process. One deployable, per docs/requirements.md 1.7.
 *
 * Stateless per request: no per-client state is held here, so any instance can
 * serve any request (CC-3, and FR-A3 keeps session state in a token). That
 * constraint is taken now even though there is only one instance, because it is
 * far cheaper to keep than to retrofit.
 *
 * The catalogue is reached through @studens/ref's public read interface, never
 * by touching its storage (FR-B11).
 */
import { loadDotEnv } from "./env.js";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { catalogueRoutes } from "./routes/catalogue.js";
import { reviewRoutes } from "./routes/reviews.js";
import { sessionRoutes } from "./routes/session.js";
import { profileRoutes } from "./routes/profile.js";
import { accountRoutes } from "./routes/account.js";
import { reportRoutes } from "./routes/reports.js";
import { moderationRoutes } from "./routes/moderation.js";
import { authRoutes } from "./routes/auth.js";
import { configuredProviders } from "@studens/platform";
import { devIdentityEnabled } from "./identity.js";
import { mountWebApp, webRoot } from "./web.js";

export const process_role = "web" as const;

/**
 * Serving the built application, exported for test/api/web-app.test.ts. The
 * ordering rule these depend on is checked there too, against this file.
 */
export { looksLikeAFile, mountWebApp, webRoot } from "./web.js";

/**
 * The review routes, exported for test/api/signed-out.db.test.ts. That test
 * mounts them on a real socket to check that a request with no session is
 * answered rather than left open, which is a thing only HTTP can show.
 */
export { reviewRoutes } from "./routes/reviews.js";

export interface AppSource {
  /** Set to read a snapshot file instead of the database. */
  snapshotPath?: string;
  /**
   * Where the built single-page application is. Left out, it is looked for
   * beside this package and skipped when it is not there, which is the
   * development and test case.
   */
  webRoot?: string;
}

export async function createApp(source: AppSource = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  /*
    The catalogue routes take the client when there is one, so the search can
    read its page size from the settings an administrator edits. There is
    none in snapshot mode, and the routes fall back to the module's own
    default rather than requiring a database they were written to do without.
  */
  const db = source.snapshotPath ? undefined : new PrismaClient();
  app.use("/api", await catalogueRoutes({ ...source, prisma: db }));

  // Reviews need a member, and a member needs FR-A. Mounted only when the
  // catalogue is database-backed, since the kernel writes to the same database.
  if (!source.snapshotPath) {
    const prisma = db ?? new PrismaClient();
    app.use("/api", authRoutes(prisma));
    app.use("/api", sessionRoutes(prisma));
    app.use("/api", profileRoutes(prisma));
    app.use("/api", accountRoutes(prisma));
    app.use("/api", reportRoutes(prisma));
    app.use("/api", moderationRoutes(prisma));
    app.use("/api", reviewRoutes(prisma));
  }

  // Anything unmatched under /api is a 404 as JSON, not an HTML error page.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  // AFTER the line above, always. The single-page application's fallback
  // answers any path it is given, so mounted first it would answer a mistyped
  // API path with HTML and status 200. See web.ts.
  //
  // Does nothing when the application has not been built, which is every run in
  // development and under the tests: there, Vite serves it on another port.
  mountWebApp(app, source.webRoot);

  return app;
}

const isEntry = process.argv[1]?.endsWith("index.js") ?? false;
if (isEntry) {
  /**
   * ESM hoists imports, so this cannot run before them and does not try to.
   * It does not need to: nothing in this application reads `process.env` at
   * module scope, only inside functions called per request or from here. If
   * that ever stops being true, the value read at import time will be the one
   * from the real environment and not from `.env`, and it will be silent.
   */
  const envFile = loadDotEnv();
  const port = Number(process.env["PORT"] ?? 3001);
  // The database unless a snapshot is named explicitly.
  const snapshotPath = process.env["CATALOGUE_SNAPSHOT"];
  createApp(snapshotPath ? { snapshotPath } : {})
    .then((app) =>
      app.listen(port, () => {
        console.log(
          `api listening on http://localhost:${port} ` +
            `(catalogue: ${snapshotPath ?? "database"})`,
        );
        // Say what is configured, because the alternative is silence that
        // looks identical to a missing credential. An absence is invisible
        // unless something prints it (LESSONS.md section 9).
        const providers = configuredProviders().map((p) => p.label);
        console.log(
          `  .env: ${envFile}  |  sign-in providers: ` +
            (providers.length > 0 ? providers.join(", ") : "none configured"),
        );
        // Same reason as the line above: a process serving the API and not the
        // application looks identical to one serving both until somebody opens
        // a page. Say which it is.
        const root = webRoot();
        console.log(
          `  web app: ${root ?? "not built, API only (npm run build:web)"}`,
        );
        if (devIdentityEnabled()) {
          // Loud on purpose. This is the one thing standing between the review
          // path and being usable, and it must not be forgotten quietly.
          console.warn(
            "\n  !!  DEVELOPMENT IDENTITY IS ON. Anyone can sign in as one fixed\n" +
              "      member, with no provider and no password. It issues a real\n" +
              "      session, so everything downstream is production's code path.\n" +
              "      Never run this way anywhere but a laptop.\n",
          );
        }
      }),
    )
    .catch((err: unknown) => {
      console.error("api failed to start");
      console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
      process.exitCode = 1;
    });
}
