/**
 * Where you are in the review path.
 *
 * The indicator carries a second message beyond orientation, and it is the
 * important one: the anonymous branch shows THREE steps and the named branch
 * shows TWO. The extra step appears the moment you choose anonymity, so the
 * asymmetry that the whole design rests on is visible before you commit to it
 * rather than only felt afterwards (FR-C23).
 */
export type StepName = "form" | "fork" | "confirm";

const LABELS: Record<StepName, string> = {
  form: "Votre avis",
  fork: "Nom ou anonyme",
  confirm: "Confirmation",
};

export function Steps({ current }: { current: StepName }) {
  // The third step is not a step everyone takes, so it is not shown until it
  // is real. Showing a greyed "Confirmation" from the start would suggest both
  // branches end the same way.
  const names: StepName[] = current === "confirm" ? ["form", "fork", "confirm"] : ["form", "fork"];
  const index = names.indexOf(current);

  return (
    <ol className="steps" aria-label="Étapes">
      {names.map((name, i) => (
        <li
          key={name}
          className={i === index ? "on" : i < index ? "done" : ""}
          aria-current={i === index ? "step" : undefined}
        >
          <span className="steps-n">{i + 1}</span>
          {LABELS[name]}
        </li>
      ))}
    </ol>
  );
}
