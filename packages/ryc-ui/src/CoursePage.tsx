/**
 * FR-D3: the course page.
 *
 * Everything shown here is scraped from the catalogue, including the assessment
 * method with its weightings (FR-D19). None of it is asked of a reviewer, which
 * is why the review form will be short.
 */
import { useCallback, useEffect, useState } from "react";
import { useT } from "@studens/i18n";
import { api, type Aggregate, type CourseDetail, type PublishedReview } from "./api.js";
import { CatalogueLanguageNote, FoldedField } from "./Prose.js";
import { Reviews } from "./Reviews.js";
import { SubmitFlow } from "./SubmitFlow.js";

/**
 * THE SLUG IN THE URL FOR EACH FOLDING FIELD, and it never changes.
 *
 * `?ouvert=evaluation,biblio`. French and short, like every other key this
 * module puts in a query string (`quad`, `entite`, `domaine`), rather than the
 * English names the storage uses: the address is read by people, and the
 * mapping lives here where both halves are visible at once.
 *
 * A slug is part of every link anybody has ever shared, so renaming one breaks
 * those links silently: the section it named simply comes back folded. Add,
 * never rename.
 */
const SECTION = {
  assessment: "evaluation",
  themes: "themes",
  content: "contenu",
  objectives: "objectifs",
  prerequisites: "prerequis",
  teachingMethods: "methodes",
  bibliography: "biblio",
} as const;

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CoursePage({
  course,
  writing,
  open,
  onToggleSection,
  reviewPage,
  onReviewPage,
  onBack,
  onWrite,
  onCloseWriting,
}: {
  course: CourseDetail;
  /** From the URL, not from state, so Back leaves the form and a link reopens it. */
  writing: boolean;
  /** Which long fields are unfolded, by slug. From the URL, for the same reason. */
  open: readonly string[];
  onToggleSection: (slug: string) => void;
  /** Which page of the reviews, from the URL like everything else on screen. */
  reviewPage: number;
  onReviewPage: (page: number) => void;
  onBack: () => void;
  onWrite: () => void;
  onCloseWriting: () => void;
}) {
  const [reviews, setReviews] = useState<{
    aggregate: Aggregate;
    reviews: PublishedReview[];
    sessionRequired: boolean;
    page: number;
    pages: number;
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const load = useCallback(() => {
    api
      .reviews(course.institution, course.code, reviewPage)
      .then((r) => {
        setReviews(r);
        setFailed(false);
      })
      .catch(() => setFailed(true));
    // Refetched when the page in the URL changes, which is what makes the
    // address the source of truth rather than a label on it.
  }, [course.institution, course.code, reviewPage]);

  useEffect(load, [load]);

  // The submission flow replaces the page rather than opening over it. It is a
  // sequence of decisions, and the last one cannot be undone; a modal that can
  // be dismissed by clicking beside it is the wrong container for that.
  if (writing) {
    return (
      <article className="course">
        <h2>
          <span className="code">{course.code.toUpperCase()}</span> {course.title}
        </h2>
        <SubmitFlow
          courseInstitution={course.institution}
          courseCode={course.code}
          onClose={onCloseWriting}
          onSubmitted={load}
        />
      </article>
    );
  }

  return (
    <article className="course">
      <button type="button" className="back" onClick={onBack}>
        {t("ryc.course.back")}
      </button>

      <h2>
        <span className="code">{course.code.toUpperCase()}</span> {course.title}
      </h2>

      <p className="ribbon">
        {/* Said plainly rather than shown as a zero. The catalogue is scraped
            from a source we do not control, and ten courses of 6,654 state no
            credits at all. */}
        {course.ects === null ? t("ryc.course.ects.unstated") : t("ryc.course.ects", { n: course.ects })}
        {course.quarter ? ` · ${course.quarter}` : ""}
        {course.language ? ` · ${course.language}` : ""}
        {` · ${course.year}-${course.year + 1}`}
      </p>

      {/* Said before any of the facts below it, because all of them are last
          year's. A course the institution stopped offering keeps its reviews,
          and hiding the page took those with it (FR-D16). */}
      {!course.offeredThisYear && (
        <p className="notice">{t("ryc.course.notOffered", {
            name: course.institution.toUpperCase(),
            year: course.year,
            next: course.year + 1,
          })}</p>
      )}

      {course.external && (
        <p className="notice">{t("ryc.course.external.note", { name: course.institution.toUpperCase() })}</p>
      )}

      <dl>
        <Field
          label={t("ryc.course.teachers")}
          value={course.teachers.length ? course.teachers.join(", ") : null}
        />
        <Field label={t("ryc.course.entity")} value={course.owningFaculty} />
        <Field
          label={t("ryc.course.reachedVia")}
          value={course.reachedVia.length ? course.reachedVia.join(", ").toUpperCase() : null}
        />
        <Field label={t("ryc.course.hours")} value={course.contactHours} />
        {/* Before the three long fields, not after: it is the answer to the
            question the first French paragraph raises, and an answer under it
            arrives too late to stop somebody deciding the page is broken.
            Only where there is something for it to be about: on a course that
            publishes none of the three, it would be describing an empty page. */}
        {(course.assessment || course.themes || course.content) && (
          <CatalogueLanguageNote institution={course.institution} />
        )}
        <FoldedField
          label={t("ryc.course.assessment")}
          blocks={course.assessment}
          open={open.includes(SECTION.assessment)}
          onToggle={() => onToggleSection(SECTION.assessment)}
        />
        <FoldedField
          label={t("ryc.course.themes")}
          blocks={course.themes}
          open={open.includes(SECTION.themes)}
          onToggle={() => onToggleSection(SECTION.themes)}
        />
        <FoldedField
          label={t("ryc.course.content")}
          blocks={course.content}
          open={open.includes(SECTION.content)}
          onToggle={() => onToggleSection(SECTION.content)}
        />
        {/*
          The order is the order a student reads in, not the order the source
          prints. What the course is about, what you should be able to do, what
          you need first, how it is taught, what to read. Assessment stays at
          the top because it is the thing FR-D19 exists for: the reviewer is
          not asked what the catalogue already publishes.
        */}
        <FoldedField
          label={t("ryc.course.objectives")}
          blocks={course.objectives}
          open={open.includes(SECTION.objectives)}
          onToggle={() => onToggleSection(SECTION.objectives)}
        />
        <FoldedField
          label={t("ryc.course.prerequisites")}
          blocks={course.prerequisites}
          open={open.includes(SECTION.prerequisites)}
          onToggle={() => onToggleSection(SECTION.prerequisites)}
        />
        <FoldedField
          label={t("ryc.course.teachingMethods")}
          blocks={course.teachingMethods}
          open={open.includes(SECTION.teachingMethods)}
          onToggle={() => onToggleSection(SECTION.teachingMethods)}
        />
        <FoldedField
          label={t("ryc.course.bibliography")}
          blocks={course.bibliography}
          open={open.includes(SECTION.bibliography)}
          onToggle={() => onToggleSection(SECTION.bibliography)}
        />

        <div className="field">
          <dt>{t("ryc.course.official")}</dt>
          <dd>
            {/*
              rel="noreferrer" as well as noopener: it stops UCLouvain seeing
              that the visit came from Studens. A small thing, and consistent
              with a platform whose main promise is not linking people to what
              they read.
            */}
            {course.officialUrl ? (
              <a
                className="official"
                href={course.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {course.officialUrl}
              </a>
            ) : (
              // Null for an institution no source here knows how to link to.
              // Saying so beats a link that goes nowhere on the one row whose
              // job is to send a reader to the source.
              <span className="meta">{t("ryc.course.noOfficialPage")}</span>
            )}
          </dd>
        </div>
      </dl>

      {failed && (
        <section className="reviews-absent">
          <h3>{t("ryc.reviews.title")}</h3>
          <p>{t("ryc.reviews.failed")}</p>
        </section>
      )}

      {reviews && (
        <Reviews
          aggregate={reviews.aggregate}
          reviews={reviews.reviews}
          page={reviews.page}
          pages={reviews.pages}
          onPage={onReviewPage}
          sessionRequired={reviews.sessionRequired}
          onWrite={onWrite}
        />
      )}
    </article>
  );
}
