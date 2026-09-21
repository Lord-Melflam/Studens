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
 * IT IS PAGED BY THE SERVER, because this list only grows. A quota bounds how
 * fast somebody publishes, not how much they have published by their third
 * year, and an alumnus reviewing every course they took is the person this
 * product most wants (NFR-O4).
 *
 * THE FIRST VERSION CAPPED THE WRONG THING. It drew twenty-five rows and left
 * the rest behind a button, while the request still asked for every row the
 * member had and the browser still held them all. The screen looked bounded
 * and the response was not, which is the failure mode NFR-O4 is written
 * against: a cap you can see is not the same as a cap that exists. The window
 * is now the module's constant, the button fetches the next one, and nothing
 * on this path can produce a response that grows with how much somebody has
 * written.
 */
import { useCallback, useEffect, useState } from "react";
import { useT, useLocale } from "@studens/i18n";
import { api, type MyReview } from "./api.js";
import { ReviewForm } from "./ReviewForm.js";

/** Later than its publication by more than the write itself can explain. */
function wasEdited(r: MyReview): boolean {
  return new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 1000;
}

function when(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

export function MyReviews({
  onOpenCourse,
  onBack,
}: {
  onOpenCourse: (institution: string, code: string) => void;
  /** Out of the screen, the same control every other page in the module has. */
  onBack: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [reviews, setReviews] = useState<MyReview[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * How many there are in total, and which page arrived last. Both come from
   * the server: the browser cannot know how many rows it has not been sent,
   * and a count it worked out itself would be wrong the moment anything else
   * changed.
   *
   * Not in the address, unlike the browse list. This screen is nobody's to
   * link to but its owner's, so there is no shared view for a URL to carry and
   * FR-B21's reason for putting a setting in the address does not apply.
   */
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback((next: number) => {
    if (next > 1) setLoadingMore(true);
    api
      .myReviews(next)
      .then((r) => {
        // Appended rather than replaced past the first page, so pressing for
        // more keeps what is already on screen instead of scrolling somebody
        // back to the top of a list they were reading.
        setReviews((had) => (next === 1 ? r.reviews : [...(had ?? []), ...r.reviews]));
        setTotal(r.total);
        setPage(next);
      })
      .catch(() => setReviews((had) => had ?? []))
      .finally(() => setLoadingMore(false));
  }, []);
  useEffect(() => load(1), [load]);

  if (reviews === null) return <p className="meta">{t("ryc.loading")}</p>;

  const open = reviews.find((r) => r.id === editing);
  if (open) {
    return (
      <section className="mine">
        <button type="button" className="back" onClick={() => setEditing(null)}>
          {t("ryc.mine.back.list")}
        </button>
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
                // Back to the first page rather than reloading every page that
                // had been fetched. The list is ordered by the last change, so
                // the review just edited is now at the top of it: reloading
                // from the start lands the person on their own edit, and it is
                // one request instead of one per page they had opened.
                load(1);
              })
              .catch(() => setProblem("failed"))
              .finally(() => setSaving(false));
          }}
        />
        {saving && <p className="meta">{t("ryc.mine.saving")}</p>}
      </section>
    );
  }

  const remaining = total - reviews.length;

  return (
    <section className="mine">
      {/* The way out, on this screen as on every other one in the module. It
          was missing here: the only way off "Mes avis" was the shell's crumb,
          which goes up to the module list rather than back to the module. */}
      <button type="button" className="back" onClick={onBack}>
        {t("ryc.mine.back")}
      </button>
      <h2>{t("ryc.mine.title")}</h2>
      {/* Said once, at the top, because somebody who published anonymously
          will come here looking for it. FR-C9 is the reason and it is not a
          gap that will be closed later. */}
      <p className="hint">{t("ryc.mine.anonymous")}</p>

      {reviews.length === 0 ? (
        <p className="empty">{t("ryc.mine.none")}</p>
      ) : (
        <ul className="mine-list">
          {reviews.map((r) => (
            /*
              ONE CARD PER REVIEW, not rows separated by a hairline.

              These are several people's paragraphs of prose stacked on top of
              one another, and a 1px rule between them is not enough to tell
              where one ends: read at speed, the end of one review and the
              start of the next run together into a sentence neither person
              wrote. A card gives each one an edge, and a held review can carry
              its own without inventing a second layout.
            */
            <li key={r.id} className={`mine-card ${r.held ? "mine-held" : ""}`}>
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

              <p className="mine-foot meta">
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

      {remaining > 0 && (
        <button
          type="button"
          className="browse-more"
          disabled={loadingMore}
          onClick={() => load(page + 1)}
        >
          {loadingMore ? t("ryc.loading") : t("ryc.mine.more", { n: remaining })}
        </button>
      )}
    </section>
  );
}
