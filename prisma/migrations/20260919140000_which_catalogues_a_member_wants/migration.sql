-- Which catalogues a member wants in front of them.
--
-- `Member.institutionCode` answers "where do you study". It is one place, and
-- FR-F13 makes it a preference rather than a tenant. This answers a different
-- question: "whose courses do you want to see". The two start the same, because
-- the useful default for somebody at UCLouvain is UCLouvain, and they diverge
-- the moment a student wants to look at a course they might take elsewhere, or
-- an exchange student wants both.
--
-- The catalogue is linked to the university chosen on the fifth page of the
-- first run, and a control adds or removes another as an RYC favourite: a way
-- to narrow and to widen as somebody goes.
--
-- A SET AND NOT A SECOND SINGLE CHOICE, because "narrow and enlarge" is not a
-- thing one column can express.
--
-- `institutionCode` carries NO foreign key, exactly as `Member.institutionCode`
-- does not, and for the same reason: the platform is tier 0 and
-- `ref.Institution` belongs to a tier 1 module, so a key here would point the
-- wrong way (FR-B11). The cost is referential integrity and it is already
-- accepted in institutions.ts: a code could name an institution later removed,
-- and no institution row is ever deleted, only marked unavailable.
--
-- BACKFILLED FROM THE CHOICE ALREADY MADE. Everybody who picked an institution
-- at the first run gets it as their first favourite, so nobody has to answer a
-- question they already answered. A member who picked none gets no row, and the
-- interface reads that as "everything", which is what somebody who never said
-- is entitled to see.

CREATE TABLE "platform"."MemberInstitution" (
    "memberId" TEXT NOT NULL,
    "institutionCode" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberInstitution_pkey" PRIMARY KEY ("memberId","institutionCode")
);

ALTER TABLE "platform"."MemberInstitution"
  ADD CONSTRAINT "MemberInstitution_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "platform"."MemberInstitution" ("memberId", "institutionCode")
SELECT "id", "institutionCode" FROM "platform"."Member"
 WHERE "institutionCode" IS NOT NULL AND "institutionCode" <> '';
