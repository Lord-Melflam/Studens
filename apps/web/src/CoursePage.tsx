/**
 * FR-D3: the course page.
 *
 * Everything shown here is scraped from the catalogue, including the assessment
 * method with its weightings (FR-D19). None of it is asked of a reviewer, which
 * is why the review form will be short.
 */
import type { CourseDetail } from "./api.js";

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

      <section className="reviews-absent">
        <h3>Avis</h3>
        <p>
          Pas encore d&apos;avis: le module n&apos;est pas construit. Rien
          n&apos;est affiché ici plutôt qu&apos;un espace vide qui suggérerait le
          contraire.
        </p>
      </section>
    </article>
  );
}
