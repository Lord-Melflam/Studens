-- Four more fields both universities publish and neither of us was keeping.
--
-- François, having read a ULB course page: "look at the courses page and see
-- the field we can have such as : Contenu du cours, Objectifs (et/ou acquis
-- d'apprentissages spécifiques), Méthodes d'enseignement et activités
-- d'apprentissages, Références, bibliographie et lectures recommandées, etc ...
-- Whatever can help us."
--
-- Checked against both sources before choosing the columns, because a field
-- only one of them publishes would be a column empty for half the catalogue.
-- All four are on both, under different names:
--
--   objectives       UCLouvain "Acquis d'apprentissage"
--                    ULB       "Objectifs (et/ou acquis d'apprentissages spécifiques)"
--   prerequisites    UCLouvain "Préalables"
--                    ULB       "Pré-requis et Co-requis"
--   teachingMethods  UCLouvain "Méthodes d'enseignement"
--                    ULB       "Méthodes d'enseignement et activités d'apprentissages"
--   bibliography     UCLouvain "Bibliographie"
--                    ULB       "Références, bibliographie et lectures recommandées"
--
-- FOUR COLUMNS AND NOT ONE, and not folded into `themes`. The temptation was to
-- put the objectives there, and it was refused when the ULB parser was written
-- for the same reason it is refused here: `themes` is UCLouvain's "Thèmes
-- abordés", the topics a course covers, and objectives are what a student
-- should be able to do afterwards. A column meaning two things depending on
-- which university a row came from is a column nobody can read, and nothing on
-- screen would say which one they were looking at.
--
-- Nullable, and nothing is backfilled: existing rows keep four nulls until the
-- next crawl, which is the ordinary state for a field a page does not state.
-- Adding nullable columns rewrites no data.
--
-- Json for the same reason as assessment, themes and content: these are lists
-- written in a rich text editor, three levels deep in places, and a flattened
-- list of thirty items is unreadable. Nothing queries inside them.

ALTER TABLE "ref"."CourseOffering" ADD COLUMN "objectives" JSONB;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "prerequisites" JSONB;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "teachingMethods" JSONB;
ALTER TABLE "ref"."CourseOffering" ADD COLUMN "bibliography" JSONB;
