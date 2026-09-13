/**
 * Where you are in the review path.
 *
 * The indicator carries a second message beyond orientation, and it is the
 * important one: the anonymous branch shows THREE steps and the named branch
 * shows TWO. The extra step appears the moment you choose anonymity, so the
 * asymmetry that the whole design rests on is visible before you commit to it
 * rather than only felt afterwards (FR-C23).
 */
import { useT } from "@studens/i18n";

export type StepName = "form" | "fork" | "confirm";

export function Steps({ current }: { current: StepName }) {
  const t = useT();
  // The third step is not a step everyone takes, so it is not shown until it
  // is real. Showing a greyed "Confirmation" from the start would suggest both
  // branches end the same way.
  const names: StepName[] = current === "confirm" ? ["form", "fork", "confirm"] : ["form", "fork"];
  const index = names.indexOf(current);

  return (
    <ol className="steps" aria-label={t("ryc.steps.label")}>
      {names.map((name, i) => (
        <li
          key={name}
          className={i === index ? "on" : i < index ? "done" : ""}
          aria-current={i === index ? "step" : undefined}
        >
          <span className="steps-n">{i + 1}</span>
          {t(`ryc.steps.${name}`)}
        </li>
      ))}
    </ol>
  );
}
