-- The three long course-page fields become structured blocks.
--
-- They were scraped as flat text, which lost every list, line break and
-- heading the source page had: the parser replaced <br /> with a space across
-- the whole document to make label lookups work, and 3,988 line breaks went
-- with it. A 2,000 character list rendered as one paragraph.
--
-- The block model lives in packages/ref/src/ingestion/parse/rich.ts. Nothing
-- queries inside these columns, so jsonb is free here.
--
-- The old text is DISCARDED rather than converted. It is derived data: one
-- `npm run ingest` and one `npm run db:load` rebuild it from the page cache in
-- seconds, and a converted value would be the flattened text wrapped in a
-- block, which is the very thing being fixed.

ALTER TABLE "ref"."CourseOffering" DROP COLUMN "assessment";
ALTER TABLE "ref"."CourseOffering" DROP COLUMN "themes";
ALTER TABLE "ref"."CourseOffering" DROP COLUMN "content";

ALTER TABLE "ref"."CourseOffering" ADD COLUMN "assessment" JSONB;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "themes" JSONB;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "content" JSONB;
