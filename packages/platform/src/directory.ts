/**
 * WHO IS REGISTERED, for an administrator who needs to know.
 *
 * WHY THIS EXISTS AT ALL, given that the roles screen deliberately refuses to
 * be one. That screen lists people who hold a power and says so: "listing
 * every account would turn a page about accountability into a directory". That
 * reasoning was right about the ROLES screen and it is not an argument against
 * a directory existing somewhere. An operator who cannot see who is in their
 * own database cannot answer a support question, cannot tell a real sign-up
 * from a test account, and cannot notice a hundred registrations in an hour.
 * So this is a separate section, and the roles screen keeps its purpose.
 *
 * THE LIST SHOWS A DOMAIN, NOT AN ADDRESS. `uclouvain.be` is already what the
 * product treats as a signal (FR-A10) and it is what an administrator is
 * usually asking about. The full address is a separate, deliberate act per
 * member, and it is written to the audit log, because the privacy statement
 * tells members their address is held to contact them: reading one is a
 * different purpose and should leave a trace rather than be a side effect of
 * scrolling.
 *
 * NFR-O4: WINDOWED IN THE QUERY. This list grows with registrations, which is
 * the one number this product wants to go up. A thousand members is a thousand
 * rows and the browser must never be sent them to filter itself, so the
 * search, the role filter and the window are all SQL.
 *
 * FR-C2 IS UNTOUCHED AND CANNOT BE REACHED FROM HERE. Nothing in this file
 * reads a contribution. An administrator learning that somebody exists, and
 * what their address is, tells them nothing about what that person published
 * anonymously: that table has no member column, so there is no query to write.
 */
import { PrismaClient, Prisma } from "@prisma/client";

export interface DirectoryEntry {
  id: string;
  username: string | null;
  role: string;
  /** The signal, not the address (FR-A10). */
  emailDomain: string;
  createdAt: Date;
  /** So the list can mark them without a second call. */
  suspended: boolean;
  /** Whether revealing an address would return anything, so the control can be absent when it would do nothing. */
  hasAddress: boolean;
}

export interface DirectoryPage {
  members: DirectoryEntry[];
  total: number;
  page: number;
  pages: number;
}

/** Rows per page. Clamped here, so no caller can ask for the whole table. */
export const DIRECTORY_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface DirectoryOptions {
  client?: PrismaClient;
  /** Matches a username or an email domain, case insensitively. */
  q?: string;
  /** A single role, or absent for every role. */
  role?: string;
  page?: number;
  perPage?: number;
}

export async function listMembers(opts: DirectoryOptions = {}): Promise<DirectoryPage> {
  const prisma = opts.client ?? new PrismaClient();
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(opts.perPage ?? DIRECTORY_PER_PAGE)));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const q = (opts.q ?? "").trim();

  const where: Prisma.MemberWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { emailDomain: { contains: q, mode: "insensitive" } },
            // An administrator asking "who is this address" should find them,
            // without the screen ever listing addresses. The value is matched
            // and not returned.
            { contactEmail: { contains: q, mode: "insensitive" } },
            { providerEmail: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where,
        // Newest first: the question an operator asks most often is who just
        // arrived. `id` breaks ties, because two members created in the same
        // millisecond would otherwise have no stable order between pages.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          username: true,
          role: true,
          emailDomain: true,
          createdAt: true,
          suspendedAt: true,
          suspendedUntil: true,
          contactEmail: true,
          providerEmail: true,
        },
      }),
      prisma.member.count({ where }),
    ]);

    const now = new Date();
    return {
      members: rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        emailDomain: r.emailDomain,
        createdAt: r.createdAt,
        suspended:
          r.suspendedAt !== null && (r.suspendedUntil === null || r.suspendedUntil > now),
        hasAddress: Boolean(r.contactEmail ?? r.providerEmail),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
    };
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}

export interface RevealedAddress {
  /** What the provider gave at sign-in. */
  providerEmail: string | null;
  /** Where the member asked to be written to, if they changed it. */
  contactEmail: string | null;
  /** FR-A13: an unconfirmed address is as likely to be a typo pointing at a stranger. */
  contactVerified: boolean;
}

/**
 * One member's address, read deliberately and recorded.
 *
 * THE AUDIT ROW IS THE POINT, not a by-product. Members are told their address
 * is kept in order to contact them; an administrator reading one is a
 * different purpose, and the difference between an acceptable one and a
 * troubling one is whether anybody could ever tell it happened. So the write
 * is in the same transaction as the read, and a caller cannot get the address
 * without it.
 */
export async function revealAddress(
  actorMemberId: string,
  targetMemberId: string,
  opts: { client?: PrismaClient } = {},
): Promise<RevealedAddress | null> {
  const prisma = opts.client ?? new PrismaClient();
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.member.findUnique({
        where: { id: targetMemberId },
        select: { providerEmail: true, contactEmail: true, contactVerifiedAt: true },
      });
      if (!row) return null;
      await tx.auditLog.create({
        data: {
          actorMemberId,
          action: "member:address-read",
          targetKind: "member",
          targetId: targetMemberId,
        },
      });
      return {
        providerEmail: row.providerEmail,
        contactEmail: row.contactEmail,
        contactVerified: row.contactVerifiedAt !== null,
      };
    });
  } finally {
    if (!opts.client) await prisma.$disconnect();
  }
}
