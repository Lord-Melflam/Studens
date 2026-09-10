/**
 * The one transition in the application that cannot be undone.
 *
 * An anonymous review carries no member id, so once it is written nobody can
 * find it again on the author's behalf, including an administrator with the
 * database open (FR-C9, requirements.md 3.3). The interface answers that with
 * an extra screen, and this file is what stops that screen being removed as
 * "one click too many" by someone who does not know why it is there.
 *
 * These are properties of the whole machine, checked over every step and every
 * event rather than along the two paths a person happens to take.
 */
import { describe, expect, it } from "vitest";
import { EVENTS, next, STEPS, type Step } from "@studens/ryc-ui";

describe("the anonymous write is reachable from exactly one place", () => {
  it("no step other than the confirmation can send anonymously", () => {
    for (const step of STEPS) {
      for (const event of EVENTS) {
        const t = next(step, event);
        if (t.send === "anonymous") {
          expect(
            step,
            `${step} + ${event} sends an anonymous review. Only the confirmation ` +
              `step may: FR-C9 makes that write permanent and unlinkable, so it ` +
              `needs a screen whose only job is to say so.`,
          ).toBe("confirm");
        }
      }
    }
  });

  it("choosing anonymous at the fork does not send, it asks", () => {
    const t = next("fork", "choose-anonymous");
    expect(t.step).toBe("confirm");
    expect(t.send, "the fork must not be the last screen on this branch").toBeUndefined();
  });

  it("exactly one event sends anonymously", () => {
    const senders = EVENTS.filter((e) => next("confirm", e).send === "anonymous");
    expect(senders).toEqual(["confirm-anonymous"]);
  });
});

describe("the two branches are deliberately asymmetric", () => {
  it("the named branch sends in one press", () => {
    expect(next("fork", "choose-named").send).toBe("named");
  });

  it("the anonymous branch takes two", () => {
    const first = next("fork", "choose-anonymous");
    expect(first.send).toBeUndefined();
    expect(next(first.step, "confirm-anonymous").send).toBe("anonymous");
  });

  it("the named branch has no confirmation step to reach", () => {
    // If a "confirm named" ever appears, the asymmetry that makes the extra
    // screen mean something has gone, and this test should be the argument
    // against it rather than a line in a document.
    expect(EVENTS.some((e) => next("fork", e).step === "confirm" && e !== "choose-anonymous")).toBe(
      false,
    );
  });
});

describe("nothing is sent by accident", () => {
  it("going back never sends", () => {
    for (const step of STEPS) expect(next(step, "back").send).toBeUndefined();
  });

  it("back from the confirmation returns to the fork, with the choice still open", () => {
    expect(next("confirm", "back").step).toBe("fork");
  });

  it("a rejected submission returns to the form, not to a sent state", () => {
    for (const step of STEPS) expect(next(step, "rejected").step).toBe("form");
  });

  it("the sent state is terminal", () => {
    for (const event of EVENTS) {
      if (event === "rejected") continue; // cannot follow an acceptance
      const t = next("sent", event);
      expect(t.step).toBe("sent");
      expect(t.send, "a second press must not write a second review").toBeUndefined();
    }
  });

  it("the form itself can send nothing at all", () => {
    // The form has no path control on it, so it cannot submit. This is the
    // machine's version of that: whatever happens on the form screen, the
    // furthest it reaches is the fork.
    const reachable = new Set<Step>(EVENTS.map((e) => next("form", e).step));
    expect(reachable.has("confirm")).toBe(false);
    for (const event of EVENTS) expect(next("form", event).send).toBeUndefined();
  });
});
