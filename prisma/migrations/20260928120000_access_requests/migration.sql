-- FR-E21: a moderator asks an administrator for something out of reach.
--
-- THIS TABLE GRANTS NOTHING, and saying so here matters because the obvious
-- reading of the name is wrong. `roles.ts` states that there are three roles
-- and no lattice: no per-action grant, no group, no permission table, because
-- there are two powers to control and a table of them would be a system to
-- maintain rather than a rule to read. A row that opened one screen for one
-- person would be that table arriving through the back door.
--
-- So a row here is a MESSAGE WITH A SUBJECT AND AN ANSWER. The subject is the
-- screen somebody could not open. The answer is either the power itself, given
-- through the appointment that already exists and is already audited, or a
-- refusal carrying a reason. Nothing in between, because in between is the
-- lattice.
--
-- WHY A ROW RATHER THAN AN EMAIL. An email reaches whoever is an administrator
-- today, once, in one inbox, and cannot be answered where the asker will look.
-- A row is visible to all of them, survives the first reader doing nothing,
-- and its answer reaches the person who asked without a mail relay existing.
CREATE TABLE "platform"."AccessRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "answer" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequest_status_createdAt_idx" ON "platform"."AccessRequest"("status", "createdAt");
CREATE INDEX "AccessRequest_memberId_status_idx" ON "platform"."AccessRequest"("memberId", "status");

-- CASCADE, not SET NULL, and the difference from `Feedback` next door is the
-- point. A piece of feedback is about the product and outlives the account
-- that sent it. A request for access is about a person: with the account gone
-- there is nobody to grant anything to, and an open request pointing at
-- nobody is a queue item an administrator cannot act on.
ALTER TABLE "platform"."AccessRequest"
    ADD CONSTRAINT "AccessRequest_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The module roles must not gain sight of this. Reasserted rather than
-- assumed: a new table is created by the owner, and a GRANT that was never
-- written is the kind of absence nobody notices.
REVOKE ALL ON "platform"."AccessRequest" FROM PUBLIC;
