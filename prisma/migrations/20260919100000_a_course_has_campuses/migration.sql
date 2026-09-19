-- Where a course is taught, and there can be more than one place.
--
-- `Site` has hung off `Programme` since the start, because that is how
-- UCLouvain publishes it: a programme is given at Louvain-la-Neuve, at Mons, at
-- Charleroi, and its courses go with it.
--
-- ULB publishes it the other way round. Its course pages carry
-- "Campus / Plaine", with Solbosch, Erasme, Flagey, Charleroi and Biopark
-- Gosselies beside it, while its programme pages say nothing about a site at
-- all. ULB is a multi-site university like UCLouvain, and its sites were
-- missing from the filters entirely: Erasme, Plaine, Solbosch and the rest
-- were nowhere a student could choose them.
--
-- MANY-TO-MANY, MEASURED. The first version of this was a single nullable
-- column on CourseOffering, which is what a course looks like until you run it
-- at size. On a 149-course slice ULB states "Solbosch, Flagey" on five of
-- them, and one course lists five campuses at once. Stored in one column, each
-- combination becomes its own site: a filter would have offered
-- "Flagey, Hors campus ULB, Autre campus, Plaine, Solbosch" as a place a
-- student could go. The column was dropped before it was ever merged.
--
-- Nothing is backfilled and nothing is lost. Every UCLouvain course has no row
-- here and keeps its site through its programme, which is untouched.
--
-- "Autre campus" and "Hors campus ULB" are values ULB publishes, not missing
-- ones, and they are stored as published: the same rule as UCLouvain's
-- "Autre site".

CREATE TABLE "ref"."OfferingSite" (
    "offeringId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "OfferingSite_pkey" PRIMARY KEY ("offeringId","siteId")
);

CREATE INDEX "OfferingSite_siteId_idx" ON "ref"."OfferingSite"("siteId");

ALTER TABLE "ref"."OfferingSite"
  ADD CONSTRAINT "OfferingSite_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "ref"."CourseOffering"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ref"."OfferingSite"
  ADD CONSTRAINT "OfferingSite_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "ref"."Site"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
