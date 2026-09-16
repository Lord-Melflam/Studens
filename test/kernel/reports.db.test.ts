/**
 * Notice and action. FR-E8 to FR-E12, DSA Articles 16 and 6.
 *
 * Against a real PostgreSQL, because the properties are transactional: a notice
 * that holds its target must not be able to record one without the other, and a
 * cap on the queue is only a cap if the count is taken where the write happens.
 *
 * THE ONE TO READ FIRST is the group at the bottom. This table is the only
 * place in the schema that deliberately links a member to a contribution, and
 * the reason it is allowed is that the member is the REPORTER. If that ever
 * became the author, FR-C2 would be broken by the mechanism built to protect
 * people from the content.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  MAX_OPEN_PER_TARGET,
  REPORT_CATEGORIES,
  ReportInvalid,
  detachMemberReports,
  holdsImmediately,
  openReportSummary,
  submitReport,
  type Moderatable,
} from "@studens/platform";
import { RYC_REVIEW_KIND, holdReview, reviewExists } from "@studens/ryc";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the notice and " +
      "action tests would have been skipped. They cover the Article 16 intake, " +
      "the FR-E11 hold and the queue caps.",
  );
}

const dbit = reachable ? it : it.skip;

const TARGETS: Moderatable[] = [
  { kind: RYC_REVIEW_KIND, exists: reviewExists, hold: holdReview },
];

let tenantId = "";
let courseId = "";
let memberId = "";

async function seed() {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t4" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t4", name: "test" },
  });
  tenantId = tenant.id;
  const course = await prisma.course.upsert({
    where: { code: "ztst0003" },
    update: {},
    create: { code: "ztst0003" },
  });
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
  await prisma.member.deleteMany({ where: { provider: "report-test" } });
}

async function freshMember(subject: string) {
  const m = await prisma.member.create({
    data: {
      provider: "report-test",
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.${subject}`,
      tenantId,
    },
  });
  return m.id;
}

async function namedReview() {
  memberId = await freshMember(`author-${Math.random().toString(36).slice(2, 8)}`);
  const r = await prisma.reviewAttributed.create({
    data: {
      memberId,
      courseId,
      academicYear: 2024,
      recommendation: 4,
      workloadVsEcts: 3,
      difficulty: 3,
      body: "x".repeat(150),
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
      body: "y".repeat(150),
      // No default on this column, deliberately: it is `@db.Date`, so it holds
      // a day and not a moment, and the caller has to say which day. A precise
      // timestamp here would let a contribution be matched to a member by time,
      // which is the whole point of the anonymous path.
      createdAt: new Date("2026-09-16"),
    },
  });
  return r.id;
}

const notice = (targetId: string, over: Record<string, unknown> = {}) => ({
  targetKind: RYC_REVIEW_KIND,
  targetId,
  category: "abuse",
  detail: "This is a substantiated explanation of what is wrong with it.",
  ...over,
});

await seed();
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("anyone can file a notice (FR-E8, Article 16)", () => {
  dbit("accepts one from somebody who is not signed in", async () => {
    // Article 16 says "any individual or entity". Requiring an account would
    // narrow that to people who already joined, and the person most likely to
    // notice that a review names them is the lecturer it names.
    const id = await namedReview();
    const out = await submitReport(prisma, notice(id), { targets: TARGETS });
    expect(out.duplicate).toBe(false);
    const row = await prisma.report.findUniqueOrThrow({ where: { id: out.id } });
    expect(row.reporterMemberId).toBeNull();
    expect(row.status).toBe("open");
  });

  dbit("records the reporter when they are signed in (FR-E12)", async () => {
    const id = await namedReview();
    const reporter = await freshMember("reporter");
    const out = await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: reporter },
      { targets: TARGETS },
    );
    const row = await prisma.report.findUniqueOrThrow({ where: { id: out.id } });
    expect(row.reporterMemberId).toBe(reporter);
  });

  dbit("keeps an optional contact address (Article 16(2)(c))", async () => {
    const id = await namedReview();
    const out = await submitReport(
      prisma,
      { ...notice(id), contactEmail: "Someone@Example.invalid" },
      { targets: TARGETS },
    );
    const row = await prisma.report.findUniqueOrThrow({ where: { id: out.id } });
    expect(row.contactEmail).toBe("someone@example.invalid");
  });

  dbit("refuses a category nobody declared", async () => {
    const id = await namedReview();
    await expect(
      submitReport(prisma, notice(id, { category: "invented" }), { targets: TARGETS }),
    ).rejects.toBeInstanceOf(ReportInvalid);
  });

  /** Article 16(2)(a) asks for a substantiated explanation. "bad" is not one. */
  dbit("refuses a notice with no real explanation", async () => {
    const id = await namedReview();
    await expect(
      submitReport(prisma, notice(id, { detail: "bad" }), { targets: TARGETS }),
    ).rejects.toBeInstanceOf(ReportInvalid);
  });

  /**
   * The same answer whether it never existed or is already held, so the
   * endpoint cannot be used to discover which reviews are under moderation.
   */
  dbit("answers the same for an unknown id and one already held", async () => {
    const gone = await submitReport(prisma, notice("no-such-id"), { targets: TARGETS }).catch(
      (e: unknown) => e as ReportInvalid,
    );
    const id = await namedReview();
    await prisma.reviewAttributed.update({ where: { id }, data: { status: "held" } });
    const held = await submitReport(prisma, notice(id), { targets: TARGETS }).catch(
      (e: unknown) => e as ReportInvalid,
    );
    expect(gone.field).toBe("target");
    expect(held.field).toBe("target");
    expect(held.reason).toBe(gone.reason);
  });
});

describe("what a notice does to its target (FR-E10, FR-E11)", () => {
  dbit("two categories hide it at once, the rest do not", async () => {
    for (const category of REPORT_CATEGORIES) {
      const id = await namedReview();
      const out = await submitReport(prisma, notice(id, { category }), { targets: TARGETS });
      const after = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
      expect(out.held, category).toBe(holdsImmediately(category));
      expect(after.status, category).toBe(holdsImmediately(category) ? "held" : "published");
    }
  });

  /**
   * FR-E10, and the sharpest rule in moderation. A report threshold that
   * REMOVES content is a brigading tool, and what it would remove is precisely
   * the argued negative review this platform exists to protect. Holding is
   * hidden and reversible; nothing here deletes a row or its text.
   */
  dbit("ten notices do not escalate into a hold, let alone a removal", async () => {
    // The categories that do not hold stay not holding, whatever the count. A
    // threshold that escalated here would be the brigading tool FR-E10 refuses.
    const id = await namedReview();
    const before = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
    for (let i = 0; i < 10; i++) {
      await submitReport(prisma, notice(id, { category: "abuse" }), { targets: TARGETS });
    }
    const after = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("published");
    expect(after.body).toBe(before.body);
  });

  dbit("a hold keeps the row and every word of it", async () => {
    const id = await namedReview();
    const before = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: TARGETS });
    const after = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("held");
    // FR-E10: holding is hiding. Nothing is deleted, so a moderator who decides
    // the notice was wrong publishes it again and nothing was lost.
    expect(after.body).toBe(before.body);
    expect(after.advice).toBe(before.advice);
  });

  /**
   * Once held, a review is hidden, so nobody can see it to report it again. A
   * notice arriving anyway, from a page opened before the hold, is refused the
   * same way an unknown id is: the mechanism must not confirm that something is
   * under moderation.
   */
  dbit("a held review cannot be reported again", async () => {
    const id = await namedReview();
    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: TARGETS });
    const again = await submitReport(prisma, notice(id), { targets: TARGETS }).catch(
      (e: unknown) => e as ReportInvalid,
    );
    expect(again.field).toBe("target");
    expect(again.reason).toBe("not-found");
  });

  dbit("holds an anonymous review the same way, and it stays unlinked", async () => {
    const id = await anonymousReview();
    const out = await submitReport(prisma, notice(id, { category: "thirdparty" }), {
      targets: TARGETS,
    });
    expect(out.held).toBe(true);
    const after = await prisma.reviewAnonymous.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("held");
    // FR-C2 is untouched by moderation: holding changes a status, and there is
    // still no column on this table that could name an author.
    expect(Object.keys(after)).not.toContain("memberId");
  });

  /** FR-E1 and FR-E2: what happened and to what, never who wrote it. */
  dbit("writes an audit entry naming the mechanism, not a person", async () => {
    const id = await namedReview();
    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: TARGETS });
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { targetKind: RYC_REVIEW_KIND, targetId: id },
    });
    expect(entry.action).toBe("hold:illegal");
    // No human decided this one, which is the difference between a hold and a
    // removal, so the actor is the mechanism.
    expect(entry.actorMemberId).toBe("system:notice-and-action");
    expect(entry.actorMemberId).not.toBe(memberId);
  });

  dbit("one hold produces exactly one audit entry", async () => {
    const id = await namedReview();
    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: TARGETS });
    // A second notice is refused because the review is now hidden, so there is
    // no second entry claiming to have held something already held.
    await submitReport(prisma, notice(id, { category: "illegal" }), { targets: TARGETS }).catch(
      () => undefined,
    );
    const entries = await prisma.auditLog.count({
      where: { targetKind: RYC_REVIEW_KIND, targetId: id },
    });
    expect(entries).toBe(1);
  });
});

describe("the queue stays readable (Article 6)", () => {
  /**
   * A report is actual knowledge, and the shield depends on acting once we have
   * it. A queue nobody can read is a legal exposure, not just an operational
   * one, which is what every cap here is for.
   */
  dbit("one person files one open notice per target", async () => {
    const id = await namedReview();
    const reporter = await freshMember("repeater");
    const first = await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: reporter },
      { targets: TARGETS },
    );
    const second = await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: reporter },
      { targets: TARGETS },
    );
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    expect(await prisma.report.count({ where: { targetId: id } })).toBe(1);
  });

  dbit("one target stops accumulating stored notices at the cap", async () => {
    const id = await namedReview();
    for (let i = 0; i < MAX_OPEN_PER_TARGET + 5; i++) {
      await submitReport(prisma, notice(id), { targets: TARGETS });
    }
    expect(await prisma.report.count({ where: { targetId: id } })).toBe(MAX_OPEN_PER_TARGET);
  });

  dbit("groups the queue by target, oldest first, with the member count", async () => {
    const quiet = await namedReview();
    const loud = await namedReview();
    const reporter = await freshMember("summarised");

    await submitReport(prisma, { ...notice(loud), reporterMemberId: reporter }, { targets: TARGETS });
    await submitReport(prisma, notice(loud), { targets: TARGETS });
    await submitReport(prisma, notice(quiet), { targets: TARGETS });

    const summary = await openReportSummary(prisma);
    const forLoud = summary.find((s) => s.targetId === loud);
    expect(forLoud?.open).toBe(2);
    // FR-E12: how many came from accounts is half the brigading signal.
    expect(forLoud?.fromMembers).toBe(1);
    // Article 6's clock is the age of the oldest open notice.
    expect(summary[0]?.targetId).toBe(loud);
  });
});

/**
 * THE GROUP THIS TABLE EXISTS UNDER SUSPICION FOR.
 *
 * `platform.Report` links a member to a contribution, which is the shape FR-C2
 * forbids. It is permitted because of WHICH member: the one who reported it,
 * never the one who wrote it. These assert that the distinction holds in the
 * schema rather than in the intention.
 */
describe("a notice names a reporter, never an author (FR-C2)", () => {
  dbit("reporting an anonymous review stores nothing about its author", async () => {
    const id = await anonymousReview();
    const reporter = await freshMember("watcher");
    const out = await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: reporter },
      { targets: TARGETS },
    );
    const row = await prisma.report.findUniqueOrThrow({ where: { id: out.id } });
    expect(row.reporterMemberId).toBe(reporter);
    // There is no author to store, and the report carries no field that could
    // hold one: the only member column is the reporter's.
    const columns = Object.keys(row);
    expect(columns.filter((c) => /member/i.test(c))).toEqual(["reporterMemberId"]);
  });

  /**
   * Somebody reporting their own contribution is indistinguishable from anybody
   * else reporting it, and must stay so: if the platform could tell, it would
   * know an author.
   */
  dbit("an author reporting their own review looks like any other reporter", async () => {
    const id = await namedReview();
    const out = await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: memberId },
      { targets: TARGETS },
    );
    const row = await prisma.report.findUniqueOrThrow({ where: { id: out.id } });
    // Stored exactly as a stranger's would be. No flag, no special case.
    expect(row.reporterMemberId).toBe(memberId);
    expect(row.category).toBe("abuse");
  });

  /**
   * FR-A15. The notices stay, because one may already have caused a hold and
   * Article 16 asks us to show what we did. The link to the person goes.
   */
  dbit("a departing member's notices survive without them", async () => {
    const id = await namedReview();
    const reporter = await freshMember("leaver");
    await submitReport(
      prisma,
      { ...notice(id), reporterMemberId: reporter },
      { targets: TARGETS },
    );

    await prisma.$transaction(async (tx) => {
      await detachMemberReports(tx, reporter);
    });

    const row = await prisma.report.findFirstOrThrow({ where: { targetId: id } });
    expect(row.reporterMemberId).toBeNull();
    expect(row.detail.length).toBeGreaterThan(0);
  });
});
