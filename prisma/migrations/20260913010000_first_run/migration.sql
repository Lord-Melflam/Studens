-- The first run: what a Member chooses, and the institutions they choose from.
--
-- FR-F4 to FR-F14. Two halves.
--
-- There is deliberately no notification preference column. The platform stores
-- the email DOMAIN and never the address (FR-A9), so it cannot send mail to
-- anyone, and a preference for something that cannot happen is a promise.
--
-- 1. Member gains a username and its preferences. `displayName` is DROPPED
--    rather than repurposed: OPEN-36 decided the provider's own display name
--    is not kept, and removing the column makes that structural instead of a
--    habit someone could quietly reverse. Nothing read it: the OIDC callback
--    never set it and only the development identity did.
--
-- 2. Institution becomes a real list rather than a name. FR-F10 makes it data,
--    so adding one is a row.
--
-- On colours (FR-F11): only UCLouvain's are filled in, taken from the palette
-- already derived from its mark in the frontend. The others are NULL, because
-- an approximation of an institution's colour is an invented fact about that
-- institution, and this project does not ship those.
--
-- On `available` (FR-F12): true only where the catalogue is ingested, which is
-- UCLouvain alone. Namur is listed and unavailable even though it is now a
-- tenant for the external courses of OPEN-45: owning a course we mirror is a
-- different thing from being an institution a member can belong to here.

ALTER TABLE "platform"."Member" DROP COLUMN "displayName";

ALTER TABLE "platform"."Member" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "Member_username_key" ON "platform"."Member"("username");

ALTER TABLE "platform"."Member" ADD COLUMN "onboardedAt" TIMESTAMP(3);
ALTER TABLE "platform"."Member" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform"."Member" ADD COLUMN "locale" TEXT;
ALTER TABLE "platform"."Member" ADD COLUMN "institutionCode" TEXT;
-- `studies` and not `programme`: it is free text a member writes about
-- themselves, it is matched against no catalogue row, and naming it after one
-- would be the reference module's vocabulary inside the platform (FR-B16).
ALTER TABLE "platform"."Member" ADD COLUMN "studies" TEXT;
ALTER TABLE "platform"."Member" ADD COLUMN "yearOfStudy" INTEGER;
ALTER TABLE "platform"."Member" ADD COLUMN "interests" TEXT;

-- The existing row was created before institutions had codes.
ALTER TABLE "ref"."Institution" ADD COLUMN "code" TEXT;
ALTER TABLE "ref"."Institution" ADD COLUMN "city" TEXT;
ALTER TABLE "ref"."Institution" ADD COLUMN "colour" TEXT;
ALTER TABLE "ref"."Institution" ADD COLUMN "community" TEXT;
ALTER TABLE "ref"."Institution" ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ref"."Institution" SET "code" = 'uclouvain' WHERE "code" IS NULL;

ALTER TABLE "ref"."Institution" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Institution_code_key" ON "ref"."Institution"("code");

-- The eleven universities plus the German-speaking Community's institution.
-- Verified 2026-09-12 against the list of universities in Belgium. Saint-Louis
-- Brussels is absent on purpose: it merged into UCLouvain in 2023, so listing
-- it separately would be wrong. Hautes ecoles and hogescholen are numerous and
-- need the official registries, so they come as a later seed.
INSERT INTO "ref"."Institution" ("id", "code", "name", "city", "colour", "community", "available")
VALUES
  (gen_random_uuid(), 'ulb',        'Université libre de Bruxelles',  'Bruxelles',  NULL, 'fr', false),
  (gen_random_uuid(), 'uliege',     'Université de Liège',            'Liège',      NULL, 'fr', false),
  (gen_random_uuid(), 'umons',      'Université de Mons',             'Mons',       NULL, 'fr', false),
  (gen_random_uuid(), 'unamur',     'Université de Namur',            'Namur',      NULL, 'fr', false),
  (gen_random_uuid(), 'kuleuven',   'KU Leuven',                      'Leuven',     NULL, 'nl', false),
  (gen_random_uuid(), 'ugent',      'Universiteit Gent',              'Gent',       NULL, 'nl', false),
  (gen_random_uuid(), 'uantwerpen', 'Universiteit Antwerpen',         'Antwerpen',  NULL, 'nl', false),
  (gen_random_uuid(), 'vub',        'Vrije Universiteit Brussel',     'Brussel',    NULL, 'nl', false),
  (gen_random_uuid(), 'uhasselt',   'Universiteit Hasselt',           'Hasselt',    NULL, 'nl', false),
  (gen_random_uuid(), 'ahs',        'Autonome Hochschule Ostbelgien', 'Eupen',      NULL, 'de', false)
ON CONFLICT ("code") DO NOTHING;

UPDATE "ref"."Institution"
   SET "name" = 'UCLouvain',
       "city" = 'Louvain-la-Neuve',
       "colour" = '#1b4a8f',
       "community" = 'fr',
       "available" = true
 WHERE "code" = 'uclouvain';
