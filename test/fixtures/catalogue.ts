/**
 * Making a course row in a test.
 *
 * Here rather than repeated in six files because a course now belongs to an
 * institution, and every one of those files had to learn the same lookup on the
 * same day. The next column with the same property should be added here once.
 *
 * `uclouvain` because it is the institution the seed migration marks available
 * and the one every fixture already assumed. Looked up rather than hardcoded as
 * an id: institutions are seeded by migration with generated uuids, so the code
 * is the only stable handle (FR-F10).
 */
import type { PrismaClient } from "@prisma/client";

export const FIXTURE_INSTITUTION = "uclouvain";

export async function institutionId(
  prisma: PrismaClient,
  code: string = FIXTURE_INSTITUTION,
): Promise<string> {
  const row = await prisma.institution.findUnique({ where: { code }, select: { id: true } });
  if (!row) {
    throw new Error(
      `no institution ${code}: institutions are seeded by migration, so this ` +
        `means the test database has not been migrated.`,
    );
  }
  return row.id;
}

/** Upsert a course by code, within the fixture institution. */
export async function upsertCourse(
  prisma: PrismaClient,
  code: string,
): Promise<{ id: string; code: string }> {
  const institution = await institutionId(prisma);
  return prisma.course.upsert({
    where: { institutionId_code: { institutionId: institution, code } },
    update: {},
    create: { code, institutionId: institution },
    select: { id: true, code: true },
  });
}
