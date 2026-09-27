-- FR-I1: somebody tells us what is wrong with Studens itself.
--
-- WHY THIS TABLE HAS A NULLABLE MEMBER COLUMN, and why that is not the thing
-- FR-C2 forbids. That rule is about REVIEWS: one table with a nullable owner
-- means the schema itself permits the link, and the unlinkability guarantee
-- would rest on application code staying correct forever. There is no such
-- guarantee here and there never was. This is somebody saying the search is
-- broken, and being able to answer them is the whole point. `platform.Report`
-- has had exactly this shape since FR-E8, for exactly this reason.
--
-- WHY SIGNED-OUT IS ALLOWED. The public link is going on social media. The
-- person who arrives, finds it confusing and leaves is the one whose opinion
-- is worth most, and they will not make an account to give it. A form behind a
-- sign-in collects feedback only from people who already liked it enough to
-- sign in, which is the sample that tells you least.
--
-- WHAT IS DELIBERATELY NOT A COLUMN: no address, no user agent, no device, no
-- query string. The session list refuses the same things for the same reason
-- (FR-A5): a per-event record of where somebody was and on what is a thing we
-- would then be holding. The path is kept because "it broke on the search
-- screen" is most of a bug report; what they typed into the search box is not
-- needed to find the fault and is theirs.
CREATE TABLE "platform"."Feedback" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contactEmail" TEXT,
    "route" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- The console's default order, and the two ways it is actually read.
CREATE INDEX "Feedback_createdAt_idx" ON "platform"."Feedback"("createdAt");
CREATE INDEX "Feedback_memberId_idx" ON "platform"."Feedback"("memberId");
CREATE INDEX "Feedback_status_createdAt_idx" ON "platform"."Feedback"("status", "createdAt");

-- ON DELETE SET NULL, not CASCADE. Deleting an account must not delete what
-- that person told us about a bug: the report stays, detached, exactly as
-- FR-A15 detaches an attributed review rather than destroying its text. The
-- contact address they typed stays with it, because they gave it here, for
-- this, and it is the only way the answer they asked for can reach them.
ALTER TABLE "platform"."Feedback"
    ADD CONSTRAINT "Feedback_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- The module roles must not gain sight of this. Reasserted rather than
-- assumed: a new table is created by the owner, and a GRANT that was never
-- written is the kind of absence nobody notices. `studens_platform` reaches it
-- through the default privileges set in 20260910161500_roles_and_grants.
REVOKE ALL ON "platform"."Feedback" FROM PUBLIC;
