/**
 * Step 1 of the review path: the content.
 *
 * Note what this form does NOT contain: any way to choose named or anonymous.
 * That choice is the next screen, on its own, because FR-C9 makes the anonymous
 * half permanent and unprovable and a radio button beside "Envoyer" invites a
 * decision of that weight to be taken without reading it (FR-C23).
 *
 * It also asks nothing the catalogue already knows. The assessment method, the
 * hours, the ECTS and the language are scraped (FR-D19), so the form is short:
 * three numbers, a year, and the prose that is the actual contribution.
 */
import { useState } from "react";
import { useT, type Translate } from "@studens/i18n";
import { MAX_BODY, MIN_BODY, type ReviewDraft } from "./api.js";
import { Steps } from "./Steps.js";

/**
 * FR-D5, FR-D6, FR-D7. The ends are named so 3 is not silently "average".
 *
 * Keys rather than sentences: the labels and both ends of every scale are
 * translated, and a scale whose ends read in one language while its question
 * reads in another is worse than either.
 */
const SCALES = [
  { key: "recommendation" as const },
  { key: "workloadVsEcts" as const },
  { key: "difficulty" as const },
];

function Scale({
  name,
  value,
  invalid,
  onChange,
}: {
  name: string;
  value: number | null;
  invalid: boolean;
  onChange: (v: number) => void;
}) {
  const t = useT();
  return (
    <fieldset className={invalid ? "scale missing" : "scale"}>
      <legend>{t(`ryc.scale.${name}.label`)}</legend>
      <div className="scale-row">
        <span className="scale-end">{t(`ryc.scale.${name}.low`)}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={value === n ? "scale-dot on" : "scale-dot"}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            {n}
          </label>
        ))}
        <span className="scale-end">{t(`ryc.scale.${name}.high`)}</span>
      </div>
    </fieldset>
  );
}

/** FR-D4: the year the reviewer TOOK the course, chosen by them, not inferred. */
function yearOptions(now = new Date()): number[] {
  const current = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const years: number[] = [];
  for (let y = current; y >= current - 9; y -= 1) years.push(y);
  return years;
}

export function ReviewForm({
  courseCode,
  quotaRemaining,
  onCancel,
  onReady,
  initial,
  editing = false,
}: {
  courseCode: string;
  /**
   * FR-C4. Shown BEFORE the form, not after a 429. Learning that you have no
   * submissions left once you have written eight hundred characters is the
   * worst possible moment to learn it.
   */
  quotaRemaining: number | null;
  onCancel: () => void;
  onReady: (draft: ReviewDraft) => void;
  /** Carried back when someone returns from the fork to change something. */
  initial?: ReviewDraft | null;
  /**
   * CHANGING A REVIEW THAT IS ALREADY PUBLISHED (FR-C14), rather than writing
   * a new one. The fields and every rule about them are identical, which is
   * why this is a flag on one form and not a second form: two forms would be
   * two places for the length rule, the scale bounds and the completion
   * checkbox to drift apart.
   *
   * What it changes is the frame around them. The step indicator counts
   * towards a choice of path that an edit does not make: the path was chosen
   * when the review was published and FR-C14 cannot move it, since converting
   * an attributed review to anonymous is refused (OPEN-22). The year is fixed
   * for the same reason the kernel fixes it: it identifies the contribution.
   */
  editing?: boolean;
}) {
  const t: Translate = useT();
  const years = yearOptions();
  const [academicYear, setAcademicYear] = useState<number>(initial?.academicYear ?? years[0]!);
  const [scores, setScores] = useState<Record<string, number | null>>({
    recommendation: initial?.recommendation ?? null,
    workloadVsEcts: initial?.workloadVsEcts ?? null,
    difficulty: initial?.difficulty ?? null,
  });
  const [hours, setHours] = useState(initial?.hoursPerWeek?.toString() ?? "");
  const [passed, setPassed] = useState<"" | "yes" | "no">(
    initial?.passed === undefined ? "" : initial.passed ? "yes" : "no",
  );
  const [body, setBody] = useState(initial?.body ?? "");
  const [advice, setAdvice] = useState(initial?.advice ?? "");
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [touched, setTouched] = useState(false);

  const trimmed = body.trim();
  const short = trimmed.length < MIN_BODY;
  const long = trimmed.length > MAX_BODY;

  const missing: string[] = [];
  if (!completed) missing.push(t("ryc.form.missing.completed"));
  for (const s of SCALES) if (scores[s.key] === null) missing.push(t(`ryc.scale.${s.key}.short`));
  if (short) missing.push(t("ryc.form.missing.body"));
  if (long) missing.push(t("ryc.form.missing.long", { max: MAX_BODY }));

  /** Something worth losing. Used to decide whether leaving needs a question. */
  const hasWork = trimmed.length > 0 || advice.trim().length > 0;

  function leave() {
    // A back link that silently throws away twenty minutes of writing is the
    // one interaction on this screen that cannot be undone either.
    if (hasWork && !window.confirm(t("ryc.form.abandon"))) return;
    onCancel();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (missing.length > 0) return;
    onReady({
      academicYear,
      recommendation: scores["recommendation"]!,
      workloadVsEcts: scores["workloadVsEcts"]!,
      difficulty: scores["difficulty"]!,
      hoursPerWeek: hours.trim() === "" ? undefined : Number(hours),
      passed: passed === "" ? undefined : passed === "yes",
      body: trimmed,
      advice: advice.trim() === "" ? undefined : advice.trim(),
      completed,
    });
  }

  const left = MIN_BODY - trimmed.length;
  const over = trimmed.length - MAX_BODY;

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      {!editing && <Steps current="form" />}
      <button type="button" className="back" onClick={leave}>
        {t("ryc.form.back")}
      </button>
      <h3>{t("ryc.form.title", { code: courseCode.toUpperCase() })}</h3>
      <p className="form-lead">{t("ryc.form.lede")}</p>

      {quotaRemaining !== null && quotaRemaining <= 2 && (
        <p className="notice" role="status">
          {t("ryc.form.quota", { count: quotaRemaining })}{" "}
          <em>{t("ryc.form.quota.note")}</em>
        </p>
      )}

      {/* FR-D21. Optional as a data point (OPEN-44) but required as a gate:
          you cannot review a course you did not finish. */}
      <label className={touched && !completed ? "check gate missing" : "check gate"}>
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />
        <span>
          {t("ryc.form.completed")}
          <em>{t("ryc.form.completed.note")}</em>
        </span>
      </label>

      <label className="picker">
        {t("ryc.form.year")}
        {/* Fixed while editing, and shown rather than hidden so the review
            still says which year it is about. The kernel refuses to move it:
            (member, course, year) is unique, so an edit that changed the year
            would meet a constraint violation the person could not act on. */}
        <select
          value={academicYear}
          disabled={editing}
          onChange={(e) => setAcademicYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}-{y + 1}
            </option>
          ))}
        </select>
      </label>

      {SCALES.map((s) => (
        <Scale
          key={s.key}
          name={s.key}
          value={scores[s.key] ?? null}
          invalid={touched && scores[s.key] === null}
          onChange={(v) => setScores((prev) => ({ ...prev, [s.key]: v }))}
        />
      ))}

      <label className="field-inline">
        {t("ryc.form.hours")}
        <input
          type="number"
          min={0}
          max={100}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder={t("ryc.form.optional")}
        />
      </label>

      {/* FR-D22 optional, FR-D23: never shown per review, only as a band above
          a floor. Saying so here is why someone answers it at all. */}
      <fieldset className="scale">
        <legend>{t("ryc.form.passed")}</legend>
        <div className="scale-row">
          {[
            { v: "yes" as const, k: "yes" },
            { v: "no" as const, k: "no" },
            { v: "" as const, k: "unsaid" },
          ].map((o) => (
            <label key={o.k} className={passed === o.v ? "scale-dot wide on" : "scale-dot wide"}>
              <input
                type="radio"
                name="passed"
                checked={passed === o.v}
                onChange={() => setPassed(o.v)}
              />
              {t(`ryc.form.passed.${o.k}`)}
            </label>
          ))}
        </div>
        <p className="hint">{t("ryc.form.passed.note")}</p>
      </fieldset>

      <label className={touched && (short || long) ? "field-block missing" : "field-block"}>
        {t("ryc.form.body")}
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={touched && (short || long)}
          placeholder={t("ryc.form.body.placeholder")}
        />
        <span className={short || long ? "counter short" : "counter"}>
          {short
            ? t("ryc.form.count.short", { count: left })
            : long
              ? t("ryc.form.count.long", { count: over })
              : t("ryc.form.count.ok", { n: trimmed.length, max: MAX_BODY })}
        </span>
      </label>

      <label className="field-block">
        {t("ryc.form.advice")}
        <textarea
          rows={3}
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          placeholder={t("ryc.form.optional")}
        />
      </label>

      {touched && missing.length > 0 && (
        <p className="error" role="alert">
          {t("ryc.form.missing", { list: missing.join(", ") })}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="primary">
          {t("ryc.form.continue")}
        </button>
        <span className="hint">{t("ryc.form.nothing.sent")}</span>
      </div>
    </form>
  );
}
