/**
 * SEARCH ANSWERS FROM THE CATALOGUES THE READER ASKED FOR.
 *
 * It answered from all of them. A student who had chosen one university found
 * another's courses among their results, reported from use on 2026-09-21 by
 * somebody testing the tunnel.
 *
 * THE SECOND DEFECT IS THE ONE THESE TESTS EXIST FOR, because it survives the
 * obvious fix. `search` takes a limited window of rows and then collapses
 * older editions of the same course, so the limit is spent on whatever the
 * database returns first. Filtering the ANSWER would hide the other
 * catalogue's rows and leave the reader's own truncated: measured on the real
 * data, "droit" returned 24 rows from one catalogue and 1 from the other,
 * while the database holds 199 and 282 matching offerings respectively. One
 * result out of 282 looks like a working search and is not.
 *
 * So the scope belongs in the query, and the test that matters is not "the
 * other catalogue is absent" but "mine is no longer truncated by it".
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DatabaseCatalogue } from "@studens/ref";
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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the search " +
      "scoping tests would have been skipped. They cover a reader being shown " +
      "another university's courses among their own.",
  );
}

const dbit = reachable ? it : it.skip;

/**
 * A word nothing real matches, so the rows counted here are only this file's.
 * `zsco` keeps it inside the ztst-style namespace the other suites use.
 */
const WORD = "zscopeword";
const YEAR = 2026;
/** Comfortably more than the default window of 25, which is the point. */
const PER_INSTITUTION = 30;

async function seed(code: string, institution: string) {
  const id = await institutionId(prisma, institution);
  for (let i = 0; i < PER_INSTITUTION; i++) {
    const courseCode = `${code}${String(i).padStart(3, "0")}`;
    const course = await prisma.course.upsert({
      where: { institutionId_code: { institutionId: id, code: courseCode } },
      update: {},
      create: { code: courseCode, institutionId: id },
      select: { id: true },
    });
    await prisma.courseOffering.upsert({
      where: { courseId_year: { courseId: course.id, year: YEAR } },
      update: { title: `${WORD} ${i}` },
      create: { courseId: course.id, year: YEAR, title: `${WORD} ${i}` },
    });
  }
}

async function clean() {
  if (!reachable) return;
  const mine = await prisma.course.findMany({
    where: { OR: [{ code: { startsWith: "zscoa" } }, { code: { startsWith: "zscob" } }] },
    select: { id: true },
  });
  const ids = mine.map((c) => c.id);
  if (ids.length === 0) return;
  await prisma.courseOffering.deleteMany({ where: { courseId: { in: ids } } });
  await prisma.course.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  if (!reachable) return;
  await clean();
  // Two catalogues, each with more matches than one page of results holds.
  await seed("zscoa", "uclouvain");
  await seed("zscob", "ulb");
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("a scoped search answers from that catalogue only", () => {
  dbit("returns nothing from a catalogue that was not asked for", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    const results = await catalogue.search(WORD, { institutions: ["uclouvain"] });

    expect(results.length).toBeGreaterThan(0);
    expect([...new Set(results.map((r) => r.institution))]).toEqual(["uclouvain"]);
  });

  /**
   * The regression that a browser-side filter would not have caught. Both
   * catalogues hold more matches than the window, so whichever sorts first
   * fills it; scoping afterwards would leave the reader with whatever
   * fragment of their own catalogue survived.
   */
  dbit("does not spend the window on rows the reader did not ask for", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    const everywhere = await catalogue.search(WORD);

    // Each catalogue can fill a page on its own.
    const scoped = {
      uclouvain: await catalogue.search(WORD, { institutions: ["uclouvain"] }),
      ulb: await catalogue.search(WORD, { institutions: ["ulb"] }),
    };
    expect(scoped.uclouvain).toHaveLength(25);
    expect(scoped.ulb).toHaveLength(25);

    // Unscoped, one page has to hold both, so at least one of them is short.
    // WHICH one is not asserted: it depends on the order the rows come back
    // in, and the harm is the same either way. Asserting a direction made this
    // test pass for the wrong reason on the first run, because the fixture
    // happened to truncate the other catalogue.
    const shortfall = (["uclouvain", "ulb"] as const).filter(
      (code) => everywhere.filter((r) => r.institution === code).length < scoped[code].length,
    );
    expect(shortfall.length).toBeGreaterThan(0);
  });

  dbit("treats an empty scope as every catalogue", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    const none = await catalogue.search(WORD, { institutions: [] });
    const absent = await catalogue.search(WORD);
    expect(none.map((r) => r.code)).toEqual(absent.map((r) => r.code));
  });

  dbit("answers nothing for a catalogue that does not exist", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    expect(await catalogue.search(WORD, { institutions: ["nowhere"] })).toEqual([]);
  });

  dbit("still finds a course by its code inside the scope", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    const hit = await catalogue.search("zscoa000", { institutions: ["uclouvain"] });
    expect(hit.map((r) => r.code)).toContain("zscoa000");

    // And not from outside it: the same code prefix scoped elsewhere is absent.
    expect(await catalogue.search("zscoa000", { institutions: ["ulb"] })).toEqual([]);
  });
});
