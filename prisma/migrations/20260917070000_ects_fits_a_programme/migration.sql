-- Credits need five digits of precision, not four.
--
-- numeric(4,2) holds at most 99.99. The course namespace holds BUNDLE entries
-- standing for a whole programme: cours-2026-mcomu1000 is "Cours du bachelier
-- en technologies numeriques pour l'information et la communication", one entry
-- worth 180 credits.
--
-- The narrow column accepted 6,653 courses and rejected that one, which failed
-- the whole load, because a load is a single transaction. The crawl that
-- produced those rows took 78 minutes.
--
-- Sized to match the parser's ceiling of 360, a six year medicine programme.
-- Both numbers come from the measured distribution of the year rather than from
-- what a course ought to weigh: 5,885 entries are 15 credits or fewer, 142 are
-- 16 to 30, none is between 31 and 120, and exactly one is 180.
--
-- Widening a numeric column rewrites no data and loses nothing.

ALTER TABLE "ref"."CourseOffering" ALTER COLUMN "ects" TYPE numeric(5, 2);
