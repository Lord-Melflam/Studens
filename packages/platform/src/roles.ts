/**
 * Who may do what. FR-E14, FR-E3, and the appointment half of OPEN-8.
 *
 * THE QUESTION WAS ALREADY A SECURITY ONE before it was a legal one: an
 * unanswered appointment path is a privilege escalation path. It is now also
 * legal, because a moderator is the person through whom this platform acquires
 * actual knowledge of illegality, and Article 6's liability shield turns on
 * that knowledge.
 *
 * THREE ROLES AND NO LATTICE. A member, a moderator, an administrator. There is
 * no permission system, no group, no per-action grant, because there are two
 * powers to control and a table of them would be a system to maintain rather
 * than a rule to read. When there is a third power this grows; not before.
 *
 * WHAT A MODERATOR MAY NOT DO, and it is the more important list. Never read
 * authorship. Never sanction a person on the anonymous path (FR-E7), because
 * there is nobody to sanction. Never appoint another moderator: only an
 * administrator can, so the set of people who can grow the set stays small and
 * named. A moderator who could unmask would be a second door into FR-C.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * The roles, ORDERED FROM FEWEST POWERS TO MOST, and the order is load bearing.
 *
 * It is sent to the console as it stands here, and the screen reads position to
 * tell an upgrade from a downgrade, because taking a power away asks for a
 * confirmation and giving one does not. Reordering this array silently inverts
 * that, so `test/kernel/moderation.db.test.ts` checks the order against the
 * powers themselves rather than against a copy of this list.
 *
 * A new role is inserted at its rank, not appended.
 */
export const ROLES = ["member", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Content powers: hold, release, and deciding a notice. */
export function canModerate(role: string): boolean {
  return role === "moderator" || role === "admin";
}

/**
 * Appointing and removing moderators. Administrators only.
 *
 * Deliberately not `canModerate`, and the difference is the whole point of
 * FR-E14: a moderator who can appoint a moderator is a moderator who can grow
 * the set of people holding content powers without a human deciding to.
 */
export function canAppoint(role: string): boolean {
  return role === "admin";
}

export class NotPermitted extends Error {
  constructor(readonly needed: "moderate" | "appoint") {
    super(`not permitted: ${needed}`);
    this.name = "NotPermitted";
  }
}

export class AppointmentRefused extends Error {
  constructor(
    readonly reason: "unknown-member" | "bad-role" | "self" | "last-admin" | "admin-exists",
  ) {
    super(`appointment: ${reason}`);
    this.name = "AppointmentRefused";
  }
}

/**
 * The actor on the one appointment no member made.
 *
 * `AuditLog.actorMemberId` holds a member id everywhere else. The first
 * administrator is appointed by whoever holds the server, who is not a member
 * acting in the product and may not even have an account. Writing the promoted
 * member's own id there would record that they appointed themselves, which is
 * the one thing `setRole` refuses, so the log would state something the rules
 * forbid. A value no uuid can collide with says what actually happened.
 */
export const OPERATOR = "operator:cli";

export interface Appointment {
  memberId: string;
  username: string | null;
  role: Role;
}

/**
 * Give somebody a role, or take one away.
 *
 * EVERY CHANGE IS AN AUDIT ENTRY NAMING THE ADMINISTRATOR. FR-B12 forbids a log
 * record carrying a member id beside a contribution id; this carries a member
 * id beside another member id, and it is permitted because neither is an author
 * of anything. It is the only record of how somebody came to hold the power,
 * which is what makes the appointment reviewable at all.
 */
export async function setRole(
  prisma: PrismaClient,
  actor: { memberId: string; role: string },
  targetMemberId: string,
  role: string,
  now: Date = new Date(),
): Promise<Appointment> {
  if (!canAppoint(actor.role)) throw new NotPermitted("appoint");
  if (!isRole(role)) throw new AppointmentRefused("bad-role");

  // An administrator cannot change their own role. Not paternalism: the failure
  // it prevents is the last administrator demoting themselves and leaving
  // nobody able to appoint anybody, which needs a database to undo.
  if (targetMemberId === actor.memberId) throw new AppointmentRefused("self");

  return await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { id: targetMemberId },
      select: { id: true, username: true, role: true },
    });
    if (!member) throw new AppointmentRefused("unknown-member");

    // Demoting the last administrator locks everybody out of appointing, the
    // same failure as the self check above, reached by a different route.
    if (member.role === "admin" && role !== "admin") {
      const admins = await tx.member.count({ where: { role: "admin" } });
      if (admins <= 1) throw new AppointmentRefused("last-admin");
    }

    const updated = await tx.member.update({
      where: { id: targetMemberId },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: actor.memberId,
        action: `role:${member.role}->${role}`,
        targetKind: "member",
        targetId: targetMemberId,
        at: now,
      },
    });

    return { memberId: updated.id, username: updated.username, role: updated.role as Role };
  });
}

/**
 * Appoint the first administrator. FR-E14, and the bootstrap it left open.
 *
 * WHY THIS EXISTS AT ALL. Every appointment needs an administrator to make it,
 * so the first one cannot be made in the product: an empty install has nobody
 * who can appoint anybody, and the console is unreachable forever. The gap was
 * closed by hand in SQL once, which is the worst version of this: unrecorded,
 * unrepeatable, and it invites an `UPDATE` on a table nobody should be editing
 * by hand.
 *
 * WHY IT REFUSES ONCE AN ADMINISTRATOR EXISTS. That single condition is what
 * makes it a bootstrap rather than a way around FR-E14. With one in place,
 * appointment goes back through `setRole`, where an administrator is named,
 * self demotion is refused and the last administrator cannot be removed. This
 * cannot be used to appoint a second one, to take a role away, or to escalate
 * quietly: it only fills a hole that would otherwise stay empty.
 *
 * WHO MAY RUN IT is decided outside this function, by who can reach the
 * database. That is a real limit and the reason it lives in a command rather
 * than behind a route: an HTTP endpoint that promotes somebody when no
 * administrator exists is reachable by whoever finds it first, and on a public
 * registration platform (FR-A6) that is a stranger.
 */
export async function grantFirstAdmin(
  prisma: PrismaClient,
  username: string,
  now: Date = new Date(),
): Promise<Appointment> {
  return await prisma.$transaction(async (tx) => {
    const admins = await tx.member.count({ where: { role: "admin" } });
    if (admins > 0) throw new AppointmentRefused("admin-exists");

    const member = await tx.member.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, username: true, role: true },
    });
    if (!member) throw new AppointmentRefused("unknown-member");

    const updated = await tx.member.update({
      where: { id: member.id },
      data: { role: "admin" },
      select: { id: true, username: true, role: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: OPERATOR,
        action: `role:${member.role}->admin`,
        targetKind: "member",
        targetId: member.id,
        at: now,
      },
    });

    return { memberId: updated.id, username: updated.username, role: updated.role as Role };
  });
}

/**
 * Everybody who currently holds a power, so an administrator can see the set
 * they are responsible for.
 *
 * Members are not listed: the set that matters is the small one, and rendering
 * every account would turn a page about accountability into a user directory.
 */
export async function listAppointments(prisma: PrismaClient): Promise<Appointment[]> {
  const rows = await prisma.member.findMany({
    where: { role: { in: ["moderator", "admin"] } },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, role: true },
  });
  return rows.map((r) => ({ memberId: r.id, username: r.username, role: r.role as Role }));
}

export interface AppointmentEvent {
  at: Date;
  actorMemberId: string;
  targetId: string;
  action: string;
}

/** How the current set came to be. FR-E14: recorded, and therefore readable. */
export async function appointmentHistory(
  prisma: PrismaClient,
  limit = 50,
): Promise<AppointmentEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: { targetKind: "member", action: { startsWith: "role:" } },
    orderBy: { at: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    at: r.at,
    actorMemberId: r.actorMemberId,
    targetId: r.targetId,
    action: r.action,
  }));
}

/** Used by the moderation actions, which need the same check in a transaction. */
export function requireModerator(role: string, tx?: Prisma.TransactionClient): void {
  void tx;
  if (!canModerate(role)) throw new NotPermitted("moderate");
}
