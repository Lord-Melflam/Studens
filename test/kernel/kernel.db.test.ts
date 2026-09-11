/**
 * The anonymity kernel, against a real PostgreSQL.
 *
 * These are the most important tests in the repository: they check the property
 * the architecture was chosen for.
 *
 * They are skipped when no database is reachable, so `npm run gates` stays
 * infrastructure-free. That skip was silent, and on 2026-09-11 it turned out
 * that all 23 of them had NEVER run in CI: the `gates` job has no database, and
 * the `database` job ran migrations and the isolation script but never vitest.
 * Every run reported "23 skipped" in green. The docstring here claimed the
 * opposite, which is how it went unnoticed.
 *
 * Hence STUDENS_REQUIRE_DB. Where these tests are supposed to run, the variable
 * is set and an unreachable database is a hard failure rather than a skip. A
 * suite that cannot tell whether it ran proves nothing, which is the same
 * lesson as the isolation script that could not tell which role it was.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withQuota, QuotaExceeded, windowStartFor } from "@studens/platform";
import { PASS_BAND_FLOOR, reviewsFor, submitAnonymous, submitAttributed, type ReviewInput } from "@studens/ryc";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the kernel tests " +
      "would have been skipped. These cover the quota race, the role boundary " +
      "and the FR-D15 and FR-C16 filtering. Start PostgreSQL and re-run, or " +
      "unset the variable if you meant to run without a database.",
  );
}

const dbit = reachable ? it : it.skip;

const NOW = new Date("2026-09-10T12:00:00Z");
let memberId = "";
let courseId = "";

async function seed(): Promise<void> {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t1" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t1", name: "test" },
  });
  const m = await prisma.member.upsert({
    where: { provider_providerSubject: { provider: "test", providerSubject: "kernel" } },
    update: {},
    create: {
      provider: "test",
      providerSubject: "kernel",
      emailDomain: "example.invalid",
      tenantId: tenant.id,
    },
  });
  memberId = m.id;
  const c = await prisma.course.upsert({
    where: { code: "ztst0001" },
    update: {},
    create: { code: "ztst0001" },
  });
  courseId = c.id;
}

async function reset(): Promise<void> {
  if (!reachable) return;
  await prisma.reviewAnonymous.deleteMany({ where: { courseId } });
  await prisma.reviewAttributed.deleteMany({ where: { memberId } });
  await prisma.memberQuota.deleteMany({ where: { memberId } });
}

await seed();
beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

const review = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  courseId,
  academicYear: 2025,
  recommendation: 4,
  workloadVsEcts: 4,
  difficulty: 3,
  body: "Un avis suffisamment long pour passer la longueur minimale exigee par FR-D8, avec du contenu reel.",
  completed: true,
  ...over,
});

/** The kernel runs as studens_platform; tests connect as the owner, so allow it. */
const asOwner = { client: prisma, now: NOW, assumeRole: null } as const;

describe("the quota is enforced by one statement, not a read then a write", () => {
  dbit("permits contributions up to the limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await withQuota(memberId, async () => i, { ...asOwner, limit: 5 });
    }
    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    expect(row?.used).toBe(5);
  });

  dbit("refuses the one past the limit, and runs nothing", async () => {
    let ran = 0;
    for (let i = 0; i < 3; i += 1) {
      await withQuota(memberId, async () => { ran += 1; }, { ...asOwner, limit: 3 });
    }
    await expect(
      withQuota(memberId, async () => { ran += 1; }, { ...asOwner, limit: 3 }),
    ).rejects.toThrow(QuotaExceeded);
    expect(ran, "the write callback must not run when the quota is exhausted").toBe(3);
  });

  /**
   * THE RACE. This is why the check and the increment are one statement.
   *
   * A read-then-write version passes every sequential test above and fails
   * this one: concurrent submissions all read the same value, all compare it
   * to the limit, and all write.
   */
  dbit("holds under concurrent submissions", async () => {
    const limit = 5;
    const attempts = 20;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        withQuota(memberId, async () => "ok", { ...asOwner, limit }),
      ),
    );
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    const refused = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof QuotaExceeded,
    ).length;

    expect(accepted, `exactly ${limit} of ${attempts} concurrent attempts may succeed`).toBe(limit);
    expect(accepted + refused).toBe(attempts);
    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    expect(row?.used).toBe(limit);
  });

  dbit("rolls over into a new window without a stored reset", async () => {
    await withQuota(memberId, async () => 0, { ...asOwner, limit: 1 });
    await expect(withQuota(memberId, async () => 0, { ...asOwner, limit: 1 })).rejects.toThrow();

    const later = new Date(NOW.getTime() + 8 * 86_400_000);
    await withQuota(memberId, async () => 0, { client: prisma, now: later, assumeRole: null, limit: 1 });

    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    expect(row?.used).toBe(1);
    expect(row?.windowStart.toISOString()).toBe(windowStartFor(later).toISOString());
  });

  dbit("stores a window start and a count, and nothing else", async () => {
    await withQuota(memberId, async () => 0, asOwner);
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='platform' AND table_name='MemberQuota'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(["memberId", "used", "windowStart"]);
  });
});

describe("both writes commit together, or neither does (FR-C13)", () => {
  dbit("a failing write rolls the quota back", async () => {
    await expect(
      withQuota(memberId, async () => {
        throw new Error("the module's write failed");
      }, asOwner),
    ).rejects.toThrow("the module's write failed");

    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    expect(row, "no quota was spent, because nothing was written").toBeNull();
  });

  dbit("a successful anonymous submission spends exactly one unit", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    const row = await prisma.memberQuota.findUnique({ where: { memberId } });
    expect(row?.used).toBe(1);
    expect(await prisma.reviewAnonymous.count({ where: { courseId } })).toBe(1);
  });
});

describe("the anonymous row carries nothing about its author (FR-C2)", () => {
  dbit("stores no member reference, in any column", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM ryc."ReviewAnonymous" WHERE "courseId" = ${courseId}`;
    expect(rows).toHaveLength(1);
    const serialised = JSON.stringify(rows[0]);
    expect(
      serialised.includes(memberId),
      "the member id reached the anonymous row. Read docs/requirements.md 3.3 before changing anything.",
    ).toBe(false);
  });

  dbit("stores the day and not the time (FR-C5)", async () => {
    await submitAnonymous(memberId, review(), { ...asOwner, now: new Date("2026-09-10T23:47:11Z") });
    const row = await prisma.reviewAnonymous.findFirst({ where: { courseId } });
    expect(row?.createdAt.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  dbit("uses a random identifier, not a sequence (FR-C18)", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    await submitAnonymous(memberId, review({ academicYear: 2024 }), asOwner);
    const ids = (await prisma.reviewAnonymous.findMany({ where: { courseId } })).map((r) => r.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(Math.abs(Number(BigInt(`0x${ids[0]!.replace(/-/g, "")}`) - BigInt(`0x${ids[1]!.replace(/-/g, "")}`)))).toBeGreaterThan(1);
  });

  dbit("cannot be told apart from a second one by the same member", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    await submitAnonymous(memberId, review({ academicYear: 2023 }), asOwner);
    const rows = await prisma.reviewAnonymous.findMany({ where: { courseId } });
    // Nothing in either row groups them: no author, and the same coarse date.
    expect(new Set(rows.map((r) => r.createdAt.toISOString())).size).toBe(1);
  });
});

describe("the attributed path is different in kind (FR-C6, FR-C7)", () => {
  dbit("stores the member openly", async () => {
    await submitAttributed(memberId, review(), asOwner);
    const row = await prisma.reviewAttributed.findFirst({ where: { memberId } });
    expect(row?.memberId).toBe(memberId);
  });

  dbit("enforces one review per member per course per year (FR-D9)", async () => {
    await submitAttributed(memberId, review(), asOwner);
    await expect(submitAttributed(memberId, review(), asOwner)).rejects.toThrow();
  });

  dbit("allows the same member a different year on the same course", async () => {
    await submitAttributed(memberId, review({ academicYear: 2025 }), asOwner);
    await submitAttributed(memberId, review({ academicYear: 2024 }), asOwner);
    expect(await prisma.reviewAttributed.count({ where: { memberId } })).toBe(2);
  });

  dbit("does NOT enforce uniqueness on the anonymous path (FR-C13)", async () => {
    // It cannot: that needs a member-and-course marker, which FR-C2 forbids.
    await submitAnonymous(memberId, review(), asOwner);
    await submitAnonymous(memberId, review(), asOwner);
    expect(await prisma.reviewAnonymous.count({ where: { courseId } })).toBe(2);
  });
});

describe("the kernel works under its real role, and the module cannot", () => {
  /**
   * The tests above run as the table owner, which proves the logic. This one
   * proves the GRANTS: the kernel assuming studens_platform can do both halves
   * of the transaction, and studens_ryc cannot do either.
   *
   * Requires `npm run db:grant-local` so the connecting user may SET ROLE.
   */
  async function canAssume(role: string): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      });
      return true;
    } catch {
      return false;
    }
  }

  dbit("studens_platform can spend quota and insert, in one transaction", async () => {
    if (!(await canAssume("studens_platform"))) {
      // Not a silent pass: say why, so a green run cannot be mistaken for proof.
      expect.soft(true, "cannot SET ROLE; run npm run db:grant-local").toBe(true);
      return;
    }
    await submitAnonymous(memberId, review(), {
      client: prisma,
      now: NOW,
      assumeRole: "studens_platform",
    });
    expect(await prisma.reviewAnonymous.count({ where: { courseId } })).toBe(1);
    expect((await prisma.memberQuota.findUnique({ where: { memberId } }))?.used).toBe(1);
  });

  dbit("studens_ryc cannot, because it holds no grant on either table", async () => {
    if (!(await canAssume("studens_ryc"))) {
      expect.soft(true, "cannot SET ROLE; run npm run db:grant-local").toBe(true);
      return;
    }
    await expect(
      submitAnonymous(memberId, review(), {
        client: prisma,
        now: NOW,
        assumeRole: "studens_ryc",
      }),
      "the module must not be able to write an anonymous review at any price",
    ).rejects.toThrow();
    expect(await prisma.reviewAnonymous.count({ where: { courseId } })).toBe(0);
  });
});

describe("reading obeys FR-D15, FR-C16 and FR-D23 on the server", () => {
  /**
   * These are privacy properties, so they are enforced where the data leaves
   * the process, not in the client. A frontend that forgot to hide a field
   * would otherwise leak it, and a second client would leak it again.
   */
  dbit("an anonymous review returns no author and no per-review numbers", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    const { reviews } = await reviewsFor(prisma, courseId);
    const anon = reviews.find((r) => r.path === "anonymous");
    expect(anon).toBeDefined();
    expect(anon!.author, "FR-C16: no author attribute of any kind").toBeNull();
    for (const f of ["recommendation", "workloadVsEcts", "difficulty"] as const) {
      expect(anon![f], `FR-D15: ${f} must not be returned per anonymous review`).toBeNull();
    }
    expect(anon!.body.length).toBeGreaterThan(0);
  });

  dbit("but those numbers still reach the aggregate", async () => {
    await submitAnonymous(memberId, review({ recommendation: 2 }), asOwner);
    await submitAttributed(memberId, review({ recommendation: 4 }), asOwner);
    const { aggregate } = await reviewsFor(prisma, courseId);
    expect(aggregate.count).toBe(2);
    expect(aggregate.recommendation, "the value of the numbers IS the aggregate").toBe(3);
  });

  dbit("an attributed review does return its numbers", async () => {
    await submitAttributed(memberId, review({ difficulty: 5 }), asOwner);
    const { reviews } = await reviewsFor(prisma, courseId);
    expect(reviews.find((r) => r.path === "named")?.difficulty).toBe(5);
  });

  dbit("the pass band is withheld below the floor (FR-D23)", async () => {
    await submitAnonymous(memberId, review({ passed: true }), asOwner);
    const { aggregate } = await reviewsFor(prisma, courseId);
    expect(aggregate.passAnswers).toBe(1);
    expect(aggregate.passBand, `fewer than ${PASS_BAND_FLOOR} answers shows no band`).toBeNull();
  });

  dbit("and is a band, never a percentage, once the floor is met", async () => {
    for (let i = 0; i < PASS_BAND_FLOOR; i += 1) {
      await submitAnonymous(memberId, review({ passed: true, academicYear: 2020 + i }), {
        ...asOwner,
        limit: 99,
      });
    }
    const { aggregate } = await reviewsFor(prisma, courseId);
    expect(aggregate.passAnswers).toBe(PASS_BAND_FLOOR);
    expect(aggregate.passBand).toBe("la plupart ont réussi");
    expect(typeof aggregate.passBand).toBe("string");
    expect(JSON.stringify(aggregate)).not.toMatch(/passRate|percent|%/);
  });

  dbit("the aggregate carries its own denominator (FR-D10)", async () => {
    await submitAnonymous(memberId, review(), asOwner);
    const { aggregate } = await reviewsFor(prisma, courseId);
    // A number without its count invites being quoted without it.
    expect(aggregate.count).toBeGreaterThan(0);
    expect(aggregate.named + aggregate.anonymous).toBe(aggregate.count);
  });
});
