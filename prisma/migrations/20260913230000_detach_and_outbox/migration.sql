-- Deleting an account: what happens to what was published under it.
--
-- OPEN-46 resolved by François on 2026-09-13: DETACH the attributed
-- contributions. The text stays, the name goes.
--
-- DETACHED IS A THIRD STATE, NOT THE ANONYMOUS PATH. A detached review renders
-- as "deleted account" and is counted with neither the named nor the anonymous
-- set. Counting it as anonymous would inflate the number FR-C21 puts in front
-- of a contributor before they choose, so the figure people use to judge their
-- own exposure would be wrong, and section 3.3's arithmetic with it. The row
-- also stays in ReviewAttributed: moving it into ReviewAnonymous would give it
-- FR-D15's display rules, which withhold the per-review numbers it was
-- published with.
--
-- On erasure being complete. Dropping the member id is genuine anonymisation
-- under Recital 26 only because the Member row is deleted in the same
-- transaction, so there is nothing left to re-link against. What it cannot do
-- is anonymise the TEXT: a review that describes its author still describes
-- them. That is the same limit FR-C12 already states for the anonymous path,
-- and the deletion screen says it before anybody presses the button.

ALTER TABLE "ryc"."ReviewAttributed" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "ryc"."ReviewAttributed" ADD COLUMN "detachedAt" TIMESTAMP(3);

-- The one-per-course rule binds a member, and a detached row no longer has one.
-- Postgres treats NULLs as distinct in a unique index, so the existing
-- constraint already permits many detached rows. Nothing to change, recorded
-- here because it looks like an oversight otherwise.

-- FR-H5: mail is queued and sent by the worker, never inside a request.
CREATE TABLE "platform"."MailOutbox" (
  "id"        TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "locale"    TEXT NOT NULL DEFAULT 'fr',
  "payload"   JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"    TIMESTAMP(3),
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,

  CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- The worker's query is "unsent, oldest first".
CREATE INDEX "MailOutbox_sentAt_createdAt_idx"
  ON "platform"."MailOutbox"("sentAt", "createdAt");

-- No member id on this table, on purpose: it holds the address it was queued
-- for. A member deleted between queueing and sending leaves no dangling
-- reference, and the confirmation of their own deletion can still go out.
REVOKE ALL ON "platform"."MailOutbox" FROM PUBLIC;
