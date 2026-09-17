/**
 * The web process serving the built single-page application.
 *
 * This is what stood between the repository and a URL: in development Vite
 * serves the app and proxies `/api`, and in production there is no Vite, so
 * without this a refresh on any path but the root is a 404.
 *
 * Every case below was found by running the built process and probing it with
 * curl, not by reading the code. Two of them were wrong on the first try.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { looksLikeAFile, mountWebApp, webRoot } from "@studens/api";

const INDEX = "<!doctype html><html lang=\"fr\"><body><div id=\"root\"></div></body></html>";

let origin = "";
let server: Server | undefined;
let root = "";

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "studens-web-"));
  writeFileSync(join(root, "index.html"), INDEX);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "index-abc123.js"), "export const x = 1;\n");

  const app = express();
  // The same order as createApp, because the order is the design: the API's own
  // 404 has to be reached before the fallback that answers everything.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });
  expect(mountWebApp(app, root), "the fixture should be recognised as a build").toBe(true);

  server = createServer(app);
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const a = server.address();
  origin = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});

afterAll(() => server?.close());

const get = (path: string, method = "GET"): Promise<Response> =>
  fetch(`${origin}${path}`, { method, redirect: "manual" });

describe("a deep link survives a refresh", () => {
  it("answers a route inside the application with the index", async () => {
    // The whole point. Vite is not there in production, so this process is what
    // turns `/en/app/ryc/c/lepl1503` into the application rather than a 404.
    for (const path of ["/", "/en/app", "/fr/confidentialite", "/en/app/ryc/c/lepl1503"]) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toMatch(/text\/html/);
    }
  });

  it("never caches the index, and caches the hashed assets hard", async () => {
    // index.html is the only unhashed file and it names the hashed ones. Cached
    // even briefly, a returning visitor gets an index asking for assets a
    // deploy has already replaced, and the application fails to start with
    // nothing a person can act on.
    expect((await get("/en/app")).headers.get("cache-control")).toBe("no-store");
    const asset = await get("/assets/index-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });
});

describe("the fallback does not swallow what is not a page", () => {
  it("leaves a mistyped API path as JSON", async () => {
    // Mounted before the API's 404 instead of after it, this would answer
    // `/api/corses/lepl1503` with the index and status 200. The client would
    // then parse HTML as JSON and the error would say nothing about the typo.
    const res = await get("/api/corses/lepl1503");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "not found" });
  });

  it("404s a missing asset instead of handing back a page", async () => {
    // Found by probing the built process: a browser that asked for a script and
    // was given a page fails with a syntax error pointing at line 1 of the
    // HTML, which says nothing about the file being missing.
    const res = await get("/assets/gone.js");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
  });

  it("404s a POST to a path that does not exist", async () => {
    // Answering it with a page pretends it was a navigation: 200 and HTML where
    // the caller expected an error.
    expect((await get("/en/app", "POST")).status).toBe(404);
  });

  it("still answers the API's own routes", async () => {
    expect(await (await get("/api/health")).json()).toEqual({ ok: true });
  });
});

describe("a build that is not there", () => {
  it("mounts nothing, silently, which is every run in development", async () => {
    // `npm run dev` runs this process beside Vite and never builds dist. A
    // throw here would make the normal case the broken one.
    const empty = mkdtempSync(join(tmpdir(), "studens-nothing-"));
    expect(webRoot(empty)).toBeNull();
    const app = express();
    expect(mountWebApp(app, empty)).toBe(false);
  });
});

describe("telling a file from a page", () => {
  it("knows which is which", () => {
    expect(looksLikeAFile("/assets/index-abc123.js")).toBe(true);
    expect(looksLikeAFile("/favicon.ico")).toBe(true);
    expect(looksLikeAFile("/en/app/ryc/c/lepl1503")).toBe(false);
    expect(looksLikeAFile("/")).toBe(false);
  });

  it("holds for every route the application actually has", () => {
    // The rule is "the last segment carries a dot", and it is only correct
    // while no route has one. If a module ever routes on a path with a dot,
    // this is the test that says so rather than a page 404ing in production.
    for (const path of [
      "/fr",
      "/en/app",
      "/nl/app/ryc",
      "/fr/app/ryc/recherche",
      "/fr/app/ryc/p/sinf1ba",
      "/fr/app/ryc/c/lepl1503/avis",
      "/fr/app/moi",
      "/fr/app/moderation",
      "/fr/confidentialite",
      "/fr/a-propos",
      "/fr/connexion",
      "/fr/modules",
    ]) {
      expect(looksLikeAFile(path), path).toBe(false);
    }
  });
});

describe("the order in the real application, not just in this fixture", () => {
  it("mounts the fallback after the API's 404", () => {
    // The tests above build their own app, so they cannot catch someone moving
    // the call in createApp. This is the one property that has to hold there.
    const src = readFileSync(
      new URL("../../apps/api/src/index.ts", import.meta.url).pathname,
      "utf8",
    );
    const apiNotFound = src.indexOf('app.use("/api", (_req, res) => {');
    const fallback = src.indexOf("mountWebApp(app");
    expect(apiNotFound, "the API's own 404 should still be there").toBeGreaterThan(-1);
    expect(fallback, "createApp should mount the application").toBeGreaterThan(-1);
    expect(fallback, "the fallback must come after the API's 404").toBeGreaterThan(apiNotFound);
  });
});
