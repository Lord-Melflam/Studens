/**
 * What a review must be before either path will take it.
 *
 * Validation is shared by the two paths on purpose (FR-C6): a difference in
 * what is accepted anonymously would itself be a signal, and would announce
 * that anonymous reviews are held to a lower standard. So these rules are
 * tested once, against the shared function, and both paths call it.
 *
 * This file existed only after the fact: the submission path shipped with the
 * quota and the roles tested and its content rules covered by nothing but a
 * manual curl.
 */
import { describe, expect, it } from "vitest";
import { MAX_BODY, MIN_BODY, ReviewInvalid, validate, type ReviewInput } from "@studens/ryc";

const NOW = new Date("2026-09-10T12:00:00Z");

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return {
    courseId: "c1",
    academicYear: 2024,
    recommendation: 4,
    workloadVsEcts: 3,
    difficulty: 3,
    body: "x".repeat(MIN_BODY),
    completed: true,
    ...over,
  };
}

/** The field the server named, which is what the form needs to mark. */
function rejects(over: Partial<ReviewInput>, field: string): void {
  try {
    validate(input(over), NOW);
    throw new Error(`expected ${field} to be rejected`);
  } catch (err) {
    expect(err).toBeInstanceOf(ReviewInvalid);
    expect((err as ReviewInvalid).field).toBe(field);
  }
}

describe("a valid review passes", () => {
  it("with only the required fields", () => {
    expect(() => validate(input(), NOW)).not.toThrow();
  });

  it("with the optional ones filled in", () => {
    expect(() =>
      validate(input({ hoursPerWeek: 8, passed: false, advice: "commencez tôt" }), NOW),
    ).not.toThrow();
  });
});

describe("FR-D21: you cannot review a course you did not finish", () => {
  it("rejects a review whose author did not complete the course", () => {
    rejects({ completed: false }, "completed");
  });

  it("checks it FIRST, so the answer does not depend on the rest being right", () => {
    // Someone who did not take the course should be told that, not handed a
    // list of other problems to fix on the way to the same refusal.
    rejects({ completed: false, body: "", recommendation: 99 }, "completed");
  });
});

describe("FR-D8: the length rules, the same on both paths", () => {
  it("rejects a body below the minimum", () => {
    rejects({ body: "x".repeat(MIN_BODY - 1) }, "body");
  });

  it("accepts exactly the minimum", () => {
    expect(() => validate(input({ body: "x".repeat(MIN_BODY) }), NOW)).not.toThrow();
  });

  it("measures the TRIMMED length, so whitespace is not content", () => {
    rejects({ body: " ".repeat(200) + "trop court" }, "body");
  });

  it("rejects a body above the maximum", () => {
    rejects({ body: "x".repeat(MAX_BODY + 1) }, "body");
  });

  it("accepts exactly the maximum", () => {
    expect(() => validate(input({ body: "x".repeat(MAX_BODY) }), NOW)).not.toThrow();
  });

  it("bounds the advice too, since it is stored and displayed like the body", () => {
    rejects({ advice: "x".repeat(MAX_BODY + 1) }, "advice");
  });
});

describe("FR-D4: the year is the reviewer's, within reason", () => {
  it("accepts an old year, because alumni review courses they took years ago", () => {
    expect(() => validate(input({ academicYear: 2012 }), NOW)).not.toThrow();
  });

  it("rejects a year in the future beyond the coming one", () => {
    rejects({ academicYear: 2028 }, "academicYear");
  });

  it("accepts next year, because the catalogue already publishes it", () => {
    expect(() => validate(input({ academicYear: 2027 }), NOW)).not.toThrow();
  });

  it("rejects a non-integer year", () => {
    rejects({ academicYear: 2024.5 }, "academicYear");
  });
});

describe("FR-D5 to FR-D7: the three scales", () => {
  for (const field of ["recommendation", "workloadVsEcts", "difficulty"] as const) {
    it(`rejects ${field} below the scale`, () => rejects({ [field]: 0 }, field));
    it(`rejects ${field} above the scale`, () => rejects({ [field]: 6 }, field));
    it(`rejects ${field} between the points, since it is categorical`, () =>
      rejects({ [field]: 3.5 }, field));
  }

  it("rejects hours per week outside a plausible range", () => {
    rejects({ hoursPerWeek: 101 }, "hoursPerWeek");
    rejects({ hoursPerWeek: -1 }, "hoursPerWeek");
  });
});
