-- One person, one name as a reader sees it.
--
-- `username` was unique, so `lou.martin` and `lou-martin` and `loumartin`
-- were three different accounts that read as the same person, next to
-- opinions about named lecturers. The key is the name with its separators
-- removed, and it is what decides whether a name is free.
--
-- The unique index below FAILS LOUDLY if two existing accounts collide under
-- the new rule. That is deliberate: silently renaming somebody, or silently
-- keeping both, are both worse than a migration that stops and asks.

ALTER TABLE "platform"."Member" ADD COLUMN "usernameKey" TEXT;

UPDATE "platform"."Member"
SET "usernameKey" = replace(replace(replace(username, '.', ''), '-', ''), '_', '')
WHERE username IS NOT NULL;

CREATE UNIQUE INDEX "Member_usernameKey_key" ON "platform"."Member"("usernameKey");
