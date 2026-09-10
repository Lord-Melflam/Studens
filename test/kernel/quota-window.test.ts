/**
 * Fixed window arithmetic. Pure, so no database.
 *
 * These matter because the alternative, a rolling window, needs a timestamp
 * per submission, and that timestamp is a de facto join key against the
 * anonymous table (FR-C5). The window is the reason no such timestamp exists.
 */
import { describe, expect, it } from "vitest";
import { windowStartFor, WINDOW_DAYS, QUOTA_PER_WINDOW } from "@studens/platform";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("windowStartFor", () => {
  it("is stable across a whole window", () => {
    const start = windowStartFor(at("2026-09-10"), 7);
    for (let d = 0; d < 7; d += 1) {
      const later = new Date(start.getTime() + d * 86_400_000 + 3_600_000);
      expect(windowStartFor(later, 7).toISOString()).toBe(start.toISOString());
    }
  });

  it("moves exactly once per window length", () => {
    const start = windowStartFor(at("2026-09-10"), 7);
    const next = windowStartFor(new Date(start.getTime() + 7 * 86_400_000), 7);
    expect(next.getTime() - start.getTime()).toBe(7 * 86_400_000);
  });

  it("is midnight UTC, so the stored DATE has no time component", () => {
    const s = windowStartFor(new Date("2026-09-10T23:59:59Z"), 7);
    expect(s.getUTCHours()).toBe(0);
    expect(s.getUTCMinutes()).toBe(0);
    expect(s.getUTCSeconds()).toBe(0);
  });

  it("is aligned to the epoch, not to the member", async () => {
    // Every member's windows begin on the same day, so a boundary reveals
    // nothing about when a particular member joined or first contributed.
    const a = windowStartFor(at("2026-09-10"), 7);
    const b = windowStartFor(at("2026-09-12"), 7);
    expect(a.toISOString()).toBe(b.toISOString());
  });

  it("depends only on the date, so it needs no read before the write", () => {
    const twice = [windowStartFor(at("2026-03-01")), windowStartFor(at("2026-03-01"))];
    expect(twice[0]!.toISOString()).toBe(twice[1]!.toISOString());
  });

  it("exposes the provisional limits, which are OPEN-26", () => {
    expect(WINDOW_DAYS).toBeGreaterThan(0);
    expect(QUOTA_PER_WINDOW).toBeGreaterThan(0);
  });
});
