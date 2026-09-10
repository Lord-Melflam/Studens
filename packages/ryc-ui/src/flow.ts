/**
 * The state machine behind the review path, as a pure function.
 *
 * It is here rather than inline in the component for one reason: the property
 * that matters is not "the screens look right", it is
 *
 *     an anonymous review can only be sent from the confirmation step.
 *
 * FR-C9 makes that write permanent and unlinkable, so it is the one transition
 * in the application that nothing can undo. As a shape spread across JSX and
 * three `onClick` handlers, that property is readable but not checkable.
 * As a function it is both, and test/ui/review-flow.test.ts checks it.
 *
 * The asymmetry is deliberate and should not be "tidied up" later: the named
 * path sends on one press, the anonymous path costs one press more, because
 * only one of the two can be taken back
 * (docs/design/frontend-design.tex 6, requirements.md FR-C9).
 */

export type Step = "form" | "fork" | "confirm" | "sent";

export type Event =
  /** The form validated locally; nothing has been sent. */
  | "draft-ready"
  | "choose-named"
  | "choose-anonymous"
  | "confirm-anonymous"
  | "back"
  /** The server accepted the submission. */
  | "accepted"
  /** The server rejected the content, so the draft goes back to the form. */
  | "rejected";

export interface Transition {
  step: Step;
  /** Set only when this transition performs the write. */
  send?: "named" | "anonymous";
}

export function next(step: Step, event: Event): Transition {
  if (event === "accepted") return { step: "sent" };
  if (event === "rejected") return { step: "form" };

  switch (step) {
    case "form":
      return event === "draft-ready" ? { step: "fork" } : { step: "form" };

    case "fork":
      if (event === "back") return { step: "form" };
      // Named sends here, in one press.
      if (event === "choose-named") return { step: "fork", send: "named" };
      // Anonymous does NOT. It moves to a screen whose only job is to say
      // what cannot be undone.
      if (event === "choose-anonymous") return { step: "confirm" };
      return { step: "fork" };

    case "confirm":
      if (event === "back") return { step: "fork" };
      if (event === "confirm-anonymous") return { step: "confirm", send: "anonymous" };
      return { step: "confirm" };

    case "sent":
      return { step: "sent" };
  }
}

export const STEPS: Step[] = ["form", "fork", "confirm", "sent"];
export const EVENTS: Event[] = [
  "draft-ready",
  "choose-named",
  "choose-anonymous",
  "confirm-anonymous",
  "back",
  "accepted",
  "rejected",
];
