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

/**
 * How many reviews a page of them holds.
 *
 * A CONSTANT, NOT A SETTING. It was proposed as something an administrator
 * could tune per installation, and that is a knob with no user: nobody would
 * ever change it, it would become a second source of truth for a number the
 * product should simply decide, and every screen would have to handle the case
 * where it is absurd. If ten turns out to be wrong, this line changes. What
 * would change the answer: evidence that different courses genuinely need
 * different sizes, which nothing today suggests.
 */
export const REVIEWS_PER_PAGE = 10;

/**
 * READING REVIEWS IS PAGED, AND THE AGGREGATE IS NOT.
 *
 * The two have to be separated or the numbers lie. `count`, the averages and
 * the named and anonymous tallies are computed over EVERY published review,
 * whatever page is being read, and they are counted by the database rather
 * than by summing the rows that happen to have been fetched. That is not a
 * performance point. FR-C21 puts the named and anonymous counts in front of a
 * contributor so they can judge their own exposure before choosing a path, and
 * a count that silently meant "on page 2" would be wrong in the one place
 * being wrong matters most. 3.3's arithmetic rests on the same figures.
 *
 * THE ROWS COME FROM THREE TABLES AND ARE MERGED HERE. That is the cost of
 * FR-C2's structural separation: there is no single table to run LIMIT against.
 * Each table is asked for at most `page * perPage` rows, which bounds the work
 * without a raw UNION query against the two contribution tables. At ten a page
 * and a few hundred reviews this is a few hundred rows at worst. What would
 * change it: a course with thousands of reviews, where a `UNION ALL` ordered
 * in SQL would be worth the raw query and the review that a raw query touching
 * these two tables deserves.
 *
 * THE ORDER MUST BE TOTAL, or the same review appears on two pages or on none.
 * Academic year is not: nor is year plus date, because `ReviewAnonymous.
 * createdAt` is a DATE and not a timestamp, deliberately, so that it cannot
 * serve as a join key against the quota counter (FR-C5). Every anonymous
 * review submitted on one day therefore ties.
 *
 * The id breaks it. For an anonymous review that is a random uuid and nothing
 * else, chosen so that it publishes no insertion order (FR-C18), which is
 * exactly what makes it safe to sort by here: it is a stable arbitrary key
 * that says nothing about when the row was written.
 *
 * The merge below sorts by the SAME three keys. If it did not, the rows a page
 * slices out would not be the rows the database ordered.
 */
export async function reviewsFor(
  prisma: PrismaClient,
  courseId: string,
  opts: { names?: NameResolver; page?: number; perPage?: number } = {},
): Promise<{
  reviews: PublishedReview[];
  aggregate: Aggregate;
  page: number;
  pages: number;
  total: number;
}> {
  const where = { courseId, status: "published" };
  const perPage = Math.max(1, opts.perPage ?? REVIEWS_PER_PAGE);
  // Clamped below, once the total is known: a page number out of range must
  // land on a real page rather than on an empty screen, because it arrives
  // from a URL somebody may have edited or kept after reviews were removed.
  const asked = Math.max(1, Math.floor(opts.page ?? 1));
  const take = asked * perPage;
  const by = [
    { academicYear: "desc" as const },
    { createdAt: "desc" as const },
    { id: "asc" as const },
  ];
  const [named, anon, imported] = await Promise.all([
    prisma.reviewAttributed.findMany({ where, orderBy: by, take }),
    prisma.reviewAnonymous.findMany({ where, orderBy: by, take }),
    // `where` and not `{ courseId }`: imported reviews are filtered by status
    // like the other two. Until 2026-09-16 they were not, because the column
    // did not exist, which made them the one kind of contribution a moderator
    // could not hide.
    prisma.reviewImported.findMany({
      where,
      orderBy: [{ academicYear: "desc" }, { importedAt: "desc" }, { id: "asc" }],
      take,
    }),
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
  ].sort(
    (a, b) =>
      b.academicYear - a.academicYear ||
      (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  // The aggregate uses the numbers from BOTH paths. That is the point of
  // FR-D15: the value of those numbers is the aggregate, so nothing is lost
  // by not showing them per anonymous review.
  //
  // COUNTED BY THE DATABASE, OVER EVERY PUBLISHED REVIEW. It used to be summed
  // from the arrays above, which was the same thing while those arrays held
  // everything and would have quietly become "on this page" the moment paging
  // arrived. See the note on this function.
  const [aggNamed, aggAnon, namedTotal, anonTotal, detachedTotal, importedTotal,
         passedYes, passedAnswered] = await Promise.all([
    prisma.reviewAttributed.aggregate({
      where,
      _count: { _all: true },
      _avg: { recommendation: true, workloadVsEcts: true, difficulty: true },
    }),
    prisma.reviewAnonymous.aggregate({
      where,
      _count: { _all: true },
      _avg: { recommendation: true, workloadVsEcts: true, difficulty: true },
    }),
    prisma.reviewAttributed.count({ where: { ...where, NOT: { memberId: null } } }),
    prisma.reviewAnonymous.count({ where }),
    prisma.reviewAttributed.count({ where: { ...where, memberId: null } }),
    prisma.reviewImported.count({ where }),
    Promise.all([
      prisma.reviewAttributed.count({ where: { ...where, passed: true } }),
      prisma.reviewAnonymous.count({ where: { ...where, passed: true } }),
    ]).then(([a, b]) => a + b),
    Promise.all([
      prisma.reviewAttributed.count({ where: { ...where, NOT: { passed: null } } }),
      prisma.reviewAnonymous.count({ where: { ...where, NOT: { passed: null } } }),
    ]).then(([a, b]) => a + b),
  ]);

  const scoredCount = aggNamed._count._all + aggAnon._count._all;
  /**
   * A mean of the two paths' means, each weighted by how many rows it came
   * from. Averaging the two averages unweighted would give one anonymous
   * review the same pull as forty named ones.
   */
  const pooled = (key: "recommendation" | "workloadVsEcts" | "difficulty"): number | null => {
    let sum = 0;
    let n = 0;
    for (const a of [aggNamed, aggAnon]) {
      const avg = a._avg[key];
      if (avg === null || a._count._all === 0) continue;
      sum += avg * a._count._all;
      n += a._count._all;
    }
    return n === 0 ? null : Math.round((sum / n) * 10) / 10;
  };

  // Every published review of this course, of any kind. `total` drives the
  // pager; `count` stays what it has always been, the number carrying a score.
  const total = scoredCount + importedTotal;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(asked, pages);
  const start = (page - 1) * perPage;

  return {
    reviews: reviews.slice(start, start + perPage),
    page,
    pages,
    total,
    aggregate: {
      count: scoredCount,
      named: namedTotal,
      anonymous: anonTotal,
      detached: detachedTotal,
      recommendation: pooled("recommendation"),
      workloadVsEcts: pooled("workloadVsEcts"),
      difficulty: pooled("difficulty"),
      passBand: band(passedYes, passedAnswered),
      passAnswers: passedAnswered,
    },
  };
}
