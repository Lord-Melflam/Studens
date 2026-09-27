/**
 * WHO MAY READ THE FEEDBACK QUEUE, over a real socket.
 *
 * WHY THIS CANNOT BE A UNIT TEST. The rule lives in a role check inside the
 * route, and the thing it protects is a response. Calling the kernel directly
 * proves the query works and says nothing about who is allowed to run it;
 * that gap is exactly where an endpoint ends up readable by anyone with a
 * session, which nothing else in the suite would notice.
 *
 * THE THREE CASES ARE THE DECISION ITSELF. A moderator sees the feedback,
 * because what people report about the product is the same job they already
 * do pointed at a different thing (FR-I3). A moderator does NOT see the
 * member directory, because that one leads to addresses. Nobody signed out
 * sees either, and the answer is 404 rather than 403, so the endpoint does not
 * teach a stranger that it exists.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import { createSession } from "@studens/platform";
import { moderationRoutes } from "@studens/api";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the feedback role " +
      "tests would have been skipped. They cover who may read what people wrote.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "ztst-fbroles";
let origin = "";
let server: Server | undefined;
const cookies: Record<string, string> = {};

async function member(role: string, subject: string): Promise<string> {
  const tenantId = (await prisma.tenant.findFirst({ select: { id: true } }))!.id;
  const m = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.fbroles.${subject}`,
      role,
      tenantId,
      onboardedAt: new Date(),
    },
  });
  const { token } = await createSession(m.id, { client: prisma });
  return token;
}

async function clean(): Promise<void> {
  if (!reachable) return;
  const mine = await prisma.member.findMany({ where: { provider: PROVIDER }, select: { id: true } });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.feedback.deleteMany({ where: { memberId: { in: ids } } });
  }
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

beforeAll(async () => {
  if (!reachable) return;
  await clean();
  cookies["admin"] = await member("admin", "admin");
  cookies["moderator"] = await member("moderator", "mod");
  cookies["member"] = await member("member", "plain");

  const app = express();
  app.use("/api", moderationRoutes(prisma));
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
  await clean();
  await prisma.$disconnect();
});

const get = (path: string, who?: string): Promise<Response> =>
  fetch(`${origin}${path}`, {
    headers: who ? { cookie: `studens_session=${cookies[who]}` } : {},
  });

describe("the feedback queue is a moderator's as well as an administrator's", () => {
  dbit("lets an administrator read it", async () => {
    expect((await get("/api/moderation/feedback", "admin")).status).toBe(200);
  });

  dbit("lets a moderator read it, which is the point of FR-I3", async () => {
    expect((await get("/api/moderation/feedback", "moderator")).status).toBe(200);
  });

  dbit("does not let a plain member read it", async () => {
    expect((await get("/api/moderation/feedback", "member")).status).toBe(404);
  });

  dbit("does not let a stranger read it, and says 404 rather than 403", async () => {
    // 403 would confirm the endpoint exists, which is a thing worth not
    // telling somebody who has no business knowing.
    expect((await get("/api/moderation/feedback")).status).toBe(404);
  });
});

describe("the member directory stays an administrator's", () => {
  dbit("is open to an administrator and shut to a moderator", async () => {
    expect((await get("/api/moderation/members", "admin")).status).toBe(200);
    // The line between the two screens is where the addresses are: this one
    // leads to them and the feedback queue does not.
    expect((await get("/api/moderation/members", "moderator")).status).toBe(404);
  });
});

describe("the queue never carries an address", () => {
  dbit("says whether one was left and never what it is", async () => {
    await prisma.feedback.create({
      data: { kind: "bug", message: "ztst.fbroles something broke", contactEmail: "a@b.invalid" },
    });
    const body = (await (await get("/api/moderation/feedback", "admin")).json()) as {
      items: Array<Record<string, unknown>>;
    };
    const row = body.items.find((i) => String(i["message"]).startsWith("ztst.fbroles"));
    expect(row?.["hasEmail"], "the reader needs to know an answer is possible").toBe(true);
    expect(JSON.stringify(body)).not.toContain("a@b.invalid");
    await prisma.feedback.deleteMany({ where: { message: { startsWith: "ztst.fbroles" } } });
  });
});
