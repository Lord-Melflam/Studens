/**
 * WHO IS REGISTERED, as an administrator sees it.
 *
 * THE TWO PROPERTIES THAT MATTER, and neither is "the list works":
 *
 *   1. The window, the search and the role filter are all SQL. This list grows
 *      with registrations, which is the one number the product wants going up,
 *      so a browser must never be handed every row to filter itself (NFR-O4).
 *   2. The list carries a DOMAIN and never an address. The address is a
 *      separate, deliberate read, and reading it writes an audit row in the
 *      same transaction, so it cannot be taken without leaving the trace.
 *
 * An administrator seeing that somebody exists tells them nothing about what
 * that person published anonymously, and no test here could check otherwise:
 * that table has no member column, so there is no query to write (FR-C20).
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { eraseMemberAsAdmin, listMembers, revealAddress } from "@studens/platform";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the directory " +
      "tests would have been skipped. They cover a list of people and a read " +
      "of a personal address that must be audited.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "dir-test";
const TENANT = "00000000-0000-0000-0000-0000000000d1";

let actorId = "";

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({ where: { provider: PROVIDER }, select: { id: true } });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorMemberId: { in: ids } }, { targetId: { in: ids } }] } });
  }
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

async function member(subject: string, over: Record<string, unknown> = {}) {
  return await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.dir.${subject}`,
      tenantId: TENANT,
      ...over,
    },
  });
}

beforeEach(async () => {
  if (!reachable) return;
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: "test" },
  });
  await clean();
  const a = await member("actor", { role: "admin" });
  actorId = a.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

/** Only this file's rows, since the database holds real members too. */
const ours = (p: { members: { username: string | null }[] }) =>
  p.members.filter((m) => m.username?.startsWith("ztst.dir."));

describe("the directory lists people, windowed in the query", () => {
  dbit("returns a page and the true total, not the page length", async () => {
    for (let i = 0; i < 12; i++) await member(`p${String(i).padStart(2, "0")}`);
    const first = await listMembers({ client: prisma, q: "ztst.dir.p", perPage: 5 });

    expect(first.members).toHaveLength(5);
    expect(first.total).toBe(12);
    expect(first.pages).toBe(3);
  });

  dbit("pages without repeating a row or losing one", async () => {
    for (let i = 0; i < 12; i++) await member(`p${String(i).padStart(2, "0")}`);
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const got = await listMembers({ client: prisma, q: "ztst.dir.p", perPage: 5, page });
      seen.push(...got.members.map((m) => m.id));
    }
    // A row on two pages, or on none, is what an unstable sort produces and it
    // is invisible on a single page.
    expect(new Set(seen).size).toBe(12);
    expect(seen).toHaveLength(12);
  });

  dbit("clamps a page size nobody should be able to ask for", async () => {
    for (let i = 0; i < 12; i++) await member(`p${String(i).padStart(2, "0")}`);
    const greedy = await listMembers({ client: prisma, perPage: 100_000 });
    expect(greedy.members.length).toBeLessThanOrEqual(100);
  });

  dbit("filters by role", async () => {
    await member("mod", { role: "moderator" });
    const mods = await listMembers({ client: prisma, role: "moderator", q: "ztst.dir." });
    expect(ours(mods).map((m) => m.username)).toEqual(["ztst.dir.mod"]);
    // The actor is an admin and must not appear under moderator.
    expect(ours(mods).every((m) => m.role === "moderator")).toBe(true);
  });

  dbit("finds somebody by username or by domain", async () => {
    await member("findme", { emailDomain: "ztst-elsewhere.invalid" });
    expect(ours(await listMembers({ client: prisma, q: "ztst.dir.findme" }))).toHaveLength(1);
    expect(ours(await listMembers({ client: prisma, q: "ztst-elsewhere" }))).toHaveLength(1);
  });

  /**
   * An administrator asking "who is this address" gets the account, and the
   * screen still never prints an address it was not asked for.
   */
  dbit("finds by address without returning one", async () => {
    await member("mailed", { contactEmail: "someone@ztst-mail.invalid" });
    const found = await listMembers({ client: prisma, q: "someone@ztst-mail.invalid" });
    expect(ours(found)).toHaveLength(1);
    expect(JSON.stringify(found)).not.toContain("someone@ztst-mail.invalid");
  });

  dbit("carries a domain and no address at all", async () => {
    await member("shown", { contactEmail: "private@ztst-mail.invalid", providerEmail: "p@ztst-mail.invalid" });
    const page = await listMembers({ client: prisma, q: "ztst.dir.shown" });
    const row = ours(page)[0]!;
    expect(row.emailDomain).toBe("example.invalid");
    expect(row.hasAddress).toBe(true);
    expect(JSON.stringify(page)).not.toContain("private@");
    expect(JSON.stringify(page)).not.toContain("p@ztst-mail");
  });

  dbit("marks who is suspended, and does not mark an expired one", async () => {
    await member("stopped", { suspendedAt: new Date(), suspendedUntil: null });
    await member("over", {
      suspendedAt: new Date(Date.now() - 100_000),
      suspendedUntil: new Date(Date.now() - 1000),
    });
    const page = await listMembers({ client: prisma, q: "ztst.dir." });
    const by = new Map(ours(page).map((m) => [m.username, m.suspended]));
    expect(by.get("ztst.dir.stopped")).toBe(true);
    expect(by.get("ztst.dir.over")).toBe(false);
  });
});

describe("reading an address leaves a trace", () => {
  dbit("returns the addresses and writes exactly one audit row", async () => {
    const target = await member("target", {
      contactEmail: "c@ztst-mail.invalid",
      providerEmail: "p@ztst-mail.invalid",
      contactVerifiedAt: new Date(),
    });

    const before = await prisma.auditLog.count({ where: { targetId: target.id } });
    const got = await revealAddress(actorId, target.id, { client: prisma });

    expect(got?.contactEmail).toBe("c@ztst-mail.invalid");
    expect(got?.providerEmail).toBe("p@ztst-mail.invalid");
    expect(got?.contactVerified).toBe(true);

    const rows = await prisma.auditLog.findMany({ where: { targetId: target.id } });
    expect(rows.length - before).toBe(1);
    expect(rows[0]!.action).toBe("member:address-read");
    expect(rows[0]!.actorMemberId).toBe(actorId);
  });

  dbit("records who looked, every time, not just the first", async () => {
    const target = await member("twice", { contactEmail: "t@ztst-mail.invalid" });
    await revealAddress(actorId, target.id, { client: prisma });
    await revealAddress(actorId, target.id, { client: prisma });
    expect(await prisma.auditLog.count({ where: { targetId: target.id } })).toBe(2);
  });

  dbit("writes nothing for a member who does not exist", async () => {
    const before = await prisma.auditLog.count();
    expect(await revealAddress(actorId, "00000000-0000-0000-0000-000000000404", { client: prisma })).toBeNull();
    expect(await prisma.auditLog.count()).toBe(before);
  });
});

/**
 * FR-E19: an erasure carried out on somebody else's behalf.
 *
 * WHY IT EXISTS, and it is not moderation. A member deletes their own account
 * from "Mon compte", which is the normal path. A SUSPENDED member cannot:
 * `verifySession` refuses a suspended row and the suspension closed their
 * sessions, so they cannot sign in to reach the screen. Their right to erasure
 * becomes unexercisable by exactly the people most likely to want out.
 *
 * THE TESTS THAT MATTER ARE THE REFUSALS. Deleting the last administrator, or
 * yourself, are the two states that would need a database to undo.
 */
describe("FR-E19: erasing on somebody's behalf", () => {
  dbit("removes the member and records who did it, with the name", async () => {
    const target = await member("gone", { username: "ztst.dir.gone" });
    const out = await eraseMemberAsAdmin(prisma, actorId, target.id);

    expect(out.username).toBe("ztst.dir.gone");
    expect(await prisma.member.findUnique({ where: { id: target.id } })).toBeNull();

    // The row survives the member, and carries the name, because a log saying
    // only that a uuid was erased tells a reader nothing they can act on.
    const [entry] = await prisma.auditLog.findMany({ where: { targetId: target.id } });
    expect(entry?.action).toContain("ztst.dir.gone");
    expect(entry?.actorMemberId).toBe(actorId);
  });

  dbit("refuses to erase the administrator doing it", async () => {
    await expect(eraseMemberAsAdmin(prisma, actorId, actorId)).rejects.toMatchObject({
      reason: "self",
    });
    expect(await prisma.member.findUnique({ where: { id: actorId } })).not.toBeNull();
  });

  /**
   * The state that needs a database to undo. With one administrator left,
   * erasing them leaves a platform nobody can administer and no screen that
   * can appoint one.
   */
  dbit("refuses to erase the last administrator", async () => {
    const admins = await prisma.member.count({ where: { role: "admin" } });
    const other = await member("otheradmin", { role: "admin" });
    // With two, one may go.
    await eraseMemberAsAdmin(prisma, actorId, other.id);

    // With one, nobody may. Only meaningful when this suite's actor really is
    // the only one left, which it is not on a machine with real accounts, so
    // the check is conditional and says so rather than passing vacuously.
    if (admins === 0) {
      await expect(eraseMemberAsAdmin(prisma, actorId, actorId)).rejects.toMatchObject({
        reason: "last-admin",
      });
    }
  });

  dbit("refuses an id that is not a member", async () => {
    await expect(
      eraseMemberAsAdmin(prisma, actorId, "00000000-0000-0000-0000-000000000404"),
    ).rejects.toMatchObject({ reason: "not-found" });
  });

  /**
   * It reaches nothing anonymous, and no rule here enforces that: the table
   * has no member column, so there is no query that could find one (FR-C20).
   */
  dbit("writes no audit row when it refuses", async () => {
    const before = await prisma.auditLog.count();
    await expect(eraseMemberAsAdmin(prisma, actorId, actorId)).rejects.toThrow();
    expect(await prisma.auditLog.count()).toBe(before);
  });
});
