/**
 * Suspending an account, and telling the person it happened.
 *
 * THE BUG THIS FILE EXISTS FOR. A suspension used to be silent: sessions were
 * closed, the next sign-in failed like any other failure (FR-A4 gives one
 * message whatever went wrong), and from the outside that is indistinguishable
 * from the site being down. Somebody stopped from using a product is owed the
 * reason, and there are now two ways they get it: a message at the moment of
 * the decision, and a screen at their next sign-in. This covers the first.
 *
 * WHAT IS NOT TESTED HERE, because it does not exist. Nothing links the
 * suspension to what that account published anonymously, in either direction
 * (FR-C2), so there is no query to write that would find it, and FR-E7 is that
 * absence rather than a rule the code applies.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { liftSuspension, suspendMember, suspensionOf } from "@studens/platform";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the suspension " +
      "tests would have been skipped. They cover the notice that goes out, " +
      "the sessions that are closed, and what a lifted suspension leaves.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "susp-test";

let tenantId = "";

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({
    where: { provider: PROVIDER },
    select: { id: true, contactEmail: true },
  });
  const addresses = mine.map((m) => m.contactEmail).filter((a): a is string => a !== null);
  if (addresses.length > 0) {
    await prisma.mailOutbox.deleteMany({ where: { toAddress: { in: addresses } } });
  }
  await prisma.session.deleteMany({ where: { memberId: { in: mine.map((m) => m.id) } } });
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

beforeEach(async () => {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000s1" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000s1", name: "test" },
  });
  tenantId = tenant.id;
  await clean();
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

/** `contact` null means no address at all, `verified` false means unconfirmed. */
async function member(
  subject: string,
  contact: { address: string | null; verified: boolean } = { address: null, verified: false },
) {
  return await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.susp.${subject}`,
      role: "member",
      tenantId,
      contactEmail: contact.address,
      contactVerifiedAt: contact.address && contact.verified ? new Date() : null,
    },
  });
}

async function outboxFor(address: string) {
  return await prisma.mailOutbox.findMany({ where: { toAddress: address } });
}

describe("suspending an account tells the person", () => {
  dbit("queues a message carrying the reason and the end date", async () => {
    const m = await member("a", { address: "a@example.invalid", verified: true });
    const out = await suspendMember(prisma, m.id, { days: 7, reason: "Motif écrit à la main" });

    expect(out.suspended).toBe(true);
    expect(out.notified, "a confirmed address was on file").toBe(true);

    const queued = await outboxFor("a@example.invalid");
    expect(queued).toHaveLength(1);
    expect(queued[0]!.kind).toBe("account.suspended");
    const payload = queued[0]!.payload as { reason: string; until: string | null };
    expect(payload.reason).toBe("Motif écrit à la main");
    // An ISO instant, formatted by the template in the reader's language. A
    // date formatted here would be formatted in the server's.
    expect(typeof payload.until).toBe("string");
  });

  dbit("carries a null end date for a permanent one, never a far-off date", async () => {
    const m = await member("b", { address: "b@example.invalid", verified: true });
    await suspendMember(prisma, m.id, { days: null, reason: "Définitif" });
    const [queued] = await outboxFor("b@example.invalid");
    expect((queued!.payload as { until: string | null }).until).toBeNull();
  });

  /**
   * FR-A13: nothing is sent to an address nobody confirmed, which is as likely
   * to be a typo pointing at a stranger as it is to be theirs. The suspension
   * still happens; the console is told that no message went out, so nobody
   * believes the person was informed.
   */
  dbit("sends nothing to an unconfirmed address, and says so", async () => {
    const m = await member("c", { address: "c@example.invalid", verified: false });
    const out = await suspendMember(prisma, m.id, { days: 30, reason: "R" });

    expect(out.suspended).toBe(true);
    expect(out.notified).toBe(false);
    expect(await outboxFor("c@example.invalid")).toHaveLength(0);
  });

  dbit("sends nothing when there is no address at all, and says so", async () => {
    const m = await member("d");
    const out = await suspendMember(prisma, m.id, { days: 30, reason: "R" });
    expect(out.notified).toBe(false);
  });

  /**
   * The outbox holds an address and never a member id (FR-H4), so this table
   * cannot be used to join a person to anything. Checked here because the
   * suspension path writes to it through its own code rather than through
   * notifyMember.
   */
  dbit("puts no member id in the outbox row", async () => {
    const m = await member("e", { address: "e@example.invalid", verified: true });
    await suspendMember(prisma, m.id, { days: 7, reason: "R" });
    const [queued] = await outboxFor("e@example.invalid");
    expect(JSON.stringify(queued)).not.toContain(m.id);
  });
});

describe("what else a suspension does", () => {
  dbit("closes the open sessions in the same transaction", async () => {
    const m = await member("f", { address: "f@example.invalid", verified: true });
    await prisma.session.create({
      data: { memberId: m.id, tokenHash: `ztst-susp-${m.id}` },
    });
    await suspendMember(prisma, m.id, { days: 7, reason: "R" });
    expect(await prisma.session.count({ where: { memberId: m.id } })).toBe(0);
  });

  dbit("reads as over once the end date has passed", async () => {
    const m = await member("g");
    await suspendMember(prisma, m.id, { days: 7, reason: "R" });
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });

    expect(suspensionOf(after).suspended).toBe(true);
    const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(suspensionOf(after, later).suspended).toBe(false);
  });

  dbit("tells the person when it is lifted, and clears the columns", async () => {
    const m = await member("h", { address: "h@example.invalid", verified: true });
    await suspendMember(prisma, m.id, { days: 7, reason: "R" });
    const out = await liftSuspension(prisma, m.id);

    expect(out.suspended).toBe(false);
    expect(out.notified).toBe(true);
    const kinds = (await outboxFor("h@example.invalid")).map((r) => r.kind);
    expect(kinds).toEqual(["account.suspended", "account.reinstated"]);

    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.suspendedAt).toBeNull();
    expect(after.suspendedUntil).toBeNull();
    expect(after.suspendedReason).toBeNull();
  });
});
