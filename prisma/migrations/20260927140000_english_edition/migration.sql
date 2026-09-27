-- OPEN-47: the catalogue was French whatever language the interface was in.
--
-- UCLouvain publishes an English edition at `en-cours-<year>-<code>`. There is
-- no Dutch one: `nl-cours-...` answers 404, so a Dutch record is not obtainable
-- from this source and Dutch falls back to French for good.
--
-- WHY A SECOND SET OF COLUMNS RATHER THAN REPLACING THE FIRST. Measured on 24
-- courses, 168 field pairs, on 2026-09-27:
--
--     absent in both        72      genuinely translated   64
--     FRENCH ONLY           27      identical text          4
--     English only           1
--
-- Sixteen per cent of fields exist in French and not in English. An English
-- crawl REPLACING the French one would silently lose them, which is worse than
-- not translating at all. So both are kept and the fallback is per field, which
-- is what the two editions disagreeing about which fields exist forces.
--
-- `titleEn` is a column of its own rather than living inside the JSON, because
-- the catalogue search matches on title: a student reading the English
-- interface and typing "Project 3" has to find "Projet 3"'s course, and a
-- string inside a JSON blob is not something the existing query can match.
--
-- `textEn` holds the seven prose blocks in the same shape their French
-- counterparts already use, so nothing that reads a block needs to learn a
-- second format. Null means the English page had nothing, which is a real and
-- common state, not an error.
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "textEn" JSONB;

-- The search already matches `title`; this lets it match the English one at the
-- same cost. Partial, because most rows will have no English title and an index
-- over a mostly-null column is mostly empty pages.
CREATE INDEX "CourseOffering_titleEn_idx" ON "ref"."CourseOffering" ("titleEn")
  WHERE "titleEn" IS NOT NULL;
