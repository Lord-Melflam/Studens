/**
 * A COURSE THE INSTITUTION HAS STOPPED OFFERING.
 *
 * Course identity outlives a yearly offering, which is why they are two tables:
 * `LINGI` became `LINFO`, codes appear and vanish. The reader did not honour
 * that. It looked for an offering in the CURRENT year only, so a course last
 * taught in 2025-2026 could not be opened at all and did not appear in search.
 *
 * On the first full crawl that was 61 courses, silently unreachable. FR-D16 says
 * a review states its own year and survives a missing offering, and it cannot if
 * the page it lives on has gone: the review is still in the database and nobody
 * can read it.
 *
 * These run against the real database, because the bug was in a query.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DatabaseCatalogue } from "@studens/ref";
import { FIXTURE_INSTITUTION, upsertCourse } from "../fixtures/catalogue.js";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the stale offering " +
      "tests would have been skipped. They cover a course the institution no " +
      "longer offers staying readable.",
  );
}
const dbit = reachable ? it : it.skip;

const THIS_YEAR = 2999;
const LAST_YEAR = 2998;
let courseId = "";

beforeAll(async () => {
  if (!reachable) return;
  const course = await upsertCourse(prisma, "ztst9001");
  courseId = course.id;
  // Only an OLD offering: the institution stopped offering it.
  await prisma.courseOffering.upsert({
    where: { courseId_year: { courseId, year: LAST_YEAR } },
    update: { title: "A course that is no longer given" },
    create: { courseId, year: LAST_YEAR, title: "A course that is no longer given", ects: 5 },
  });
  // And one current course, so the catalogue has a current year at all.
  const current = await upsertCourse(prisma, "ztst9002");
  await prisma.courseOffering.upsert({
    where: { courseId_year: { courseId: current.id, year: THIS_YEAR } },
    update: { title: "A course still given" },
    create: { courseId: current.id, year: THIS_YEAR, title: "A course still given", ects: 5 },
  });
});

afterAll(async () => {
  if (reachable) {
    await prisma.courseOffering.deleteMany({ where: { year: { in: [THIS_YEAR, LAST_YEAR] } } });
    await prisma.course.deleteMany({ where: { code: { in: ["ztst9001", "ztst9002"] } } });
  }
  await prisma.$disconnect();
});

describe("a course with no offering this year", () => {
  dbit("can still be opened, from its most recent description", async () => {
    const catalogue = await DatabaseCatalogue.open({ client: prisma, year: THIS_YEAR });
    const course = await catalogue.get(FIXTURE_INSTITUTION, "ztst9001");
    expect(course).not.toBeNull();
    expect(course?.title).toBe("A course that is no longer given");
    // The year it is actually describing, not the year that was asked for.
    expect(course?.year).toBe(LAST_YEAR);
    expect(course?.offeredThisYear).toBe(false);
  });

  dbit("is found by search, so somebody can reach it at all", async () => {
    const catalogue = await DatabaseCatalogue.open({ client: prisma, year: THIS_YEAR });
    const found = await catalogue.search("ztst9001");
    expect(found.map((c) => c.code)).toEqual(["ztst9001"]);
    expect(found[0]?.offeredThisYear).toBe(false);
  });

  dbit("does not claim to be current", async () => {
    // The whole page is last year's facts: credits, term, lecturers. Saying so
    // is the difference between a record and a lie.
    const catalogue = await DatabaseCatalogue.open({ client: prisma, year: THIS_YEAR });
    const current = await catalogue.get(FIXTURE_INSTITUTION, "ztst9002");
    expect(current?.offeredThisYear).toBe(true);
    expect(current?.year).toBe(THIS_YEAR);
  });

  dbit("appears once in search, not once per year it was offered", async () => {
    // A course offered for ten years must not fill the results with itself.
    await prisma.courseOffering.upsert({
      where: { courseId_year: { courseId, year: LAST_YEAR - 1 } },
      update: {},
      create: { courseId, year: LAST_YEAR - 1, title: "An older edition", ects: 5 },
    });
    try {
      const catalogue = await DatabaseCatalogue.open({ client: prisma, year: THIS_YEAR });
      const found = await catalogue.search("ztst9001");
      expect(found).toHaveLength(1);
      // And it is the most recent one, not whichever the database returned first.
      expect(found[0]?.year).toBe(LAST_YEAR);
    } finally {
      await prisma.courseOffering.deleteMany({ where: { courseId, year: LAST_YEAR - 1 } });
    }
  });
});
