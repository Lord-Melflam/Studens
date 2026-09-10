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
import { catalogueRoutes } from "./routes/catalogue.js";

export const process_role = "web" as const;

export async function createApp(snapshotPath: string) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", await catalogueRoutes(snapshotPath));

  // Anything unmatched under /api is a 404 as JSON, not an HTML error page.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}

const isEntry = process.argv[1]?.endsWith("index.js") ?? false;
if (isEntry) {
  const port = Number(process.env["PORT"] ?? 3001);
  const snapshot = process.env["CATALOGUE_SNAPSHOT"] ?? "data/catalogue.json";
  createApp(snapshot)
    .then((app) =>
      app.listen(port, () => {
        console.log(`api listening on http://localhost:${port} (catalogue: ${snapshot})`);
      }),
    )
    .catch((err: unknown) => {
      console.error("api failed to start");
      console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
      process.exitCode = 1;
    });
}
