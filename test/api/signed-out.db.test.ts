/**
 * AN ENDPOINT BEHIND A SESSION ANSWERS WHEN THERE IS NO SESSION.
 *
 * THE BUG THIS EXISTS FOR. `identify` throws `NotAuthenticated` and sends
 * nothing, on purpose: it is the one place that decides who a request is, and
 * it does not get to decide what a route says about it. Two handlers caught
 * that error and simply returned. Nothing was sent, so the request stayed
 * open: the browser waited for a response that was never coming, and "Mes
 * avis" sat on its loading line indefinitely. It looked exactly like a screen
 * that had not been deployed.
 *
 * NOTHING ELSE COULD HAVE CAUGHT IT. A hanging request is not an error
 * anywhere: no exception, no log line, no failed assertion. The server is
 * fine, the route is fine, and the only symptom is on the other end of a wire
 * nobody is watching. The unit tests never went through HTTP, so the one thing
 * that was wrong was the one thing they did not exercise.
 *
 * So these probe over a real socket, with no cookie, and the assertion that
 * matters is not the status code. It is that anything at all came back.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import { reviewRoutes } from "@studens/api";
import { FIXTURE_INSTITUTION, upsertCourse } from "../fixtures/catalogue.js";

const prisma = new PrismaClient();
let reachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  reachable = true;
} catch {
  reachable = false;
}

if (process.env["STUDENS_REQUIRE_DB"] === "1" && !reachable) {
  throw new Error(
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the signed-out " +
      "endpoint tests would have been skipped. They cover a request that is " +
      "left open rather than refused, which no other test can see.",
  );
}

const dbit = reachable ? it : it.skip;

let origin = "";
let server: Server | undefined;

/**
 * A course this file makes and removes.
 *
 * The first version of these tests named a real scraped course, which existed
 * on the machine they were written on and on no other. CI migrates the schema
 * and scrapes nothing, so the route answered 404 and the public case failed
 * for a reason that had nothing to do with what it tests. A test owns the rows
 * it reads.
 */
const COURSE = "ztst.sout.course";

beforeAll(async () => {
  if (!reachable) return;
  await upsertCourse(prisma, COURSE);
  const app = express();
  app.use("/api", reviewRoutes(prisma));
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  if (reachable) {
    await prisma.course.deleteMany({ where: { code: { startsWith: "ztst.sout" } } });
  }
  await prisma.$disconnect();
});

/**
 * A request that is given a deadline, because the failure being tested is the
 * absence of a response and a plain `fetch` waits for that forever. Vitest's
 * own timeout would fire eventually and blame the test rather than the route.
 */
async function probe(path: string, init?: RequestInit) {
  const stop = AbortSignal.timeout(4000);
  try {
    return await fetch(`${origin}${path}`, { ...init, signal: stop });
  } catch (err) {
    throw new Error(
      `${init?.method ?? "GET"} ${path} sent nothing back within four seconds. ` +
        `A handler behind identify() almost certainly swallowed NotAuthenticated ` +
        `and returned without answering. (${String(err)})`,
    );
  }
}

/** Every route in this file that is only for somebody signed in. */
const BEHIND_A_SESSION: Array<[string, string, RequestInit?]> = [
  ["GET", "/api/reviews/mine"],
  ["GET", "/api/reviews/mine?page=3"],
  [
    "PATCH",
    "/api/reviews/00000000-0000-0000-0000-000000000000",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recommendation: 3, workloadVsEcts: 3, difficulty: 3, body: "x", completed: true }),
    },
  ],
  [
    "POST",
    `/api/courses/${FIXTURE_INSTITUTION}/${COURSE}/reviews`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ academicYear: 2024, recommendation: 3, workloadVsEcts: 3, difficulty: 3, body: "x", completed: true }),
    },
  ],
];

describe("signed out, the review endpoints refuse rather than hang", () => {
  for (const [method, path, init] of BEHIND_A_SESSION) {
    dbit(`${method} ${path}`, async () => {
      const res = await probe(path, init);
      // 401 is the right answer and is what the submission route already gave.
      // The looser assertion is deliberate: any answer is a pass, because the
      // defect was silence, and pinning the code here would make this test
      // fail for reasons that are not the one it exists for.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBe(401);
    });
  }

  /**
   * The public half of the same file still answers without a session, so this
   * cannot be "fixed" by putting the whole router behind a gate. FR-D13: a
   * course page is public, the review bodies are not.
   */
  dbit("but a course's aggregate is still public", async () => {
    const res = await probe(`/api/courses/${FIXTURE_INSTITUTION}/${COURSE}/reviews`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionRequired: boolean; reviews: unknown[] };
    expect(body.sessionRequired).toBe(true);
    expect(body.reviews).toEqual([]);
  });
});
