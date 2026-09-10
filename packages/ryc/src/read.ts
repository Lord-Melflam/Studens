/**
 * Reading reviews.
 *
 * Three rules from the requirements shape the shape of what comes back, and
 * none of them is a display concern that could be left to the frontend:
 *
 *   FR-D15  On the ANONYMOUS path a review carries its text and date only.
 *           Recommendation, workload and difficulty feed the aggregate and are
 *           not returned per review. A per-review triple plus prose is a
 *           detailed fingerprint on a record meant to be unlinkable, so the
 *           numbers do not leave the server attached to a row.
 *
 *   FR-C16  An anonymous review carries no author attribute at all. No trust
 *           tier, no email domain, no institution. There is nothing to omit in
 *           the client, because nothing is sent.
 *
 *   FR-D23  The pass rate is a coarse band above a floor, never a percentage,
 *           and never per review.
 */
import { PrismaClient } from "@prisma/client";

export type Path = "named" | "anonymous" | "imported";

export interface PublishedReview {
  id: string;
  path: Path;
  academicYear: number;
  body: string;
  advice: string | null;
  /** Day precision on the anonymous path, by column type. */
  date: string;
  /** Present on the named path only. FR-C16 forbids it on the other. */
  author: string | null;
  /** FR-D15: present on the named path only. */
  recommendation: number | null;
  workloadVsEcts: number | null;
  difficulty: number | null;
  /** FR-D17: an imported review says where it came from. */
  source: string | null;
}

export interface Aggregate {
  count: number;
  named: number;
  anonymous: number;
  recommendation: number | null;
  workloadVsEcts: number | null;
  difficulty: number | null;
  /** FR-D23: a band, above a floor of five answers. Never a percentage. */
  passBand: "la plupart ont réussi" | "résultats partagés" | "beaucoup ont échoué" | null;
  passAnswers: number;
}

/** FR-D23. Below this many answers the band is not shown at all. */
export const PASS_BAND_FLOOR = 5;

function band(passed: number, answers: number): Aggregate["passBand"] {
  if (answers < PASS_BAND_FLOOR) return null;
  const ratio = passed / answers;
  if (ratio >= 0.75) return "la plupart ont réussi";
  if (ratio >= 0.4) return "résultats partagés";
  return "beaucoup ont échoué";
}

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

export async function reviewsFor(
  prisma: PrismaClient,
  courseId: string,
): Promise<{ reviews: PublishedReview[]; aggregate: Aggregate }> {
  const where = { courseId, status: "published" };
  const [named, anon, imported] = await Promise.all([
    prisma.reviewAttributed.findMany({ where, orderBy: { academicYear: "desc" } }),
    prisma.reviewAnonymous.findMany({ where, orderBy: { academicYear: "desc" } }),
    prisma.reviewImported.findMany({ where: { courseId }, orderBy: { academicYear: "desc" } }),
  ]);

  // Member display names are not resolved here: the module holds no grant on
  // platform.Member and must not. Until FR-A exists there is no display name
  // to show, so the named path renders as a member without one.
  const reviews: PublishedReview[] = [
    ...named.map((r) => ({
      id: r.id,
      path: "named" as const,
      academicYear: r.academicYear,
      body: r.body,
      advice: r.advice,
      date: r.createdAt.toISOString().slice(0, 10),
      author: "membre",
      recommendation: r.recommendation,
      workloadVsEcts: r.workloadVsEcts,
      difficulty: r.difficulty,
      source: null,
    })),
    ...anon.map((r) => ({
      id: r.id,
      path: "anonymous" as const,
      academicYear: r.academicYear,
      body: r.body,
      advice: r.advice,
      date: r.createdAt.toISOString().slice(0, 10),
      // FR-C16 and FR-D15: nothing about the author, and no per-review numbers.
      author: null,
      recommendation: null,
      workloadVsEcts: null,
      difficulty: null,
      source: null,
    })),
    ...imported.map((r) => ({
      id: r.id,
      path: "imported" as const,
      academicYear: r.academicYear,
      body: r.body,
      advice: null,
      date: r.importedAt.toISOString().slice(0, 10),
      author: null,
      recommendation: null,
      workloadVsEcts: null,
      difficulty: null,
      source: r.source,
    })),
  ].sort((a, b) => b.academicYear - a.academicYear);

  // The aggregate uses the numbers from BOTH paths. That is the point of
  // FR-D15: the value of those numbers is the aggregate, so nothing is lost
  // by not showing them per anonymous review.
  const scored = [...named, ...anon];
  const answered = scored.filter((r) => r.passed !== null);

  return {
    reviews,
    aggregate: {
      count: scored.length,
      named: named.length,
      anonymous: anon.length,
      recommendation: mean(scored.map((r) => r.recommendation)),
      workloadVsEcts: mean(scored.map((r) => r.workloadVsEcts)),
      difficulty: mean(scored.map((r) => r.difficulty)),
      passBand: band(answered.filter((r) => r.passed === true).length, answered.length),
      passAnswers: answered.length,
    },
  };
}
