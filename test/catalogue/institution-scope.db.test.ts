/**
 * A COURSE CODE IS ONLY UNIQUE INSIDE ONE CATALOGUE.
 *
 * `Course.code` was globally unique and `Programme` was unique on (code, year).
 * Both were correct with one institution and became an accident of naming with
 * two: UCLouvain publishes `lepl1503`, ULB publishes `comm-b1010` and
 * `ba-tecn`, so nothing collides today and nothing said it had to keep not
 * colliding.
 *
 * What a collision would have cost is not a duplicate row. A load is one
 * transaction, so one colliding code fails a whole catalogue after the crawl
 * that produced it has spent over an hour, which has happened here once
 * already for a different reason.
 *
 * These run against the real database because the thing being checked IS the
 * database: a Prisma model can say anything, and the constraint is what holds.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { institutionId } from "../fixtures/catalogue.js";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the institution " +
      "scoping tests would have been skipped. They cover the constraint that " +
      "lets a second university's catalogue be loaded at all.",
  );
}
// Decided at collection time, like the other database suites: `it.runIf` reads
// its condition before `beforeAll` has run, so a flag set there leaves every
// test skipped and the file passing.
const dbit = reachable ? it : it.skip;

let uclouvain = "";
let ulb = "";

/** Distinctive, so a failed run leaves rows that are obviously this file's. */
const CODE = "ztst-scope-01";
const PROG = "ztst-scope-prog";
const FAC = "ztst-scope-fac";

/**
 * This file builds its own faculty instead of finding one.
 *
 * CI migrates an empty database and never loads a catalogue, so the first
 * version of this looked for "any UCLouvain faculty", passed here and failed
 * there. A test that only works on a developer's machine is worse than no
 * test: it is a gate that will not catch the thing it was written for on the
 * day somebody else runs it.
 */
let facultyId = "";

beforeAll(async () => {
  if (!reachable) return;
  uclouvain = await institutionId(prisma, "uclouvain");
  ulb = await institutionId(prisma, "ulb");
  await clean();
  const faculty = await prisma.faculty.upsert({
    where: { institutionId_code: { institutionId: uclouvain, code: FAC } },
    update: {},
    create: { institutionId: uclouvain, code: FAC, name: "A faculty this test owns" },
  });
  facultyId = faculty.id;
});

async function clean() {
  if (!reachable) return;
  await prisma.programme.deleteMany({ where: { code: PROG } });
  await prisma.course.deleteMany({ where: { code: CODE } });
  await prisma.faculty.deleteMany({ where: { code: FAC } });
}

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("two institutions may publish the same code", () => {
  dbit("accepts one course code in two catalogues", async () => {
    const a = await prisma.course.create({ data: { code: CODE, institutionId: uclouvain } });
    const b = await prisma.course.create({ data: { code: CODE, institutionId: ulb } });
    expect(a.id).not.toBe(b.id);
    // And they are two courses, not one seen twice, which is the point: a
    // review on one must never appear on the other.
    expect(await prisma.course.count({ where: { code: CODE } })).toBe(2);
  });

  dbit("still refuses the same code twice in one catalogue", async () => {
    await expect(
      prisma.course.create({ data: { code: CODE, institutionId: uclouvain } }),
    ).rejects.toThrow();
  });
});

describe("a programme cannot be filed under the wrong institution", () => {
  dbit("refuses an institution its faculty does not belong to", async () => {
    // The composite foreign key, and the reason the denormalised column is
    // safe to keep. Programme.institutionId duplicates what Faculty already
    // knows, and two copies of one fact drift; here they cannot.
    await expect(
      prisma.programme.create({
        data: {
          code: PROG,
          year: 2026,
          title: "A programme filed under the wrong university",
          facultyId,
          institutionId: ulb,
        },
      }),
    ).rejects.toThrow();
  });

  dbit("accepts it when the two agree", async () => {
    const row = await prisma.programme.create({
      data: {
        code: PROG,
        year: 2026,
        title: "A programme filed correctly",
        facultyId,
        institutionId: uclouvain,
      },
    });
    expect(row.institutionId).toBe(uclouvain);
  });
});

describe("the column is required, not optional", () => {
  dbit("refuses a course with no institution at all", async () => {
    // Counting existing rows would pass vacuously on the empty database CI
    // migrates, which is exactly the shape of test this file already got
    // wrong once. This asks the constraint instead, so it means the same
    // thing on both machines.
    await expect(
      prisma.$executeRaw`INSERT INTO ref."Course"(id, code) VALUES ('ztst-scope-null', ${CODE})`,
    ).rejects.toThrow();
  });
});
