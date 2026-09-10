/**
 * Loading a snapshot into the database.
 *
 * The snapshot is the ingestion artefact; this makes it the live catalogue.
 * docs/design/catalogue-ingestion.md section 6 requires the promotion to be
 * all or nothing, so the whole load runs in ONE transaction: a partial or
 * broken load cannot empty a course page, which matters because the catalogue
 * is a reference module (FR-B9) that every feature module reads.
 *
 * TWO RULES THAT ARE NOT OBVIOUS AND ARE BOTH ABOUT REVIEWS.
 *
 * 1. Course ids must be STABLE across runs. `ryc.ReviewAttributed.courseId` and
 *    `ryc.ReviewAnonymous.courseId` reference them, and cross-schema references
 *    are plain ids rather than foreign keys (see the note at the top of
 *    prisma/schema.prisma). So courses are matched on `code` and keep the id
 *    they already have. Recreating them with fresh uuids would orphan every
 *    review ever written, silently.
 *
 * 2. Nothing is ever DELETED from `ref.Course`. Codes disappear from the
 *    catalogue all the time (verified: LINGI1113 exists only in 2012, LFSAB1101
 *    vanishes after 2016), and a review of a retired course must survive
 *    (FR-D16). A course that is no longer offered simply stops gaining
 *    offerings.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import type { Snapshot } from "./snapshot.js";

export interface LoadResult {
  year: number;
  institutions: number;
  faculties: number;
  coursesCreated: number;
  coursesReused: number;
  offerings: number;
  teachers: number;
  facultyLinks: number;
}

export interface LoadOptions {
  /**
   * The institution the crawl belongs to. Not derived from the snapshot,
   * because a snapshot of uclouvain.be contains courses taught elsewhere
   * (OPEN-45) and this is the crawl's own institution, not each course's.
   */
  institutionName?: string;
  /**
   * Assume the role the grants intend before writing. If the grants are wrong
   * the load fails here rather than succeeding with more privilege than the
   * design allows, which makes this self-verifying.
   */
  assumeRole?: string | null;
  client?: PrismaClient;
}

export async function loadSnapshot(
  snapshot: Snapshot,
  opts: LoadOptions = {},
): Promise<LoadResult> {
  const prisma = opts.client ?? new PrismaClient();
  const institutionName = opts.institutionName ?? "UCLouvain";
  const assumeRole = opts.assumeRole === undefined ? "studens_ref" : opts.assumeRole;

  const result: LoadResult = {
    year: snapshot.year,
    institutions: 0,
    faculties: 0,
    coursesCreated: 0,
    coursesReused: 0,
    offerings: 0,
    teachers: 0,
    facultyLinks: 0,
  };

  await prisma.$transaction(
    async (tx) => {
      if (assumeRole) {
        // SET LOCAL: scoped to this transaction, so a pooled connection is not
        // left holding a role after the load finishes.
        // A role name is an IDENTIFIER, so it cannot be a bound parameter.
        // quoteIdent validates it against a strict pattern first, which is what
        // makes interpolating it here safe.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${quoteIdent(assumeRole)}`);
      }

      const institution = await tx.institution.upsert({
        where: { id: await stableInstitutionId(tx, institutionName) },
        update: { name: institutionName },
        create: { name: institutionName },
      });
      result.institutions = 1;

      const facultyIds = new Map<string, string>();
      for (const f of snapshot.faculties) {
        const row = await tx.faculty.upsert({
          where: { institutionId_code: { institutionId: institution.id, code: f.code } },
          update: { name: f.name },
          create: { institutionId: institution.id, code: f.code, name: f.name },
        });
        facultyIds.set(f.code, row.id);
      }
      result.faculties = facultyIds.size;

      for (const o of snapshot.offerings) {
        // Rule 1: match on code, keep the existing id.
        const existing = await tx.course.findUnique({ where: { code: o.code } });
        const course = existing ?? (await tx.course.create({ data: { code: o.code } }));
        if (existing) result.coursesReused += 1;
        else result.coursesCreated += 1;

        const offering = await tx.courseOffering.upsert({
          where: { courseId_year: { courseId: course.id, year: o.year } },
          update: {
            title: o.title,
            ects: o.ects,
            language: o.language,
            quarter: o.quarter,
            assessment: o.assessment,
            contactHours: o.contactHours,
            themes: o.themes,
            content: o.content,
            owningFaculty: o.owningFaculty,
          },
          create: {
            courseId: course.id,
            year: o.year,
            title: o.title,
            ects: o.ects,
            language: o.language,
            quarter: o.quarter,
            assessment: o.assessment,
            contactHours: o.contactHours,
            themes: o.themes,
            content: o.content,
            owningFaculty: o.owningFaculty,
          },
        });
        result.offerings += 1;

        // Teachers and faculty links belong to THIS offering, so replacing
        // them is scoped and safe. Unlike courses, nothing references them.
        await tx.offeringTeacher.deleteMany({ where: { offeringId: offering.id } });
        if (o.teachers.length) {
          await tx.offeringTeacher.createMany({
            data: o.teachers.map((teacherName) => ({ offeringId: offering.id, teacherName })),
          });
          result.teachers += o.teachers.length;
        }

        const via = snapshot.reachedVia
          .filter((r) => r.code === o.code)
          .map((r) => facultyIds.get(r.faculty))
          .filter((id): id is string => Boolean(id));
        await tx.offeringFaculty.deleteMany({ where: { offeringId: offering.id } });
        if (via.length) {
          await tx.offeringFaculty.createMany({
            data: [...new Set(via)].map((facultyId) => ({ offeringId: offering.id, facultyId })),
          });
          result.facultyLinks += new Set(via).size;
        }
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  if (!opts.client) await prisma.$disconnect();
  return result;
}

/** Institutions have no natural key in the schema, so find one by name. */
async function stableInstitutionId(
  tx: Prisma.TransactionClient,
  name: string,
): Promise<string> {
  const found = await tx.institution.findFirst({ where: { name } });
  return found?.id ?? "00000000-0000-0000-0000-000000000000";
}

/** Role names are identifiers, not values, so they cannot be parameterised. */
function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`refusing to use ${name} as a role name`);
  }
  return `"${name}"`;
}
