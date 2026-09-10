/**
 * The September boundary, which docs/design/catalogue-ingestion.md section 3
 * requires unit tests for. Getting this wrong produces a URL that does not
 * exist for a third of every year, and the failure looks like "UCLouvain
 * changed their site".
 */
import { describe, expect, it } from "vitest";
import { academicYearFor, candidateYears, ROLLOVER } from "@studens/ref";

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("academicYearFor", () => {
  it("the rollover is mid-September and stated once", () => {
    expect(ROLLOVER).toEqual({ month: 9, day: 15 });
  });

  it("the day before rollover still belongs to the previous academic year", () => {
    expect(academicYearFor(utc("2026-09-14"))).toBe(2025);
  });

  it("the rollover day starts the new academic year", () => {
    expect(academicYearFor(utc("2026-09-15"))).toBe(2026);
  });

  it("January belongs to the academic year that started the previous September", () => {
    expect(academicYearFor(utc("2026-01-10"))).toBe(2025);
  });

  it("December belongs to the academic year that started that September", () => {
    expect(academicYearFor(utc("2025-12-31"))).toBe(2025);
  });

  it("differs from the calendar year for most of the first half", () => {
    const jan = utc("2026-01-10");
    expect(academicYearFor(jan)).not.toBe(jan.getUTCFullYear());
  });

  it("probes the current year first, then next, then previous", () => {
    expect(candidateYears(utc("2026-09-20"))).toEqual([2026, 2027, 2025]);
  });
});
