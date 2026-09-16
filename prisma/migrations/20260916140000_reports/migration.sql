-- FR-E8: the notice and action mechanism.
--
-- DSA Article 16 requires every hosting provider, whatever its size, to offer a
-- way for anyone to report content they consider illegal. Article 19 exempts
-- micro-enterprises from the internal complaints system and trusted flaggers;
-- it does not exempt this. Until now Studens hosted user content with no way
-- for anybody to tell us something was wrong with it.
--
-- WHY THE REPORTER IS RECORDED, since this is the one table that deliberately
-- links a member to a contribution. It links the member who REPORTED it, never
-- the one who wrote it, and the two are unrelated: objecting to a review says
-- nothing about authoring it. FR-E12's brigading signal, many reports from
-- accounts created in the same week, cannot be seen without it. Null for anyone
-- not signed in, because FR-E8 lets anyone report.
--
-- IT LIVES IN THE PLATFORM SCHEMA and nowhere else. A module that could read
-- this could correlate reporters against the contributions it stores, which is
-- a link it has no business holding. The role grants from
-- 20260910161500_roles_and_grants cover this automatically: ALTER DEFAULT
-- PRIVILEGES grants new platform tables to studens_platform, and there is no
-- grant of platform tables to any module role anywhere. Asserted rather than
-- assumed by scripts/verify-isolation.sql.

CREATE TABLE "platform"."Report" (
  "id"               TEXT NOT NULL,
  -- Opaque to the platform, which does not know what a review is (FR-B16).
  "targetKind"       TEXT NOT NULL,
  "targetId"         TEXT NOT NULL,
  "reporterMemberId" TEXT,
  "category"         TEXT NOT NULL,
  -- Article 16(2)(a): a substantiated explanation, not just a category.
  "detail"           TEXT NOT NULL,
  -- Article 16(2)(c) and 16(4): optional, and the only way to tell somebody
  -- without an account what was decided.
  "contactEmail"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "decidedAt"        TIMESTAMP(3),
  "decidedBy"        TEXT,

  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- The queue a moderator reads: open first, oldest first. Article 6 conditions
-- the liability shield on acting expeditiously once a notice arrives, so the
-- age of the oldest open report is the number that matters.
CREATE INDEX "Report_status_createdAt_idx" ON "platform"."Report"("status", "createdAt");

-- Every report about one thing, for the count FR-E12 shows a moderator.
CREATE INDEX "Report_targetKind_targetId_idx" ON "platform"."Report"("targetKind", "targetId");

-- NO FOREIGN KEY to Member, deliberately, and this is not an oversight.
--
-- A cascade would delete somebody's reports when they delete their account
-- (FR-A15), and a notice is not theirs to withdraw: it may already have caused
-- a contribution to be held, and Article 16 asks us to be able to show what we
-- did about it. Setting it null on deletion is what should happen, and that is
-- done explicitly by the erasure handler so it is visible in code rather than
-- hidden in a constraint. The same reasoning as ryc.ReviewAttributed.memberId.

REVOKE ALL ON "platform"."Report" FROM PUBLIC;
