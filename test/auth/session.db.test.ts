/**
 * The session layer, against a real PostgreSQL.
 *
 * These carry FR-A2, FR-A3 and FR-A5, and one property that is not in the
 * requirements at all but is the reason the schema changed: the token in the
 * cookie is not stored anywhere, so this table is not a set of working cookies.
 *
 * Guarded the same way the kernel tests are. STUDENS_REQUIRE_DB=1 turns an
 * unreachable database into a failure rather than a silent skip, because a
 * suite that cannot tell whether it ran proves nothing. See LESSONS.md 1.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  ABSOLUTE_DAYS,
  createSession,
  hashToken,
  IDLE_DAYS,
  listSessions,
  NoSession,
  revokeOtherSessions,
  revokeSession,
  verifySession,
} from "@studens/platform";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the session tests " +
      "would have been skipped. They cover FR-A2, FR-A3 and FR-A5, and the " +
      "property that a stored session row is not a working cookie.",
  );
}
const dbit = reachable ? it : it.skip;

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-11T12:00:00Z");
const later = (days: number, ms = 0): Date => new Date(NOW.getTime() + days * DAY + ms);

let memberId = "";

async function seed(): Promise<void> {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t2" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t2", name: "test" },
  });
  const m = await prisma.member.upsert({
    where: { provider_providerSubject: { provider: "test", providerSubject: "session" } },
    update: {},
    create: {
      provider: "test",
      providerSubject: "session",
      emailDomain: "student.example.invalid",
      tenantId: tenant.id,
    },
  });
  memberId = m.id;
}

beforeEach(async () => {
  if (!reachable) return;
  await seed();
  await prisma.session.deleteMany({ where: { memberId } });
});

afterAll(async () => {
  if (reachable) await prisma.session.deleteMany({ where: { memberId } });
  await prisma.$disconnect();
});

describe("the token is never stored", () => {
  dbit("the row holds a hash, and the token appears nowhere in the database", async () => {
    const { token, sessionId } = await createSession(memberId, { client: prisma, now: NOW });
    const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    // The decisive check: nothing in the row equals the token. A snapshot of
    // this table must not be a set of working cookies.
    expect(JSON.stringify(row)).not.toContain(token);
  });

  dbit("two sessions never collide", async () => {
    const a = await createSession(memberId, { client: prisma, now: NOW });
    const b = await createSession(memberId, { client: prisma, now: NOW });
    expect(a.token).not.toBe(b.token);
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  dbit("a token that was never issued is refused", async () => {
    await expect(verifySession("not-a-real-token", { client: prisma })).rejects.toThrow(NoSession);
  });

  dbit("an absent token is refused without touching the database", async () => {
    await expect(verifySession(undefined, { client: prisma })).rejects.toThrow(NoSession);
  });
});

describe("FR-A3: two expiries, answering different questions", () => {
  dbit("a session works while it is fresh", async () => {
    const { token } = await createSession(memberId, { client: prisma, now: NOW });
    const who = await verifySession(token, { client: prisma, now: later(1) });
    expect(who.memberId).toBe(memberId);
    expect(who.emailDomain).toBe("student.example.invalid");
  });

  dbit(`dies after ${IDLE_DAYS} days unused`, async () => {
    const { token } = await createSession(memberId, { client: prisma, now: NOW });
    await expect(
      verifySession(token, { client: prisma, now: later(IDLE_DAYS, 1000) }),
    ).rejects.toThrow(/idle/);
  });

  dbit(`survives ${IDLE_DAYS} days of USE, which is what the idle timer means`, async () => {
    const { token } = await createSession(memberId, { client: prisma, now: NOW });
    // Used every ten days for fifty: never idle, so never idle-expired.
    for (const d of [10, 20, 30, 40, 50]) {
      const who = await verifySession(token, { client: prisma, now: later(d) });
      expect(who.memberId).toBe(memberId);
    }
  });

  dbit(`dies after ${ABSOLUTE_DAYS} days however active, which is what the idle timer cannot do`, async () => {
    const { token } = await createSession(memberId, { client: prisma, now: NOW });
    for (const d of [10, 20, 30, 40, 50, 60, 70, 80, 89]) {
      await verifySession(token, { client: prisma, now: later(d) });
    }
    await expect(
      verifySession(token, { client: prisma, now: later(ABSOLUTE_DAYS, 1000) }),
    ).rejects.toThrow(/expired/);
  });

  dbit("lastSeenAt is not written on every request", async () => {
    const { token, sessionId } = await createSession(memberId, { client: prisma, now: NOW });
    const before = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    // A minute later: a read-only page view must not become a write.
    await verifySession(token, { client: prisma, now: new Date(NOW.getTime() + 60_000) });
    const after = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after.lastSeenAt.getTime()).toBe(before.lastSeenAt.getTime());
  });
});

describe("FR-A2 and FR-A5: ending sessions", () => {
  dbit("a revoked session stops working immediately", async () => {
    const { token, sessionId } = await createSession(memberId, { client: prisma, now: NOW });
    await verifySession(token, { client: prisma, now: NOW });
    await revokeSession(sessionId, { client: prisma, now: NOW });
    await expect(verifySession(token, { client: prisma, now: NOW })).rejects.toThrow(/revoked/);
  });

  dbit("revoking one device does not sign the others out", async () => {
    const phone = await createSession(memberId, { client: prisma, now: NOW });
    const laptop = await createSession(memberId, { client: prisma, now: NOW });
    await revokeSession(phone.sessionId, { client: prisma, now: NOW });

    await expect(verifySession(phone.token, { client: prisma, now: NOW })).rejects.toThrow();
    const still = await verifySession(laptop.token, { client: prisma, now: NOW });
    expect(still.memberId).toBe(memberId);
  });

  dbit("the list shows live sessions and marks the current one", async () => {
    const a = await createSession(memberId, { client: prisma, now: NOW });
    const b = await createSession(memberId, { client: prisma, now: NOW });
    const listed = await listSessions(memberId, a.sessionId, { client: prisma, now: NOW });

    expect(listed.map((s) => s.id).sort()).toEqual([a.sessionId, b.sessionId].sort());
    expect(listed.find((s) => s.id === a.sessionId)?.current).toBe(true);
    expect(listed.find((s) => s.id === b.sessionId)?.current).toBe(false);
  });

  dbit("the list carries no device fingerprint, only when it started", async () => {
    const { sessionId } = await createSession(memberId, { client: prisma, now: NOW });
    const [listed] = await listSessions(memberId, sessionId, { client: prisma, now: NOW });
    // No IP address and no user agent. A per-session record of where a member
    // was and on what is data this platform has no use for.
    expect(Object.keys(listed!).sort()).toEqual(["current", "id", "issuedAt", "lastSeenAt"]);
  });

  dbit("a revoked session disappears from the list", async () => {
    const a = await createSession(memberId, { client: prisma, now: NOW });
    await revokeSession(a.sessionId, { client: prisma, now: NOW });
    expect(await listSessions(memberId, a.sessionId, { client: prisma, now: NOW })).toEqual([]);
  });

  dbit("an expired session disappears from the list without being revoked", async () => {
    await createSession(memberId, { client: prisma, now: NOW });
    const listed = await listSessions(memberId, "none", {
      client: prisma,
      now: later(IDLE_DAYS, 1000),
    });
    expect(listed).toEqual([]);
  });
});

describe("FR-A4: a failure says nothing about what failed", () => {
  dbit("every rejection is the same error type to a caller", async () => {
    const { token, sessionId } = await createSession(memberId, { client: prisma, now: NOW });
    await revokeSession(sessionId, { client: prisma, now: NOW });

    const failures = await Promise.all(
      [
        verifySession(undefined, { client: prisma }),
        verifySession("never-issued", { client: prisma }),
        verifySession(token, { client: prisma }),
      ].map((p) => p.then(() => null).catch((e: unknown) => e)),
    );
    for (const f of failures) expect(f).toBeInstanceOf(NoSession);
    // The reason exists for logs and for these tests. The API turns all of
    // them into one response, which is where FR-A4 actually lands.
    expect(new Set(failures.map((f) => (f as NoSession).reason)).size).toBe(3);
  });
});

/**
 * FR-A5: ending every session but this one.
 *
 * The list this screen shows cannot be read once it is long, because a session
 * records only its dates: no address, no device, deliberately. On the
 * development account it reached 79 rows, all identical but for a timestamp.
 * Choosing between them is not a choice, so the useful operation is "keep this
 * one, end the rest".
 */
describe("revoking every other session", () => {
  /** A second member, so the scoping can be checked against a real neighbour. */
  async function neighbour(): Promise<string> {
    const m = await prisma.member.upsert({
      where: { provider_providerSubject: { provider: "test", providerSubject: "session-other" } },
      update: {},
      create: {
        provider: "test",
        providerSubject: "session-other",
        emailDomain: "student.example.invalid",
        tenantId: "00000000-0000-0000-0000-0000000000t2",
      },
    });
    await prisma.session.deleteMany({ where: { memberId: m.id } });
    return m.id;
  }

  dbit("ends the others and keeps the one asking", async () => {
    const keep = await createSession(memberId, { client: prisma, now: NOW });
    const a = await createSession(memberId, { client: prisma, now: NOW });
    const b = await createSession(memberId, { client: prisma, now: NOW });

    const ended = await revokeOtherSessions(memberId, keep.sessionId, { client: prisma, now: NOW });
    expect(ended).toBe(2);

    const live = await listSessions(memberId, keep.sessionId, { client: prisma, now: NOW });
    expect(live.map((s) => s.id)).toEqual([keep.sessionId]);

    // And the tokens really stop working, rather than merely stopping being
    // listed. A row hidden from a screen is not a revocation.
    for (const gone of [a, b]) {
      await expect(
        verifySession(gone.token, { client: prisma, now: NOW }),
      ).rejects.toBeInstanceOf(NoSession);
    }
    await expect(
      verifySession(keep.token, { client: prisma, now: NOW }),
    ).resolves.toMatchObject({ memberId });
  });

  dbit("touches nobody else's sessions", async () => {
    const other = await neighbour();
    const keep = await createSession(memberId, { client: prisma, now: NOW });
    await createSession(memberId, { client: prisma, now: NOW });
    const untouched = await createSession(other, { client: prisma, now: NOW });

    await revokeOtherSessions(memberId, keep.sessionId, { client: prisma, now: NOW });

    const still = await listSessions(other, untouched.sessionId, { client: prisma, now: NOW });
    expect(still).toHaveLength(1);
    await prisma.session.deleteMany({ where: { memberId: other } });
  });

  dbit("is a no-op when there is only this one", async () => {
    const keep = await createSession(memberId, { client: prisma, now: NOW });
    expect(await revokeOtherSessions(memberId, keep.sessionId, { client: prisma, now: NOW })).toBe(0);
    expect(await listSessions(memberId, keep.sessionId, { client: prisma, now: NOW })).toHaveLength(1);
  });

  /**
   * An id that is not this member's keeps nothing: every row of theirs ends,
   * including the one they are using. That is the safe direction to fail in,
   * because the other one leaves an intruder signed in.
   */
  dbit("keeps nothing when the id to keep is not theirs", async () => {
    const other = await neighbour();
    const ours = await createSession(memberId, { client: prisma, now: NOW });
    const notOurs = await createSession(other, { client: prisma, now: NOW });

    expect(await revokeOtherSessions(memberId, notOurs.sessionId, { client: prisma, now: NOW })).toBe(1);
    await expect(
      verifySession(ours.token, { client: prisma, now: NOW }),
    ).rejects.toBeInstanceOf(NoSession);
    await prisma.session.deleteMany({ where: { memberId: other } });
  });
});
