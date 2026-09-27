/**
 * OPEN-47: the catalogue was French whatever language the interface was in.
 *
 * THE DEFECT THAT MATTERS IS NOT "no English". It is that the obvious fix,
 * crawling the English edition INSTEAD, silently destroys data. Measured on 24
 * courses and 168 field pairs on 2026-09-27:
 *
 *     absent in both  72     genuinely translated  64
 *     FRENCH ONLY     27     identical text         4      English only  1
 *
 * Sixteen per cent of fields exist in French and not in English. So the
 * choice is per FIELD, and these tests are mostly about the fields where
 * English is missing rather than the ones where it is present.
 *
 * The second trap is that the English page can carry the literal sentence
 * "See French document". Storing it replaces a real French field with a
 * sentence telling the reader to go and find what was just discarded.
 * Confirmed on `lepl1503`: 1,855 characters of French assessment, and that
 * sentence in English.
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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the OPEN-47 " +
      "tests would have been skipped. They cover a fallback that, if it " +
      "regressed, would silently hide a sixth of the catalogue's text.",
  );
}

const dbit = reachable ? it : it.skip;
const YEAR = 2026;
const CODE = "ztst.en.course";

const block = (t: string) => [{ kind: "p", lines: [[{ t }]] }];

async function clean() {
  if (!reachable) return;
  const mine = await prisma.course.findMany({
    where: { code: { startsWith: "ztst.en" } },
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
  const id = await institutionId(prisma, "uclouvain");
  const course = await prisma.course.create({
    data: { code: CODE, institutionId: id },
    select: { id: true },
  });
  await prisma.courseOffering.create({
    data: {
      courseId: course.id,
      year: YEAR,
      title: "Projet de test",
      titleEn: "Test project",
      // French has all three.
      content: block("Contenu en français"),
      assessment: block("Évaluation en français"),
      bibliography: block("Bibliographie en français"),
      // English has content only. The assessment is the 16% case: French
      // publishes it and English does not. The bibliography is absent from
      // this object entirely, which is the same case written a second way.
      textEn: { content: block("Content in English") },
    },
  });
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("a field comes back in the language that actually exists", () => {
  dbit("gives a French reader French throughout", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "fr");
    expect(c?.title).toBe("Projet de test");
    expect(JSON.stringify(c?.content)).toContain("français");
    expect(c?.textLanguage.content).toBe("fr");
    expect(c?.textLanguage.title).toBe("fr");
  });

  dbit("gives an English reader English where there is some", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "en");
    expect(c?.title).toBe("Test project");
    expect(JSON.stringify(c?.content)).toContain("Content in English");
    expect(c?.textLanguage.content).toBe("en");
    expect(c?.textLanguage.title).toBe("en");
  });

  /**
   * THE TEST THIS FILE EXISTS FOR. Sixteen per cent of fields are like this.
   * An English reader must still get the French assessment, not nothing, and
   * must be told it is French.
   */
  dbit("falls back to French per field, and says so", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "en");
    expect(JSON.stringify(c?.assessment), "the French text was lost").toContain("français");
    expect(c?.textLanguage.assessment).toBe("fr");
    // Same case, written by omitting the key rather than by absence of text.
    expect(JSON.stringify(c?.bibliography)).toContain("français");
    expect(c?.textLanguage.bibliography).toBe("fr");
  });

  /**
   * THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-27, and the change is
   * deliberate rather than a fix.
   *
   * There is no Dutch edition and there cannot be: `nl-cours-...` answers 404.
   * The original rule sent every reader who had not asked for English to
   * French, so a Dutch reader was shown French and told so in Dutch, on a
   * course whose English edition was sitting in the same row. Overruled by the
   * owner on knowledge of the country: a Dutch speaker in Belgium is likelier
   * to read English comfortably than French.
   *
   * Dutch readers still get French where English does not exist, which is the
   * case the rest of this file covers.
   */
  dbit("gives a Dutch reader English rather than French where both exist", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "nl");
    expect(JSON.stringify(c?.content)).toContain("Content in English");
    expect(c?.textLanguage.content).toBe("en");
  });

  dbit("defaults to French when no language is asked for", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE);
    expect(c?.title).toBe("Projet de test");
    expect(c?.textLanguage.content).toBe("fr");
  });

  /**
   * The English title is a column rather than a key inside the JSON precisely
   * so this works: a student reading the English interface types the English
   * words and has to reach the course.
   */
  dbit("finds a course by its English title", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    const hits = await catalogue.search("Test project", { institutions: ["uclouvain"] });
    expect(hits.map((h) => h.code)).toContain(CODE);
    // And the French title still finds it, which is the half that must not
    // have been traded away for the other.
    expect(
      (await catalogue.search("Projet de test", { institutions: ["uclouvain"] })).map((h) => h.code),
    ).toContain(CODE);
  });
});

/**
 * WHICH EDITION A READER IS OFFERED FIRST.
 *
 * A DUTCH READER GETS ENGLISH BEFORE FRENCH. The owner's call, 2026-09-27, on
 * knowledge of the country rather than anything in this repository: a Dutch
 * speaker in Belgium is likelier to read English comfortably than French.
 *
 * The first version offered French to everyone who had not asked for English,
 * so a Dutch reader on a course with a perfectly good English edition was
 * shown French and told, in Dutch, that the record was in French. Reported
 * from use.
 *
 * Neither guess has to be right, because the page carries a switch. These
 * tests are about where a reader STARTS, and about the record saying plainly
 * which edition it is, since the screen cannot work that out by comparing
 * against an interface language that no edition matches.
 */
describe("which edition a reader is offered", () => {
  dbit("offers a Dutch reader English, not French", async () => {
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "nl");
    expect(c?.edition).toBe("en");
    expect(c?.title).toBe("Test project");
    expect(JSON.stringify(c?.content)).toContain("Content in English");
  });

  dbit("still falls back per field for a Dutch reader", async () => {
    // The assessment exists in French only, so it comes back in French and
    // says so, inside a record that is otherwise English.
    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", CODE, "nl");
    expect(JSON.stringify(c?.assessment)).toContain("français");
    expect(c?.textLanguage.assessment).toBe("fr");
  });

  dbit("says which edition it served, for each reader", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    expect((await catalogue.get("uclouvain", CODE, "fr"))?.edition).toBe("fr");
    expect((await catalogue.get("uclouvain", CODE, "en"))?.edition).toBe("en");
    expect((await catalogue.get("uclouvain", CODE))?.edition).toBe("fr");
  });

  /**
   * The switch is offered on the strength of a second edition EXISTING, not on
   * which one is currently shown, so the list is the same whoever asks.
   */
  dbit("lists the editions that exist, the same way for everybody", async () => {
    const catalogue = new DatabaseCatalogue(prisma, YEAR);
    for (const locale of ["fr", "nl", "en"]) {
      expect((await catalogue.get("uclouvain", CODE, locale))?.editions.sort()).toEqual(["en", "fr"]);
    }
  });

  /**
   * A course with no English edition offers no choice, so the screen draws no
   * switch: a control with one option can do nothing.
   */
  dbit("offers one edition where only one exists", async () => {
    const id = await institutionId(prisma, "uclouvain");
    const bare = await prisma.course.create({
      data: { code: "ztst.en.bare", institutionId: id },
      select: { id: true },
    });
    await prisma.courseOffering.create({
      data: { courseId: bare.id, year: YEAR, title: "Sans anglais", content: block("Que du français") },
    });

    const c = await new DatabaseCatalogue(prisma, YEAR).get("uclouvain", "ztst.en.bare", "nl");
    expect(c?.editions).toEqual(["fr"]);
    expect(c?.edition).toBe("fr");
    expect(c?.textLanguage.content).toBe("fr");
  });
});
