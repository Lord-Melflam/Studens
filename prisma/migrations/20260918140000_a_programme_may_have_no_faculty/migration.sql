-- A programme does not always have a faculty, because ULB's do not.
--
-- `Programme.facultyId` was NOT NULL, which is true of UCLouvain: every one of
-- its 769 programmes is reached through exactly one faculty index. ULB
-- publishes an organisers list instead, and it is a different thing.
--
-- Measured 2026-09-18 on 80 of ULB's 286 French-language 2025 programmes:
--
--   64  name an ULB faculty, and in all 64 it is the FIRST organiser
--    9  publish no organisers field at all
--    7  name only "Pôle éducation" or a haute école, which are real
--       organisers and are not ULB faculties
--
-- Sixteen of eighty, so a fifth of the catalogue rather than an edge case, and
-- the two alternatives were both worse. Dropping them loses a fifth of ULB and
-- contradicts 12.8, which says a field the source omits is a state to record
-- and never a reason to lose the row. Creating a Faculty row for "Haute Ecole
-- Francisco Ferrer" so the column could stay NOT NULL writes something false
-- into the database to keep a constraint happy.
--
-- Null here means THE SOURCE DOES NOT STATE ONE. It is the same word the
-- catalogue already uses for credits, term, site, field of study and kind, and
-- it is not "none".
--
-- Nothing is backfilled and nothing is lost: every existing row has a faculty
-- and keeps it. Widening a column to accept null rewrites no data.

ALTER TABLE "ref"."Programme" ALTER COLUMN "facultyId" DROP NOT NULL;

-- The composite foreign key (facultyId, institutionId) -> Faculty(id,
-- institutionId) is NOT enforced when any of its columns is null, which is
-- exactly the new case. Without a key of its own, a programme with no faculty
-- could name an institution that does not exist and nothing would object.
ALTER TABLE "ref"."Programme"
  ADD CONSTRAINT "Programme_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "ref"."Institution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Programme_institutionId_idx" ON "ref"."Programme"("institutionId");
