-- The official page does not always state the credits.
--
-- Ten courses of the 6,654 in 2026-2027 publish none: the wbcmm21021 family of
-- post-graduate clinical biology seminars, whose pages carry the word "credit"
-- nowhere. They are real courses a student takes.
--
-- The first answer here was to skip them, which loses every other field the
-- catalogue does publish about a course, thirty or so, over one it does not.
-- That is the wrong trade for a catalogue scraped from a source we do not
-- control: a field the source omits is an ordinary state to record and say
-- plainly. Null means "not stated on the official page", and the interface says
-- exactly that rather than showing a zero.
--
-- Widening a column is safe in both directions here: every existing row has a
-- value, so nothing is lost and nothing has to be backfilled.

ALTER TABLE "ref"."CourseOffering" ALTER COLUMN "ects" DROP NOT NULL;
