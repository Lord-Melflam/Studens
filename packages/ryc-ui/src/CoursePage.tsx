/**
 * FR-D3: the course page.
 *
 * Everything shown here is scraped from the catalogue, including the assessment
 * method with its weightings (FR-D19). None of it is asked of a reviewer, which
 * is why the review form will be short.
 */
import { useCallback, useEffect, useState } from "react";
import { api, type Aggregate, type CourseDetail, type PublishedReview } from "./api.js";
import { Reviews } from "./Reviews.js";
import { SubmitFlow } from "./SubmitFlow.js";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CoursePage({ course, onBack }: { course: CourseDetail; onBack: () => void }) {
  const [reviews, setReviews] = useState<{
    aggregate: Aggregate;
    reviews: PublishedReview[];
    sessionRequired: boolean;
  } | null>(null);
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api
      .reviews(course.code)
      .then((r) => {
        setReviews(r);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [course.code]);

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
          courseCode={course.code}
          onClose={() => setWriting(false)}
          onSubmitted={load}
        />
      </article>
    );
  }

  return (
    <article className="course">
      <button type="button" className="back" onClick={onBack}>
        retour
      </button>

      <h2>
        <span className="code">{course.code.toUpperCase()}</span> {course.title}
      </h2>

      <p className="ribbon">
        {course.ects} ECTS
        {course.quarter ? ` · ${course.quarter}` : ""}
        {course.language ? ` · ${course.language}` : ""}
        {` · ${course.year}-${course.year + 1}`}
      </p>

      {course.external && (
        <p className="notice">
          Ce cours est donné dans une autre institution. UCLouvain n&apos;en publie
          que la référence, donc les détails ci-dessous sont incomplets.
        </p>
      )}

      <dl>
        <Field
          label="Enseignants"
          value={course.teachers.length ? course.teachers.join(", ") : null}
        />
        <Field label="Faculté en charge" value={course.owningFaculty} />
        <Field
          label="Accessible via"
          value={course.reachedVia.length ? course.reachedVia.join(", ").toUpperCase() : null}
        />
        <Field label="Heures encadrées" value={course.contactHours} />
        <Field label="Évaluation" value={course.assessment} />
        <Field label="Thèmes abordés" value={course.themes} />
        <Field label="Contenu" value={course.content} />

        <div className="field">
          <dt>Fiche officielle</dt>
          <dd>
            {/*
              rel="noreferrer" as well as noopener: it stops UCLouvain seeing
              that the visit came from Studens. A small thing, and consistent
              with a platform whose main promise is not linking people to what
              they read.
            */}
            <a
              className="official"
              href={course.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {course.officialUrl}
            </a>
          </dd>
        </div>
      </dl>

      {failed && (
        <section className="reviews-absent">
          <h3>Avis</h3>
          <p>Les avis n&apos;ont pas pu être chargés.</p>
        </section>
      )}

      {reviews && (
        <Reviews
          aggregate={reviews.aggregate}
          reviews={reviews.reviews}
          sessionRequired={reviews.sessionRequired}
          onWrite={() => setWriting(true)}
        />
      )}
    </article>
  );
}
