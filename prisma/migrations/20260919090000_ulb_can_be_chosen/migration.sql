-- ULB can be chosen now, because its catalogue is in.
--
-- FR-F12: every institution is LISTED and only those whose catalogue is
-- ingested can be CHOSEN, so the first run shows the whole of Belgian higher
-- education and says why most of it is not selectable yet, rather than looking
-- like a UCLouvain product with a short list.
--
-- The flag was the only thing still saying no. ULB's catalogue was loaded on
-- 2026-09-18: 286 programmes, 5,439 courses for 2026-2027, 12 faculties, and
-- `npm run catalogue:report` answers "fully served" for it.
--
-- Data and not code, which is the point of FR-F10: adding or opening an
-- institution is a row, and a migration is where rows that everyone's database
-- needs are written.

UPDATE "ref"."Institution" SET "available" = true WHERE "code" = 'ulb';
