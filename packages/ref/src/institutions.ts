/**
 * The institutions a Member can say they belong to (FR-F10, FR-F12).
 *
 * It lives in the reference module, not in the platform, because it is the same
 * kind of thing as the course catalogue: facts about the outside world that the
 * platform reads and never owns. The platform stores only the code the member
 * picked, as a plain string with no foreign key, since a tier-0 service may not
 * depend on a tier-1 module.
 *
 * That costs referential integrity: a code could in principle name an
 * institution that was later removed. Accepted, because the alternative
 * (Institution in the platform schema) would put a fact about Belgian higher
 * education inside the service that holds member identity, and the row is never
 * deleted anyway, only marked unavailable.
 */
import { PrismaClient } from "@prisma/client";

export interface InstitutionSummary {
  code: string;
  name: string;
  city: string | null;
  /** FR-F11. Null where we do not know it, never approximated. */
  colour: string | null;
  /** The language community: "fr", "nl" or "de". Used for ordering, not access. */
  community: string | null;
  /**
   * FR-F12: whether this institution can be chosen yet.
   *
   * Unavailable ones are still listed. Showing every institution and letting
   * only one be picked says "this is coming"; listing UCLouvain alone
   * would imply the platform is a UCLouvain product, which it is not.
   */
  available: boolean;
}

export async function listInstitutions(
  opts: { client?: PrismaClient } = {},
): Promise<InstitutionSummary[]> {
  const prisma = opts.client ?? new PrismaClient();
  try {
    const rows = await prisma.institution.findMany({
      select: {
        code: true,
        name: true,
        city: true,
        colour: true,
        community: true,
        available: true,
      },
      // Available first, then by name. Not by community: putting the French
      // speaking ones first would be a statement about the platform that its
      // three languages contradict.
      orderBy: [{ available: "desc" }, { name: "asc" }],
    });
    return rows;
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
