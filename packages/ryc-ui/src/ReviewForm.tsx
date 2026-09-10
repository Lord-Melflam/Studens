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
import { MAX_BODY, MIN_BODY, type ReviewDraft } from "./api.js";
import { Steps } from "./Steps.js";

/** FR-D5, FR-D6, FR-D7. The ends are named so 3 is not silently "average". */
const SCALES = [
  {
    key: "recommendation" as const,
    label: "Le recommanderiez-vous ?",
    low: "je déconseille",
    high: "je recommande",
  },
  {
    key: "workloadVsEcts" as const,
    label: "Charge de travail, par rapport à ses ECTS",
    low: "bien plus léger",
    high: "bien plus lourd",
  },
  {
    key: "difficulty" as const,
    label: "Difficulté",
    low: "très facile",
    high: "très difficile",
  },
];

function Scale({
  name,
  label,
  low,
  high,
  value,
  invalid,
  onChange,
}: {
  name: string;
  label: string;
  low: string;
  high: string;
  value: number | null;
  invalid: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className={invalid ? "scale missing" : "scale"}>
      <legend>{label}</legend>
      <div className="scale-row">
        <span className="scale-end">{low}</span>
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
        <span className="scale-end">{high}</span>
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
}) {
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
  if (!completed) missing.push("confirmer que vous avez terminé le cours");
  for (const s of SCALES) if (scores[s.key] === null) missing.push(s.label.toLowerCase());
  if (short) missing.push("le texte de l'avis");
  if (long) missing.push(`raccourcir le texte (${MAX_BODY} caractères maximum)`);

  /** Something worth losing. Used to decide whether leaving needs a question. */
  const hasWork = trimmed.length > 0 || advice.trim().length > 0;

  function leave() {
    // A back link that silently throws away twenty minutes of writing is the
    // one interaction on this screen that cannot be undone either.
    if (hasWork && !window.confirm("Abandonner cet avis ? Le texte sera perdu.")) return;
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
      <Steps current="form" />
      <button type="button" className="back" onClick={leave}>
        retour à la fiche
      </button>
      <h3>Votre avis sur {courseCode.toUpperCase()}</h3>
      <p className="form-lead">
        Le choix entre votre nom et l&apos;anonymat vient après, sur un écran à
        lui seul.
      </p>

      {quotaRemaining !== null && quotaRemaining <= 2 && (
        <p className="notice" role="status">
          {quotaRemaining === 1
            ? "Il vous reste un avis à publier pour cette période."
            : `Il vous reste ${quotaRemaining} avis à publier pour cette période.`}{" "}
          <em>
            La limite compte les avis, jamais lesquels: elle vaut pour les deux
            voies, sans lien entre votre compte et un avis anonyme.
          </em>
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
          J&apos;ai suivi ce cours jusqu&apos;au bout.
          <em>Sans cela, il n&apos;y a pas d&apos;avis à donner.</em>
        </span>
      </label>

      <label className="picker">
        Année où vous l&apos;avez suivi
        <select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))}>
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
          label={s.label}
          low={s.low}
          high={s.high}
          value={scores[s.key] ?? null}
          invalid={touched && scores[s.key] === null}
          onChange={(v) => setScores((prev) => ({ ...prev, [s.key]: v }))}
        />
      ))}

      <label className="field-inline">
        Heures par semaine, en dehors des séances
        <input
          type="number"
          min={0}
          max={100}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="facultatif"
        />
      </label>

      {/* FR-D22 optional, FR-D23: never shown per review, only as a band above
          a floor. Saying so here is why someone answers it at all. */}
      <fieldset className="scale">
        <legend>Avez-vous réussi ce cours ?</legend>
        <div className="scale-row">
          {[
            { v: "yes" as const, t: "oui" },
            { v: "no" as const, t: "non" },
            { v: "" as const, t: "je préfère ne pas dire" },
          ].map((o) => (
            <label key={o.t} className={passed === o.v ? "scale-dot wide on" : "scale-dot wide"}>
              <input
                type="radio"
                name="passed"
                checked={passed === o.v}
                onChange={() => setPassed(o.v)}
              />
              {o.t}
            </label>
          ))}
        </div>
        <p className="hint">
          Jamais affiché avec votre avis. Utilisé seulement pour une indication
          globale, à partir de cinq réponses.
        </p>
      </fieldset>

      <label className={touched && (short || long) ? "field-block missing" : "field-block"}>
        Votre avis
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={touched && (short || long)}
          placeholder="Comment le cours est donné, ce qui aide, ce qui manque."
        />
        <span className={short || long ? "counter short" : "counter"}>
          {short
            ? `encore ${left} caractère${left > 1 ? "s" : ""}`
            : long
              ? `${over} caractère${over > 1 ? "s" : ""} de trop`
              : `${trimmed.length} caractères, sur ${MAX_BODY} au maximum`}
        </span>
      </label>

      <label className="field-block">
        Un conseil à qui le prendra l&apos;an prochain
        <textarea
          rows={3}
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          placeholder="facultatif"
        />
      </label>

      {touched && missing.length > 0 && (
        <p className="error" role="alert">
          Il manque: {missing.join(", ")}.
        </p>
      )}

      <div className="actions">
        <button type="submit" className="primary">
          Continuer
        </button>
        <span className="hint">Rien n&apos;est envoyé à cette étape.</span>
      </div>
    </form>
  );
}
