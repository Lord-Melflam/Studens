-- The session cookie stops being the row id.
--
-- A cookie that IS the primary key means any stored snapshot of this table is a
-- set of working cookies. The threat model written for FR-C3 already assumes an
-- adversary may hold a snapshot, so the token now lives only in the browser and
-- the database keeps its SHA-256. See docs/design/authentication.md 0.2.
--
-- Existing rows cannot be migrated: their tokens were never stored anywhere, so
-- there is nothing to hash. Deleting them signs everyone out once, which is the
-- correct outcome of changing how sessions are proven. There is no production
-- deployment yet, so in practice this affects development rows only.

DELETE FROM "platform"."Session";

ALTER TABLE "platform"."Session" ADD COLUMN "tokenHash" TEXT NOT NULL;
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "platform"."Session"("tokenHash");
