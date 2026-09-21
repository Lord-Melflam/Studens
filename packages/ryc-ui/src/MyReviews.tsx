/**
 * FR-D12: everything a member published under their name, in one place, so
 * they can change it (FR-C14).
 *
 * WHAT IS NOT HERE, and could not be. Anonymous reviews. Not hidden, not
 * filtered out: unreachable. That table has no member column (FR-C20), so
 * nothing can answer "which of these is mine" for anybody, the author
 * included. The screen says so once rather than leaving somebody hunting for
 * reviews they wrote and cannot find, which is the question this page would
 * otherwise create.
 *
 * ONE FORM, NOT TWO. Editing uses `ReviewForm` with `editing`, so the length
 * rule, the scales and the completion checkbox exist in exactly one place. A
 * second form would be a second set of rules, and the first thing to drift
 * would be the one the server enforces.
 *
 * IT IS CAPPED, because this list only grows. A quota bounds how fast
 * somebody publishes, not how much they have published by their third year,
 * and an alumnus reviewing every course they took is the person this product
 * most wants. NFR-O4: anything that grows gets a strategy when it is built,
 * not when it hurts. Twenty-five here, the rest one press away, which is the
 * same shape the course list and the search results use.
 */
import { useCallback, useEffect, useState } from "react";
import { useT, useLocale } from "@studens/i18n";
import { api, type MyReview } from "./api.js";
import { ReviewForm } from "./ReviewForm.js";

/** Rows drawn before the rest are one press away, and the step it grows by. */
const SHOWN_STEP = 25;

/** Later than its publication by more than the write itself can explain. */
function wasEdited(r: MyReview): boolean {
  return new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 1000;
}

function when(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

export function MyReviews({
  onOpenCourse,
}: {
  onOpenCourse: (institution: string, code: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [reviews, setReviews] = useState<MyReview[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * How many rows are drawn. Not in the address, unlike the browse list: this
   * screen is nobody's to link to but its owner's, so there is no shared view
   * for a URL to carry, and FR-B21's reason for putting a setting in the
   * address does not apply.
   */
  const [shown, setShown] = useState(SHOWN_STEP);

  const load = useCallback(() => {
    api
      .myReviews()
      .then((r) => setReviews(r.reviews))
      .catch(() => setReviews([]));
  }, []);
  useEffect(load, [load]);

  if (reviews === null) return <p className="meta">{t("ryc.loading")}</p>;

  const open = reviews.find((r) => r.id === editing);
  if (open) {
    return (
      <section className="mine">
        <h2>{t("ryc.mine.editing", { course: open.course?.code.toUpperCase() ?? "" })}</h2>
        {problem && <p className="error">{t(`ryc.mine.err.${problem}`)}</p>}
        <ReviewForm
          editing
          courseCode={open.course?.code.toUpperCase() ?? ""}
          // Not a new contribution, so there is no quota to spend and none to
          // warn about. Passing a number here would state a limit that does
          // not apply to what this screen does.
          quotaRemaining={null}
          initial={{
            academicYear: open.academicYear,
            recommendation: open.recommendation,
            workloadVsEcts: open.workloadVsEcts,
            difficulty: open.difficulty,
            hoursPerWeek: open.hoursPerWeek ?? undefined,
            passed: open.passed ?? undefined,
            body: open.body,
            advice: open.advice ?? undefined,
            completed: true,
          }}
          onCancel={() => {
            setEditing(null);
            setProblem(null);
          }}
          onReady={(draft) => {
            setSaving(true);
            setProblem(null);
            api
              .editReview(open.id, draft)
              .then(() => {
                setEditing(null);
                load();
              })
              .catch(() => setProblem("failed"))
              .finally(() => setSaving(false));
          }}
        />
        {saving && <p className="meta">{t("ryc.mine.saving")}</p>}
      </section>
    );
  }

  return (
    <section className="mine">
      <h2>{t("ryc.mine.title")}</h2>
      {/* Said once, at the top, because somebody who published anonymously
          will come here looking for it. FR-C9 is the reason and it is not a
          gap that will be closed later. */}
      <p className="hint">{t("ryc.mine.anonymous")}</p>

      {reviews.length === 0 ? (
        <p className="empty">{t("ryc.mine.none")}</p>
      ) : (
        <ul className="mine-list">
          {reviews.slice(0, shown).map((r) => (
            <li key={r.id}>
              <div className="mine-head">
                <button
                  type="button"
                  className="linkish"
                  onClick={() =>
                    r.course && onOpenCourse(r.course.institution, r.course.code)
                  }
                >
                  <span className="code">{r.course?.code.toUpperCase() ?? "?"}</span>{" "}
                  {r.course?.title ?? ""}
                </button>
                <span className="meta">
                  {t("ryc.review.taken", { from: r.academicYear, to: r.academicYear + 1 })}
                </span>
              </div>

              <p className="mine-body">{r.body}</p>

              <p className="meta">
                {t("ryc.mine.published", { date: when(r.createdAt, locale) })}
                {/* A reader judging a course by dated feedback has to be able
                    to tell the text changed, so an edit is shown rather than
                    silent.

                    NOT AN EXACT COMPARISON. Both columns are written at
                    insert, and they are not guaranteed identical to the
                    microsecond; a row whose createdAt was set deliberately,
                    as the seeded demo reviews were, differs by years. Either
                    way an exact test marks an untouched review as edited,
                    which is a false statement about somebody's words. A
                    second of tolerance is past both. */}
                {wasEdited(r) && (
                  <> · {t("ryc.mine.edited", { date: when(r.updatedAt, locale) })}</>
                )}
                {/* A held review looks deleted from the course page, so its
                    author is told here rather than left guessing. */}
                {r.held && <> · {t("ryc.mine.held")}</>}
              </p>

              <button type="button" className="ghost" onClick={() => setEditing(r.id)}>
                {t("ryc.mine.edit")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {reviews.length > shown && (
        <button
          type="button"
          className="browse-more"
          onClick={() => setShown(shown + SHOWN_STEP)}
        >
          {t("ryc.mine.more", { n: reviews.length - shown })}
        </button>
      )}
    </section>
  );
}
