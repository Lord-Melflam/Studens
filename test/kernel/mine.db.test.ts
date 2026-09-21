/**
 * FR-D12 and FR-C14: a member's own reviews, and changing one.
 *
 * THE PROPERTY WORTH HOLDING IS THE ONE THAT IS NOT ABOUT EDITING. Both of
 * these take a member id, and neither can reach an anonymous review, because
 * that table has no column to match a member on (FR-C20). These tests assert
 * that from the outside: an anonymous review sitting on the same course, by
 * the same person, in the same session, appears in nobody's list and cannot
 * be edited by its id.
 *
 * That is the guarantee working rather than a rule the code applies, and it
 * is worth a test precisely because there is nothing in `mine.ts` to read
 * that enforces it.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  ReviewInvalid,
  editAttributed,
  myReviews,
  submitAnonymous,
  submitAttributed,
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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the FR-D12 and " +
      "FR-C14 tests would have been skipped. They cover a member's own " +
      "reviews and the fact that the anonymous path has none.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "mine-test";
const TENANT = "00000000-0000-0000-0000-0000000000m1";

let courseId = "";
let memberId = "";
let otherId = "";

/** The shape a first submission takes, so an edit can be compared against it. */
const draft = (over: Partial<Record<string, unknown>> = {}) => ({
  courseId,
  academicYear: 2024,
  recommendation: 4,
  workloadVsEcts: 3,
  difficulty: 3,
  body: "Un cours exigeant mais bien construit.",
  completed: true,
  ...over,
});

async function member(subject: string): Promise<string> {
  const m = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: subject,
      emailDomain: "example.invalid",
      username: `ztst.mine.${subject}`,
      tenantId: TENANT,
    },
  });
  return m.id;
}

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({
    where: { provider: PROVIDER },
    select: { id: true },
  });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.reviewAttributed.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.memberQuota.deleteMany({ where: { memberId: { in: ids } } });
  }
  if (courseId) await prisma.reviewAnonymous.deleteMany({ where: { courseId } });
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

beforeEach(async () => {
  if (!reachable) return;
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: "test" },
  });
  const course = await upsertCourse(prisma, "ztst.mine.course");
  courseId = course.id;
  await clean();
  memberId = await member("owner");
  otherId = await member("stranger");
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("FR-D12: a member sees their own attributed reviews", () => {
  dbit("lists what they published under their name", async () => {
    await submitAttributed(memberId, draft(), { client: prisma });
    const mine = await myReviews(memberId, { client: prisma });

    expect(mine).toHaveLength(1);
    expect(mine[0]!.body).toContain("exigeant");
    expect(mine[0]!.courseId).toBe(courseId);
  });

  dbit("shows nobody else's", async () => {
    await submitAttributed(memberId, draft(), { client: prisma });
    expect(await myReviews(otherId, { client: prisma })).toHaveLength(0);
  });

  /**
   * The property this file exists for. An anonymous review by the same person
   * on the same course is not in the list, and could not be: there is no
   * column that would put it there.
   */
  dbit("never lists an anonymous one, in either direction", async () => {
    await submitAnonymous(memberId, draft({ body: "Publié anonymement, et introuvable." }), {
      client: prisma,
    });

    expect(await myReviews(memberId, { client: prisma })).toHaveLength(0);
    // And it really was written: the absence above is not a failed insert.
    expect(await prisma.reviewAnonymous.count({ where: { courseId } })).toBe(1);
  });
});

describe("FR-C14: the author changes what they said", () => {
  dbit("replaces the content and moves updatedAt past createdAt", async () => {
    const { id } = await submitAttributed(memberId, draft(), { client: prisma });
    const before = await myReviews(memberId, { client: prisma });

    const after = await editAttributed(
      memberId,
      id,
      { recommendation: 2, workloadVsEcts: 5, difficulty: 5, body: "En fait, le rythme est brutal.", completed: true },
      { client: prisma },
    );

    expect(after.body).toBe("En fait, le rythme est brutal.");
    expect(after.recommendation).toBe(2);
    // A reader judging a course by dated feedback has to be able to tell the
    // text changed, so the edit is recorded rather than silent.
    expect(after.updatedAt.getTime()).toBeGreaterThan(before[0]!.createdAt.getTime());
  });

  dbit("leaves the course and the year where they were", async () => {
    const { id } = await submitAttributed(memberId, draft(), { client: prisma });
    const after = await editAttributed(
      memberId,
      id,
      { recommendation: 5, workloadVsEcts: 1, difficulty: 1, body: "Rien à redire, vraiment.", completed: true },
      { client: prisma },
    );
    expect(after.academicYear).toBe(2024);
    expect(after.courseId).toBe(courseId);
  });

  dbit("refuses an id that belongs to somebody else", async () => {
    const { id } = await submitAttributed(memberId, draft(), { client: prisma });

    await expect(
      editAttributed(
        otherId,
        id,
        { recommendation: 1, workloadVsEcts: 1, difficulty: 1, body: "Détourné par un inconnu.", completed: true },
        { client: prisma },
      ),
    ).rejects.toBeInstanceOf(ReviewInvalid);

    // And the text is untouched, which is the thing that actually matters.
    const still = await myReviews(memberId, { client: prisma });
    expect(still[0]!.body).toContain("exigeant");
  });

  /**
   * An anonymous id cannot be edited. Not because this refuses it, but
   * because it is a row in another table that no `memberId` matches.
   */
  dbit("cannot reach an anonymous review by its id", async () => {
    await submitAnonymous(memberId, draft({ body: "Anonyme, et hors de portée." }), {
      client: prisma,
    });
    const anon = await prisma.reviewAnonymous.findFirstOrThrow({ where: { courseId } });

    await expect(
      editAttributed(
        memberId,
        anon.id,
        { recommendation: 1, workloadVsEcts: 1, difficulty: 1, body: "Tentative de modification.", completed: true },
        { client: prisma },
      ),
    ).rejects.toBeInstanceOf(ReviewInvalid);

    const untouched = await prisma.reviewAnonymous.findUniqueOrThrow({ where: { id: anon.id } });
    expect(untouched.body).toContain("hors de portée");
  });

  dbit("applies the same content rules as a first submission", async () => {
    const { id } = await submitAttributed(memberId, draft(), { client: prisma });
    await expect(
      editAttributed(
        memberId,
        id,
        { recommendation: 4, workloadVsEcts: 3, difficulty: 3, body: "court", completed: true },
        { client: prisma },
      ),
    ).rejects.toBeInstanceOf(ReviewInvalid);
  });

  /** Correcting what is already published adds nothing to the pile. */
  dbit("spends no quota", async () => {
    const { id } = await submitAttributed(memberId, draft(), { client: prisma });
    const spent = await prisma.memberQuota.findFirst({ where: { memberId } });

    await editAttributed(
      memberId,
      id,
      { recommendation: 3, workloadVsEcts: 3, difficulty: 3, body: "Une correction sans coût.", completed: true },
      { client: prisma },
    );

    const after = await prisma.memberQuota.findFirst({ where: { memberId } });
    expect(after?.used).toBe(spent?.used);
  });
});
