-- Storing the email address, and what a Member agreed to be sent.
--
-- FR-A11 to FR-A13, FR-H1, FR-H2. This reverses the domain-only reading of
-- FR-A9, which was mine and not François's. The provider sends the address on
-- every sign-in, so refusing to keep it bought no privacy and cost the product
-- every feature that has to reach a person.
--
-- TWO ADDRESS COLUMNS, ON PURPOSE (FR-A12). `providerEmail` is identity and is
-- never editable; `contactEmail` is where the member asks to be reached. One
-- editable column would let somebody edit the field their identity is matched
-- on, and either lock themselves out or take over another account.
--
-- NOT UNIQUE, either of them. Two accounts can legitimately hold the same
-- address: FR-A6 leaves registration open, and the same person signing in with
-- Google and with Microsoft on one university address is the ordinary case, not
-- an abuse. Uniqueness here would refuse the second sign-in with an error that
-- says nothing useful. Indexed rather than constrained.
--
-- Existing rows get NULL: the address was genuinely never stored, and the next
-- sign-in fills it in from the token. Backfilling would mean inventing one.

ALTER TABLE "platform"."Member" ADD COLUMN "providerEmail" TEXT;
ALTER TABLE "platform"."Member" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "platform"."Member" ADD COLUMN "contactVerifiedAt" TIMESTAMP(3);

CREATE INDEX "Member_contactEmail_idx" ON "platform"."Member"("contactEmail");

-- One row per kind, never a single "notifications" switch: that is how somebody
-- turns off the one thing they wanted in order to escape the rest.
--
-- `decidedAt` is not decoration. Article 7(1) asks a controller to demonstrate
-- consent, and a boolean with no date cannot.
CREATE TABLE "platform"."NotificationPreference" (
  "memberId"  TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT false,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("memberId", "kind")
);

ALTER TABLE "platform"."NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FR-A15: deleting an account has to actually remove what is keyed to it, so
-- the cascade above is part of the requirement rather than a convenience.
-- Anonymous contributions are NOT reached by it, because nothing joins them to
-- a member (FR-C2). That is the guarantee working, and FR-C9 says so in
-- advance, on the screen, before the contribution is made.

-- The module roles must not gain sight of any of this. Reasserted here rather
-- than assumed: a new table is created by the owner, and a GRANT that was never
-- written is the kind of absence nobody notices.
REVOKE ALL ON "platform"."NotificationPreference" FROM PUBLIC;
