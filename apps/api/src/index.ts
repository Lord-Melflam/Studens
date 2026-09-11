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
import express from "express";
import { PrismaClient } from "@prisma/client";
import { catalogueRoutes } from "./routes/catalogue.js";
import { reviewRoutes } from "./routes/reviews.js";
import { sessionRoutes } from "./routes/session.js";
import { authRoutes } from "./routes/auth.js";
import { devIdentityEnabled } from "./identity.js";

export const process_role = "web" as const;

export interface AppSource {
  /** Set to read a snapshot file instead of the database. */
  snapshotPath?: string;
}

export async function createApp(source: AppSource = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", await catalogueRoutes(source));

  // Reviews need a member, and a member needs FR-A. Mounted only when the
  // catalogue is database-backed, since the kernel writes to the same database.
  if (!source.snapshotPath) {
    const prisma = new PrismaClient();
    app.use("/api", authRoutes(prisma));
    app.use("/api", sessionRoutes(prisma));
    app.use("/api", reviewRoutes(prisma));
  }

  // Anything unmatched under /api is a 404 as JSON, not an HTML error page.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}

const isEntry = process.argv[1]?.endsWith("index.js") ?? false;
if (isEntry) {
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
        if (devIdentityEnabled()) {
          // Loud on purpose. This is the one thing standing between the review
          // path and being usable, and it must not be forgotten quietly.
          console.warn(
            "\n  !!  DEVELOPMENT IDENTITY IS ON. Every request is the same member.\n" +
              "      There is no authentication: FR-A is not built.\n" +
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
