-- A course code and a programme code are only unique inside ONE catalogue.
--
-- `Course.code` was globally unique and `Programme` was unique on (code, year).
-- Both held while there was one institution, and both were an accident of
-- naming after that: UCLouvain publishes `lepl1503` and ULB publishes
-- `comm-b1010`, so nothing collides today and nothing said it had to keep not
-- colliding. ULB's programme codes are `ba-tecn`, `ma60-es5ha` and the like,
-- which is a different shape again, and a shape is not a constraint.
--
-- The cost of finding out the hard way is not a duplicate row. A load is one
-- transaction, so one colliding code fails the whole catalogue after the crawl
-- that produced it has already spent over an hour. That has happened once here
-- for a different reason; see 20260917070000_ects_fits_a_programme.
--
-- Requirements 1.5 lists tenancy in the data model as one of the few things
-- cheap now and expensive later. This is that: while the only rows are one
-- institution's and can be rebuilt from the snapshot, it is a backfill. Once
-- reviews point at a second institution's courses, it is a migration with
-- user data hanging off it.
--
-- WHAT THE COLUMN MEANS: whose catalogue the code was drawn from. It is NOT
-- FR-D31's tenant, which is about a course UCLouvain lists and another
-- institution teaches; answering that needs FR-D30's two stated fields, which
-- are specified and not yet parsed. Conflating them would put a guess in a
-- column that reads like a fact.

-- 1. Add the columns nullable, so the backfill can run before they are required.
ALTER TABLE "ref"."Course" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "ref"."Programme" ADD COLUMN "institutionId" TEXT;

-- 2. Backfill.
--
-- A programme's institution is its faculty's, which is where it was already
-- recorded and is why this column is a denormalisation rather than new
-- information.
UPDATE "ref"."Programme" p
   SET "institutionId" = f."institutionId"
  FROM "ref"."Faculty" f
 WHERE f."id" = p."facultyId";

-- A course has no faculty of its own: it is reached THROUGH programmes, and
-- through several (FR-D25). So its catalogue is the institution of the
-- programmes that reach it. Every row loaded so far came from one crawl of one
-- institution, so this is unambiguous today; the DISTINCT guard below is what
-- proves it rather than assuming it.
UPDATE "ref"."Course" c
   SET "institutionId" = sub."institutionId"
  FROM (
        SELECT DISTINCT co."courseId", p."institutionId"
          FROM "ref"."CourseOffering" co
          JOIN "ref"."ProgrammeOffering" po ON po."offeringId" = co."id"
          JOIN "ref"."Programme" p          ON p."id" = po."programmeId"
       ) sub
 WHERE sub."courseId" = c."id";

-- A course reached by no programme at all keeps a null above. That is a real
-- state: 247 programmes publish no course list, and a course can also survive
-- its programme disappearing (FR-D16). Fall back to the only institution whose
-- catalogue has ever been loaded.
UPDATE "ref"."Course"
   SET "institutionId" = (SELECT "id" FROM "ref"."Institution" WHERE "code" = 'uclouvain')
 WHERE "institutionId" IS NULL;

-- 3. Refuse to continue on anything the backfill could not decide.
--
-- Loud, not silent. A migration that quietly files a row under the wrong
-- institution produces a catalogue that looks right and is not, and the error
-- would surface months later as a course that cannot be found.
DO $$
DECLARE
  orphan_courses    bigint;
  orphan_programmes bigint;
  ambiguous         bigint;
BEGIN
  SELECT count(*) INTO orphan_courses    FROM "ref"."Course"    WHERE "institutionId" IS NULL;
  SELECT count(*) INTO orphan_programmes FROM "ref"."Programme" WHERE "institutionId" IS NULL;
  SELECT count(*) INTO ambiguous FROM (
      SELECT co."courseId"
        FROM "ref"."CourseOffering" co
        JOIN "ref"."ProgrammeOffering" po ON po."offeringId" = co."id"
        JOIN "ref"."Programme" p          ON p."id" = po."programmeId"
       GROUP BY co."courseId"
      HAVING count(DISTINCT p."institutionId") > 1
  ) x;

  IF orphan_programmes > 0 THEN
    RAISE EXCEPTION 'migration: % programmes have no faculty to take an institution from', orphan_programmes;
  END IF;
  IF orphan_courses > 0 THEN
    RAISE EXCEPTION 'migration: % courses could not be given an institution', orphan_courses;
  END IF;
  IF ambiguous > 0 THEN
    RAISE EXCEPTION 'migration: % courses are reached from more than one institution. That is FR-D31 territory and this column cannot answer it', ambiguous;
  END IF;
END $$;

-- 4. Now they are required.
ALTER TABLE "ref"."Course"    ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "ref"."Programme" ALTER COLUMN "institutionId" SET NOT NULL;

-- 5. Replace the uniqueness that was wrong.
DROP INDEX "ref"."Course_code_key";
CREATE UNIQUE INDEX "Course_institutionId_code_key" ON "ref"."Course"("institutionId", "code");

DROP INDEX "ref"."Programme_code_year_key";
CREATE UNIQUE INDEX "Programme_institutionId_code_year_key"
    ON "ref"."Programme"("institutionId", "code", "year");

-- 6. Make the denormalisation impossible to get wrong.
--
-- Programme."institutionId" duplicates what Faculty already knows, and two
-- copies of one fact drift. A composite foreign key to (id, institutionId)
-- means a programme filed under an institution its own faculty does not belong
-- to cannot be written, by the database, whatever the loader does. A trigger
-- would do the same and would be code nobody reads; this is a constraint.
CREATE UNIQUE INDEX "Faculty_id_institutionId_key" ON "ref"."Faculty"("id", "institutionId");

ALTER TABLE "ref"."Programme" DROP CONSTRAINT "Programme_facultyId_fkey";
ALTER TABLE "ref"."Programme"
  ADD CONSTRAINT "Programme_facultyId_institutionId_fkey"
  FOREIGN KEY ("facultyId", "institutionId")
  REFERENCES "ref"."Faculty"("id", "institutionId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ref"."Course"
  ADD CONSTRAINT "Course_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "ref"."Institution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Programme_facultyId_idx" ON "ref"."Programme"("facultyId");
