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

/**
 * `detached` is a review whose author deleted their account (FR-A15, OPEN-46).
 *
 * A FOURTH STATE AND NOT A SECOND ANONYMOUS ONE. It keeps the per-review
 * numbers it was published with, because it was published with them, and it is
 * counted with neither the named nor the anonymous set: counting it as
 * anonymous would inflate the figure FR-C21 puts in front of a contributor
 * before they choose, so the number they use to judge their own exposure, and
 * section 3.3's arithmetic with it, would be wrong.
 */
export type Path = "named" | "anonymous" | "imported" | "detached";

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
  /** FR-A15: published under a name, whose account has since been deleted. */
  detached: number;
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

/**
 * How a name is resolved for an attributed review.
 *
 * The module does NOT look usernames up. It holds no grant on platform.Member
 * and must not: a module that can query the member table can enumerate members,
 * which is the capability FR-C keeps away from the code that stores
 * contributions. So it is handed a function by whoever composes the two, and it
 * calls that function with the ids already in its own table.
 *
 * Absent, the named path renders without a name, which is what happened before
 * usernames existed at all.
 */
export type NameResolver = (memberIds: string[]) => Promise<Map<string, string | null>>;

export async function reviewsFor(
  prisma: PrismaClient,
  courseId: string,
  opts: { names?: NameResolver } = {},
): Promise<{ reviews: PublishedReview[]; aggregate: Aggregate }> {
  const where = { courseId, status: "published" };
  const [named, anon, imported] = await Promise.all([
    prisma.reviewAttributed.findMany({ where, orderBy: { academicYear: "desc" } }),
    prisma.reviewAnonymous.findMany({ where, orderBy: { academicYear: "desc" } }),
    // `where` and not `{ courseId }`: imported reviews are filtered by status
    // like the other two. Until 2026-09-16 they were not, because the column
    // did not exist, which made them the one kind of contribution a moderator
    // could not hide.
    prisma.reviewImported.findMany({ where, orderBy: { academicYear: "desc" } }),
  ]);

  // FR-F6: the username, resolved through the caller's function rather than by
  // a query this module could make. A member with no name yet renders as an
  // unnamed member rather than as anonymous, because the two must never look
  // alike (FR-C15).
  // Only the rows that still have an author. A detached one has no member to
  // resolve, and asking for null would be asking the platform a question about
  // somebody who no longer exists.
  const stillAttached = named.map((r) => r.memberId).filter((id): id is string => id !== null);
  const names = opts.names ? await opts.names(stillAttached) : new Map();

  const reviews: PublishedReview[] = [
    ...named.map((r) => ({
      id: r.id,
      path: (r.memberId === null ? "detached" : "named") as Path,
      academicYear: r.academicYear,
      body: r.body,
      advice: r.advice,
      date: r.createdAt.toISOString().slice(0, 10),
      // A detached review carries no author at all. The interface labels it
      // as a deleted account, and it must never be labelled "Anonyme": the
      // text was published under a name people may remember, and calling it
      // anonymous would claim a protection it does not have.
      author: r.memberId === null ? null : (names.get(r.memberId) ?? "membre"),
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
      named: named.filter((r) => r.memberId !== null).length,
      anonymous: anon.length,
      detached: named.filter((r) => r.memberId === null).length,
      recommendation: mean(scored.map((r) => r.recommendation)),
      workloadVsEcts: mean(scored.map((r) => r.workloadVsEcts)),
      difficulty: mean(scored.map((r) => r.difficulty)),
      passBand: band(answered.filter((r) => r.passed === true).length, answered.length),
      passAnswers: answered.length,
    },
  };
}
