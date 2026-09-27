/**
 * NFR-O4: the session table stops growing.
 *
 * THE GAP THIS FILLS. `verifySession` refuses an expired row and leaves it
 * where it is; `revokeSession` writes a timestamp rather than deleting. So
 * every session anybody had ever held was still a row, and nothing anywhere
 * removed one. Noted on 2026-09-21 with a few hundred rows, built on
 * 2026-09-27, which is the cheap moment rather than the urgent one.
 *
 * WHAT MATTERS IN THESE TESTS is not that rows disappear, it is that only
 * ALREADY DEAD ones do. A prune that deletes a live session signs somebody out
 * for no reason they can see, and it would do it silently.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ABSOLUTE_DAYS, IDLE_DAYS, pruneSessions, verifySession } from "@studens/platform";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the session " +
      "pruning tests would have been skipped. They cover a delete that must " +
      "never reach a live session.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "prune-test";
const TENANT = "00000000-0000-0000-0000-0000000000p1";
const DAY = 86_400_000;

let memberId = "";

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({ where: { provider: PROVIDER }, select: { id: true } });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) await prisma.session.deleteMany({ where: { memberId: { in: ids } } });
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

beforeEach(async () => {
  if (!reachable) return;
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: "test" },
  });
  await clean();
  const m = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: "owner",
      emailDomain: "example.invalid",
      username: "ztst.prune.owner",
      tenantId: TENANT,
    },
  });
  memberId = m.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

/** A row placed exactly where a test wants it in time. */
async function session(name: string, over: Record<string, Date | null> = {}) {
  const now = new Date();
  return await prisma.session.create({
    data: {
      memberId,
      tokenHash: `ztst-prune-${name}-${Date.now()}`,
      issuedAt: now,
      lastSeenAt: now,
      ...over,
    },
  });
}

const mine = () => prisma.session.count({ where: { memberId } });

describe("pruning removes only what could never work again", () => {
  dbit("leaves a live session exactly where it is", async () => {
    await session("live");
    const { deleted } = await pruneSessions({ client: prisma });
    expect(deleted).toBe(0);
    expect(await mine()).toBe(1);
  });

  dbit("removes one idle past the idle window", async () => {
    const old = new Date(Date.now() - (IDLE_DAYS + 1) * DAY);
    await session("idle", { lastSeenAt: old });
    await pruneSessions({ client: prisma });
    expect(await mine()).toBe(0);
  });

  /**
   * Active every day and still too old. This is the row the absolute window
   * exists for, and an idle-only prune would keep it forever.
   */
  dbit("removes one issued past the absolute window, however active", async () => {
    await session("ancient", { issuedAt: new Date(Date.now() - (ABSOLUTE_DAYS + 1) * DAY) });
    await pruneSessions({ client: prisma });
    expect(await mine()).toBe(0);
  });

  /**
   * A session somebody signed out of stays visible for a while. Deleting it
   * the same second leaves nothing for the person who just killed a stolen
   * session to have been reassured by.
   */
  dbit("keeps a freshly revoked session, and removes an old one", async () => {
    await session("just-revoked", { revokedAt: new Date() });
    expect((await pruneSessions({ client: prisma })).deleted).toBe(0);

    await prisma.session.deleteMany({ where: { memberId } });
    await session("long-revoked", { revokedAt: new Date(Date.now() - (IDLE_DAYS + 1) * DAY) });
    await pruneSessions({ client: prisma });
    expect(await mine()).toBe(0);
  });

  /**
   * The property that matters most: a token that still works before the prune
   * still works after it. Asserted through `verifySession` rather than by
   * counting rows, because that is the question a member is really asking.
   */
  dbit("a working token still works afterwards", async () => {
    const { createSession } = await import("@studens/platform");
    const { token } = await createSession(memberId, { client: prisma });
    expect(await verifySession(token, { client: prisma })).toBeTruthy();

    // Something dead alongside it, so the prune has real work to do.
    await session("dead", { lastSeenAt: new Date(Date.now() - (IDLE_DAYS + 1) * DAY) });
    const { deleted } = await pruneSessions({ client: prisma });

    expect(deleted).toBe(1);
    expect(await verifySession(token, { client: prisma })).toBeTruthy();
  });

  dbit("is safe to run when there is nothing to do", async () => {
    expect((await pruneSessions({ client: prisma })).deleted).toBe(0);
    expect((await pruneSessions({ client: prisma })).deleted).toBe(0);
  });
});
