-- Site, field of study and kind become data.
--
-- All three were pulled out of the programme TITLE on every read, by a regular
-- expression looking for a trailing parenthesis and a leading word. That works
-- until UCLouvain rewords a title, and it cannot answer "the masters taught in
-- Charleroi" because the database never sees a site at all. The field of study
-- had nowhere to live: UCLouvain publishes 24 of them and we stored none.
--
-- Sites belong to an institution. Domains do not: the French Community's decree
-- defines the vocabulary, so the same 24 appear across its universities, and a
-- copy per institution would make "every law programme in Belgium" a join
-- across duplicated rows.
--
-- Everything is nullable, and null means "not stated" and never "none". A
-- programme whose title matches no known kind keeps a null rather than being
-- filed under the nearest one.

CREATE TABLE "ref"."Site" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ref"."Domain" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Site_institutionId_code_key" ON "ref"."Site"("institutionId", "code");
CREATE UNIQUE INDEX "Domain_code_key" ON "ref"."Domain"("code");

ALTER TABLE "ref"."Site" ADD CONSTRAINT "Site_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "ref"."Institution"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ref"."Programme" ADD COLUMN "kind" TEXT;
ALTER TABLE "ref"."Programme" ADD COLUMN "credits" INTEGER;
ALTER TABLE "ref"."Programme" ADD COLUMN "siteId" TEXT;
ALTER TABLE "ref"."Programme" ADD COLUMN "domainId" TEXT;

CREATE INDEX "Programme_siteId_idx" ON "ref"."Programme"("siteId");
CREATE INDEX "Programme_domainId_idx" ON "ref"."Programme"("domainId");

ALTER TABLE "ref"."Programme" ADD CONSTRAINT "Programme_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "ref"."Site"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ref"."Programme" ADD CONSTRAINT "Programme_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "ref"."Domain"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- The module role owns its own tables (FR-B10), like every other ref table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "ref"."Site" TO studens_ref;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ref"."Domain" TO studens_ref;
