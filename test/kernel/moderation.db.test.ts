/**
 * The moderator's console. FR-E3, FR-E10 to FR-E14.
 *
 * TWO GROUPS MATTER MORE THAN THE REST.
 *
 * "who may do what" is FR-E14, and an unanswered appointment path is a
 * privilege escalation path: a moderator who can appoint a moderator can grow
 * the set holding content powers without anybody deciding to.
 *
 * "what a moderator cannot learn" is FR-C. Moderation is the obvious second
 * door into the anonymity design, because it is the one feature that
 * deliberately looks at contributions somebody objected to. What a moderator
 * sees has to be what a reader sees, and no more.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  AppointmentRefused,
  ModerationRefused,
  NotPermitted,
  appointmentHistory,
  OPERATOR,
  ROLES,
  canAppoint,
  canModerate,
  decide,
  grantFirstAdmin,
  listAppointments,
  moderationHistory,
  moderationQueue,
  setRole,
  submitReport,
  type ModeratableContent,
} from "@studens/platform";
import {
  RYC_REVIEW_KIND,
  describeReviewForModeration,
  holdReview,
  releaseReview,
  reviewExists,
} from "@studens/ryc";
import { upsertCourse } from "../fixtures/catalogue.js";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the moderation " +
      "console tests would have been skipped. They cover appointment, the " +
      "queue, decisions and what a moderator cannot see.",
  );
}

const dbit = reachable ? it : it.skip;

const CONTENT: ModeratableContent[] = [
  {
    kind: RYC_REVIEW_KIND,
    exists: reviewExists,
    hold: holdReview,
    release: releaseReview,
    describe: describeReviewForModeration,
  },
];

let tenantId = "";
let courseId = "";

async function seed() {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t5" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t5", name: "test" },
  });
  tenantId = tenant.id;
  const course = await upsertCourse(prisma, "ztst0004");
  courseId = course.id;
}

async function clean() {
  if (!reachable) return;
  // Scoped to THIS file's own course, not to every report of the kind.
  //
  // Both moderation test files use the same target kind, and deleting by kind
  // alone meant whichever ran second wiped the other's rows mid-test. Exactly
  // the failure the session count in callback.db.test.ts had: a cleanup that is
  // really a statement about every other test file.
  const mine = await prisma.reviewAttributed.findMany({
    where: { courseId },
    select: { id: true },
  });
  const anon = await prisma.reviewAnonymous.findMany({
    where: { courseId },
    select: { id: true },
  });
  const ids = [...mine, ...anon].map((r) => r.id);
  if (ids.length > 0) {
    await prisma.report.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { targetId: { in: ids } } });
  }
  await prisma.reviewAttributed.deleteMany({ where: { courseId } });
  await prisma.reviewAnonymous.deleteMany({ where: { courseId } });

  // The appointment entries too, before the members they name are gone.
  // Appointments are audited against a member rather than against a review, so
  // the sweep above cannot see them: they survived every run and the console's
  // history filled with promotions of accounts that no longer exist.
  const mods = await prisma.member.findMany({
    where: { provider: "mod-test" },
    select: { id: true },
  });
  if (mods.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { targetKind: "member", targetId: { in: mods.map((m) => m.id) } },
    });
  }
  await prisma.member.deleteMany({ where: { provider: "mod-test" } });
}

async function member(subject: string, role = "member") {
  const m = await prisma.member.create({
    data: {
      provider: "mod-test",
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.mod.${subject}`,
      role,
      tenantId,
    },
  });
  return { memberId: m.id, role: m.role };
}

async function namedReview(authorId: string) {
  const r = await prisma.reviewAttributed.create({
    data: {
      memberId: authorId,
      courseId,
      academicYear: 2024,
      recommendation: 4,
      workloadVsEcts: 3,
      difficulty: 3,
      body: "A named review that somebody objected to.".padEnd(150, "."),
    },
  });
  return r.id;
}

async function anonymousReview() {
  const r = await prisma.reviewAnonymous.create({
    data: {
      courseId,
      academicYear: 2024,
      recommendation: 4,
      workloadVsEcts: 3,
      difficulty: 3,
      body: "An anonymous review that somebody objected to.".padEnd(150, "."),
      createdAt: new Date("2026-09-16"),
    },
  });
  return r.id;
}

const notice = (targetId: string, over: Record<string, unknown> = {}) => ({
  targetKind: RYC_REVIEW_KIND,
  targetId,
  category: "abuse",
  detail: "A substantiated explanation of what is wrong with this one.",
  ...over,
});

await seed();
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("who may do what (FR-E14)", () => {
  it("a member holds no power", () => {
    expect(canModerate("member")).toBe(false);
    expect(canAppoint("member")).toBe(false);
  });

  it("a moderator has content powers and no appointment power", () => {
    // The distinction is the whole of FR-E14: a moderator who could appoint
    // could grow the set holding content powers without a human deciding to.
    expect(canModerate("moderator")).toBe(true);
    expect(canAppoint("moderator")).toBe(false);
  });

  it("an administrator has both", () => {
    expect(canModerate("admin")).toBe(true);
    expect(canAppoint("admin")).toBe(true);
  });

  dbit("a moderator cannot appoint anybody", async () => {
    const mod = await member("mod", "moderator");
    const target = await member("candidate");
    await expect(setRole(prisma, mod, target.memberId, "moderator")).rejects.toBeInstanceOf(
      NotPermitted,
    );
    const after = await prisma.member.findUniqueOrThrow({ where: { id: target.memberId } });
    expect(after.role).toBe("member");
  });

  dbit("an administrator appoints, and it is recorded", async () => {
    const admin = await member("boss", "admin");
    const target = await member("newmod");
    const out = await setRole(prisma, admin, target.memberId, "moderator");
    expect(out.role).toBe("moderator");

    // FR-E14: the audit entry naming the administrator is the only record of
    // how somebody came to hold the power, and what makes it reviewable.
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { targetKind: "member", targetId: target.memberId },
    });
    expect(entry.actorMemberId).toBe(admin.memberId);
    expect(entry.action).toBe("role:member->moderator");

    const history = await appointmentHistory(prisma);
    expect(history.some((h) => h.targetId === target.memberId)).toBe(true);
  });

  dbit("lists only the people holding a power, not every account", async () => {
    await member("plain");
    const admin = await member("admin2", "admin");
    const mod = await member("mod2", "moderator");
    const list = await listAppointments(prisma);
    const ids = list.map((a) => a.memberId);
    expect(ids).toContain(admin.memberId);
    expect(ids).toContain(mod.memberId);
    expect(list.every((a) => a.role !== "member")).toBe(true);
  });

  dbit("refuses an unknown role and an unknown member", async () => {
    const admin = await member("boss3", "admin");
    const target = await member("someone");
    await expect(setRole(prisma, admin, target.memberId, "wizard")).rejects.toBeInstanceOf(
      AppointmentRefused,
    );
    await expect(setRole(prisma, admin, "no-such-id", "moderator")).rejects.toBeInstanceOf(
      AppointmentRefused,
    );
  });

  /**
   * Two routes to the same failure: nobody left who can appoint anybody, which
   * needs a database to undo.
   */
  dbit("an administrator cannot demote themselves", async () => {
    const admin = await member("boss4", "admin");
    await expect(setRole(prisma, admin, admin.memberId, "member")).rejects.toBeInstanceOf(
      AppointmentRefused,
    );
  });

  dbit("the last administrator cannot be demoted by another", async () => {
    // Clean leaves no admins, so this one is the last.
    const admin = await member("only", "admin");
    const second = await member("boss5", "admin");
    // Now there are two, so demoting one is allowed.
    await setRole(prisma, second, admin.memberId, "member");
    // `second` is now the last, and nobody else can demote them either.
    const third = await member("boss6", "admin");
    await setRole(prisma, third, second.memberId, "member");
    await expect(setRole(prisma, third, third.memberId, "member")).rejects.toBeInstanceOf(
      AppointmentRefused,
    );
  });
});

describe("the queue (FR-E12)", () => {
  dbit("is refused to anybody without the power", async () => {
    const plain = await member("nobody");
    await expect(moderationQueue(prisma, plain, { content: CONTENT })).rejects.toBeInstanceOf(
      NotPermitted,
    );
  });

  dbit("shows what was reported, with the content to read", async () => {
    const author = await member("author");
    const mod = await member("mod3", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, notice(id), { targets: CONTENT });

    const queue = await moderationQueue(prisma, mod, { content: CONTENT });
    const entry = queue.find((q) => q.targetId === id);
    expect(entry?.open).toBe(1);
    expect(entry?.categories).toEqual(["abuse"]);
    expect(entry?.target?.body).toContain("A named review");
    // The module returns an id, not a code: it may not join across schemas.
    expect(entry?.target?.courseId).toBe(courseId);
  });

  /**
   * FR-E12. Oldest first, never most reported: sorting by the count would put
   * whatever a group decided to pile onto at the top, which is precisely the
   * behaviour a brigade is trying to buy. Article 6's clock runs from the
   * notice, so age is also the legally relevant number.
   */
  dbit("orders by age, not by how many people complained", async () => {
    // Two authors, because FR-D9 allows one review per member per course per
    // year and the unique index enforces it. Caught by that index rather than
    // by reading the schema.
    const first = await member("author2a");
    const second = await member("author2b");
    const mod = await member("mod4", "moderator");
    const old = await namedReview(first.memberId);
    const loud = await namedReview(second.memberId);

    await submitReport(prisma, { ...notice(old), reporterMemberId: null }, {
      targets: CONTENT,
      now: new Date("2026-09-01"),
    });
    for (let i = 0; i < 5; i++) {
      await submitReport(prisma, notice(loud), { targets: CONTENT, now: new Date("2026-09-10") });
    }

    // Compared by position among THIS file's two targets, not by taking the
    // head of the queue. The queue is global on purpose, so another test file
    // holding an older open notice would sit in front of both and the
    // assertion would be about that file instead of about the ordering.
    const queue = await moderationQueue(prisma, mod, { content: CONTENT });
    const ours = queue.filter((q) => q.targetId === old || q.targetId === loud);
    expect(ours.map((q) => q.targetId)).toEqual([old, loud]);
    expect(ours.find((q) => q.targetId === loud)?.open).toBe(5);
  });

  dbit("splits the count by whether it came from an account", async () => {
    const author = await member("author3");
    const reporter = await member("reporter");
    const mod = await member("mod5", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, { ...notice(id), reporterMemberId: reporter.memberId }, {
      targets: CONTENT,
    });
    await submitReport(prisma, notice(id), { targets: CONTENT });

    const entry = (await moderationQueue(prisma, mod, { content: CONTENT })).find(
      (q) => q.targetId === id,
    );
    expect(entry?.open).toBe(2);
    expect(entry?.fromMembers).toBe(1);
  });

  /**
   * A notice outlives the thing it is about, and the queue has to survive it.
   *
   * This is not a hypothetical. The content can go between the queue reading
   * the notice and the module reading the content, because the read is READ
   * COMMITTED and a concurrent delete is visible inside the transaction. It
   * cost a build: one missing row threw, and since the queue describes its
   * entries together, the throw failed the whole request. A moderator would
   * have found the console broken with no way to tell why, and no notice at
   * all could be handled until the row came back.
   */
  dbit("survives a notice whose content has gone, and still lets it be closed", async () => {
    const author = await member("author3b");
    const mod = await member("mod5b", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, notice(id), { targets: CONTENT });
    await prisma.reviewAttributed.delete({ where: { id } });

    const queue = await moderationQueue(prisma, mod, { content: CONTENT });
    const entry = queue.find((q) => q.targetId === id);
    expect(entry).toBeDefined();
    // Described as absent, not missing from the queue: the notice is still
    // open, and something has to be done about it.
    expect(entry?.target).toBeNull();
    expect(entry?.open).toBe(1);

    const result = await decide(
      prisma,
      mod,
      { kind: RYC_REVIEW_KIND, id },
      { action: "leave", outcome: "rejected", reason: "the content no longer exists" },
      { content: CONTENT },
    );
    expect(result.reportsClosed).toBe(1);
    expect(
      (await moderationQueue(prisma, mod, { content: CONTENT })).find((q) => q.targetId === id),
    ).toBeUndefined();

    // Cleared here, because `clean` cannot reach it. That cleanup finds this
    // file's rows through its own reviews, and this test deleted the review on
    // purpose, so the notice would outlive every run and pile up in whatever
    // database the tests were pointed at.
    await prisma.report.deleteMany({ where: { targetId: id } });
    await prisma.auditLog.deleteMany({ where: { targetId: id } });
  });
});

describe("deciding (FR-E10, FR-E1)", () => {
  dbit("is refused to anybody without the power", async () => {
    const plain = await member("nobody2");
    const author = await member("author4");
    const id = await namedReview(author.memberId);
    await expect(
      decide(
        prisma,
        plain,
        { kind: RYC_REVIEW_KIND, id },
        { action: "hold", outcome: "upheld", reason: "because" },
        { content: CONTENT },
      ),
    ).rejects.toBeInstanceOf(NotPermitted);
  });

  dbit("hides the content and closes every open notice about it", async () => {
    const author = await member("author5");
    const mod = await member("mod6", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, notice(id), { targets: CONTENT });
    await submitReport(prisma, notice(id), { targets: CONTENT });

    const result = await decide(
      prisma,
      mod,
      { kind: RYC_REVIEW_KIND, id },
      { action: "hold", outcome: "upheld", reason: "names a lecturer" },
      { content: CONTENT },
    );
    expect(result.changed).toBe(true);
    // Both, together. A moderator reads once and decides once; leaving notices
    // open behind a decision grows the queue with work already done.
    expect(result.reportsClosed).toBe(2);
    expect(await prisma.report.count({ where: { targetId: id, status: "open" } })).toBe(0);
    expect(
      (await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } })).status,
    ).toBe("held");
  });

  dbit("puts a held contribution back, unchanged", async () => {
    const author = await member("author6");
    const mod = await member("mod7", "moderator");
    const id = await namedReview(author.memberId);
    const before = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });

    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: CONTENT });
    expect((await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } })).status).toBe("held");

    await decide(
      prisma,
      mod,
      { kind: RYC_REVIEW_KIND, id },
      { action: "release", outcome: "rejected", reason: "nothing wrong with it" },
      { content: CONTENT },
    );
    const after = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("published");
    // The reason holding is safe: nothing was deleted, so this undoes exactly.
    expect(after.body).toBe(before.body);
  });

  dbit("records who decided, and what they decided", async () => {
    const author = await member("author7");
    const mod = await member("mod8", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, notice(id), { targets: CONTENT });

    await decide(
      prisma,
      mod,
      { kind: RYC_REVIEW_KIND, id },
      { action: "leave", outcome: "rejected", reason: "it is a fair review" },
      { content: CONTENT },
    );

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { targetKind: RYC_REVIEW_KIND, targetId: id, action: { startsWith: "moderate:" } },
    });
    expect(entry.actorMemberId).toBe(mod.memberId);
    expect(entry.action).toBe("moderate:leave:rejected");

    const report = await prisma.report.findFirstOrThrow({ where: { targetId: id } });
    expect(report.status).toBe("rejected");
    expect(report.decidedBy).toBe(mod.memberId);
    expect(report.decidedAt).not.toBeNull();

    const history = await moderationHistory(prisma, mod);
    expect(history.some((h) => h.targetId === id)).toBe(true);
  });

  dbit("refuses a kind nothing owns", async () => {
    const mod = await member("mod9", "moderator");
    await expect(
      decide(
        prisma,
        mod,
        { kind: "invented.kind", id: "x" },
        { action: "hold", outcome: "upheld", reason: "because" },
        { content: CONTENT },
      ),
    ).rejects.toBeInstanceOf(ModerationRefused);
  });
});

/**
 * THE SECOND DOOR INTO FR-C, AND WHY IT IS SHUT.
 *
 * Moderation is the one feature that deliberately looks at contributions
 * somebody objected to, so it is the obvious place for authorship to leak. What
 * a moderator sees is what a reader sees, and for an anonymous contribution
 * that is nothing about its author, because there is nothing to see.
 */
describe("what a moderator cannot learn (FR-E14, FR-C2)", () => {
  dbit("an anonymous contribution arrives with no author", async () => {
    const mod = await member("mod10", "moderator");
    const id = await anonymousReview();
    await submitReport(prisma, notice(id), { targets: CONTENT });

    const entry = (await moderationQueue(prisma, mod, { content: CONTENT })).find(
      (q) => q.targetId === id,
    );
    expect(entry?.target?.path).toBe("anonymous");
    expect(entry?.target?.author).toBeNull();
    // Not withheld by this screen: there is no column it could have come from.
    expect(JSON.stringify(entry?.target)).not.toContain("memberId");
  });

  /**
   * A NAMED contribution's author IS public, on the course page. The console
   * still does not return the member id: a moderator decides about content, and
   * resolving it to a person is a capability with no use here.
   */
  dbit("a named contribution does not carry its author's id either", async () => {
    const author = await member("author8");
    const mod = await member("mod11", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, notice(id), { targets: CONTENT });

    const entry = (await moderationQueue(prisma, mod, { content: CONTENT })).find(
      (q) => q.targetId === id,
    );
    expect(entry?.target?.path).toBe("named");
    expect(JSON.stringify(entry?.target)).not.toContain(author.memberId);
  });

  /**
   * The queue carries who REPORTED as a count, never as a list of people.
   * FR-E12 wants the brigading signal, which is a number; naming the reporters
   * to a moderator would make the console a directory of who objects to what.
   */
  dbit("the queue counts reporters without naming them", async () => {
    const author = await member("author9");
    const reporter = await member("reporter2");
    const mod = await member("mod12", "moderator");
    const id = await namedReview(author.memberId);
    await submitReport(prisma, { ...notice(id), reporterMemberId: reporter.memberId }, {
      targets: CONTENT,
    });

    const entry = (await moderationQueue(prisma, mod, { content: CONTENT })).find(
      (q) => q.targetId === id,
    );
    expect(entry?.fromMembers).toBe(1);
    expect(JSON.stringify(entry)).not.toContain(reporter.memberId);
  });
});

/**
 * THE ONE APPOINTMENT NO ADMINISTRATOR MAKES.
 *
 * Every other appointment is refused unless an administrator makes it, which
 * leaves a fresh install with nobody able to appoint anybody and a console
 * nobody can open. The command closes that, and the single condition below is
 * the whole of what stops it being a way around FR-E14 forever.
 */
describe("the first administrator (FR-E14)", () => {
  /**
   * Runs `fn` with no administrator in the database, and puts the existing ones
   * back afterwards.
   *
   * The count is deliberately global, because the question the function asks is
   * global, so this cannot be scoped to the test's own rows the way the rest of
   * this file is. A development database has a real administrator in it, so the
   * roles are saved and restored rather than assumed absent.
   */
  async function withNoAdmins<T>(fn: () => Promise<T>): Promise<T> {
    const admins = await prisma.member.findMany({
      where: { role: "admin" },
      select: { id: true },
    });
    const ids = admins.map((a) => a.id);
    if (ids.length > 0) {
      await prisma.member.updateMany({ where: { id: { in: ids } }, data: { role: "member" } });
    }
    try {
      return await fn();
    } finally {
      if (ids.length > 0) {
        await prisma.member.updateMany({ where: { id: { in: ids } }, data: { role: "admin" } });
      }
    }
  }

  dbit("appoints by username, and records the operator rather than a member", async () => {
    const target = await member("firstadmin");
    const appointed = await withNoAdmins(() => grantFirstAdmin(prisma, "ztst.mod.firstadmin"));
    expect(appointed.role).toBe("admin");
    expect(appointed.memberId).toBe(target.memberId);

    const entry = await prisma.auditLog.findFirst({
      where: { targetId: target.memberId, targetKind: "member" },
      orderBy: { at: "desc" },
    });
    expect(entry?.action).toBe("role:member->admin");
    // Not the promoted member's own id. That would record somebody appointing
    // themselves, which is the one thing `setRole` refuses, so the log would
    // state something the rules forbid.
    expect(entry?.actorMemberId).toBe(OPERATOR);
    expect(entry?.actorMemberId).not.toBe(target.memberId);
  });

  dbit("refuses once there is an administrator, so it cannot appoint a second", async () => {
    await member("secondadmin");
    await member("sitting", "admin");
    await expect(grantFirstAdmin(prisma, "ztst.mod.secondadmin")).rejects.toMatchObject({
      reason: "admin-exists",
    });
    const still = await prisma.member.findFirst({ where: { username: "ztst.mod.secondadmin" } });
    expect(still?.role).toBe("member");
  });

  dbit("refuses a username nobody has, without creating one", async () => {
    await withNoAdmins(async () => {
      await expect(grantFirstAdmin(prisma, "ztst.mod.nobody.at.all")).rejects.toMatchObject({
        reason: "unknown-member",
      });
    });
    expect(await prisma.member.findFirst({ where: { username: "ztst.mod.nobody.at.all" } })).toBeNull();
  });

  dbit("matches the username as it is stored, whatever case it is typed in", async () => {
    const target = await member("casedadmin");
    const appointed = await withNoAdmins(() => grantFirstAdmin(prisma, "  ZTST.MOD.CasedAdmin  "));
    expect(appointed.memberId).toBe(target.memberId);
  });
});

/**
 * The order of `ROLES` is read as rank, not just as a list.
 *
 * The console sends it to the screen unchanged, and the screen compares
 * positions to tell an upgrade from a downgrade: taking a power away asks for a
 * confirmation, giving one does not. Reordering the array would invert that
 * quietly, so the order is checked against the powers themselves rather than
 * against a second copy of the same list, which would only prove it equals
 * itself.
 */
describe("the roles are ordered by how much they can do", () => {
  it("each one can do everything the one before it can, and more", () => {
    const powers = (role: string) => [canModerate(role), canAppoint(role)].filter(Boolean).length;
    for (let i = 1; i < ROLES.length; i++) {
      const weaker = ROLES[i - 1]!;
      const stronger = ROLES[i]!;
      expect(powers(stronger)).toBeGreaterThan(powers(weaker));
      // A superset, not merely a bigger count: a role that traded one power for
      // two would pass a count test and would not be an upgrade.
      if (canModerate(weaker)) expect(canModerate(stronger)).toBe(true);
      if (canAppoint(weaker)) expect(canAppoint(stronger)).toBe(true);
    }
  });
});
