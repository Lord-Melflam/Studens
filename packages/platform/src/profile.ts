/**
 * A Member's own record: the username, and the preferences.
 *
 * FR-F6: only the username is required. Everything else is optional and can be
 * emptied again, because a first run that cannot be escaped is a first run
 * people lie to.
 *
 * FR-F7: none of this renders on any contribution, attributed or anonymous.
 * That is not enforced here, it is enforced by `read.ts` in the module never
 * asking for it, and the module cannot ask: `studens_ryc` holds no grant on
 * platform.Member at all.
 */
import { PrismaClient } from "@prisma/client";
import { TEXT_LIMITS, checkFreeText } from "./text.js";

/**
 * What a username may be.
 *
 * Lowercase letters, digits, and single separators inside. No leading or
 * trailing separator, nothing that looks like an email address or a URL, and a
 * floor of three characters so one letter cannot be squatted.
 *
 * The rule is deliberately narrow rather than clever: a username is displayed
 * beside someone's opinion of a named lecturer, and the fewer shapes it can
 * take, the fewer ways it can be made to read as something it is not.
 */
export const USERNAME_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/** Names nobody may take, because they would read as the platform speaking. */
const RESERVED = new Set([
  "studens",
  "admin",
  "administrateur",
  "moderateur",
  "moderator",
  "support",
  "anonyme",
  "anonymous",
  "membre",
  "member",
  "equipe",
  "team",
  "officiel",
  "official",
]);

export class UsernameInvalid extends Error {
  constructor(readonly reason: "short" | "long" | "shape" | "reserved" | "taken") {
    super(`username: ${reason}`);
    this.name = "UsernameInvalid";
  }
}

export function checkUsername(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (name.length < USERNAME_MIN) throw new UsernameInvalid("short");
  if (name.length > USERNAME_MAX) throw new UsernameInvalid("long");
  if (!USERNAME_RE.test(name)) throw new UsernameInvalid("shape");
  if (RESERVED.has(name)) throw new UsernameInvalid("reserved");
  // The reserved list applies to what a reader sees, or `m.o.d.e.r.a.t.o.r`
  // would walk straight past it.
  if (RESERVED.has(usernameKeyFor(name))) throw new UsernameInvalid("reserved");
  return name;
}

/**
 * What decides whether a name is free: the name with its separators removed.
 *
 * `lou.martin`, `lou-martin`, `lou_martin` and `loumartin` are one name to a
 * reader and were four accounts to the database. A username is displayed beside
 * somebody's opinion of a named lecturer, so the uniqueness that matters is of
 * what is read, not of what is stored. Case needs nothing here, since the name
 * is lowercased before it ever reaches this.
 *
 * Separators only. Folding `1` into `l` and `0` into `o` would catch more
 * impersonation and would also refuse legitimate names containing a digit, so
 * that risk is left standing and stated rather than half-solved.
 */
export function usernameKeyFor(name: string): string {
  return name.replace(/[._-]/g, "");
}

export interface Profile {
  username: string | null;
  locale: string | null;
  institutionCode: string | null;
  studies: string | null;
  yearOfStudy: number | null;
  interests: string | null;
  onboardedAt: Date | null;
  onboardingStep: number;
}

export type ProfilePatch = Partial<Omit<Profile, "onboardedAt">> & { onboardedAt?: boolean };

export async function readProfile(
  prisma: PrismaClient,
  memberId: string,
): Promise<Profile | null> {
  return await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      username: true,
      locale: true,
      institutionCode: true,
      studies: true,
      yearOfStudy: true,
      interests: true,
      onboardedAt: true,
      onboardingStep: true,
    },
  });
}

/**
 * Write what was given and nothing else.
 *
 * A field absent from the patch is left alone; a field present and null is
 * cleared. That distinction is what lets the first run save one step at a time
 * (FR-F5) and lets the profile screen empty a field someone regrets giving.
 */
export async function writeProfile(
  prisma: PrismaClient,
  memberId: string,
  patch: ProfilePatch,
): Promise<Profile> {
  const data: Record<string, unknown> = {};

  if (patch.username !== undefined) {
    // Written together, always. The key is the column with the constraint that
    // matters, so a path that set one without the other would be a path that
    // skips the check.
    const name = patch.username === null ? null : checkUsername(patch.username);
    data["username"] = name;
    data["usernameKey"] = name === null ? null : usernameKeyFor(name);
  }
  for (const key of ["locale", "institutionCode"] as const) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  // The free text fields go through the rules, here rather than only in the
  // route, so nothing reaches the column unchecked whatever calls this.
  for (const key of ["studies", "interests"] as const) {
    if (patch[key] === undefined) continue;
    const value = patch[key];
    data[key] = value === null ? null : checkFreeText(value, TEXT_LIMITS[key]);
  }
  if (patch.yearOfStudy !== undefined) data["yearOfStudy"] = patch.yearOfStudy;
  if (patch.onboardingStep !== undefined) data["onboardingStep"] = patch.onboardingStep;
  if (patch.onboardedAt !== undefined) {
    // FR-F14: finishing sets it, and replaying the first run clears it along
    // with the progress, so anyone can redo their setup.
    data["onboardedAt"] = patch.onboardedAt ? new Date() : null;
    if (!patch.onboardedAt) data["onboardingStep"] = 0;
  }

  /**
   * Choosing your institution also makes it the first catalogue you see.
   *
   * Otherwise the first run asks which university you belong to and RYC shows
   * you all of them, which is the question being asked and then ignored.
   *
   * ADDED, NEVER REMOVED. Changing the answer later does not drop the old one:
   * somebody who moves from UCLouvain to ULB probably wants both for a while,
   * and taking one away is the kind of decision a person makes with a button,
   * not something a profile edit does behind their back.
   */
  if (typeof patch.institutionCode === "string" && patch.institutionCode.trim() !== "") {
    await addInstitution(prisma, memberId, patch.institutionCode);
  }

  try {
    return await prisma.member.update({
      where: { id: memberId },
      data,
      select: {
        username: true,
        locale: true,
        institutionCode: true,
        studies: true,
        yearOfStudy: true,
        interests: true,
        onboardedAt: true,
        onboardingStep: true,
      },
    });
  } catch (err) {
    // The unique index is what actually decides, not a prior lookup: two people
    // choosing the same name in the same second would both pass a check-then-write.
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new UsernameInvalid("taken");
    }
    throw err;
  }
}

/**
 * The usernames behind a set of member ids.
 *
 * Exists so a feature module can SHOW a name without being able to LOOK ONE UP.
 * `studens_ryc` holds no grant on `platform.Member` and never will, so the
 * module asks for this through a function the platform hands it, and the query
 * runs under the platform's own role. The alternative, a grant on one column,
 * would make the module able to enumerate members, which is exactly the
 * capability FR-C keeps away from the code that stores contributions.
 *
 * Attributed contributions only. Nothing anonymous has a member id to pass in
 * (FR-C2), so this cannot be aimed at one.
 */
export async function usernamesFor(
  prisma: PrismaClient,
  memberIds: readonly string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return new Map();
  const rows = await prisma.member.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true },
  });
  return new Map(rows.map((r) => [r.id, r.username]));
}

/**
 * WHICH CATALOGUES A MEMBER WANTS IN FRONT OF THEM.
 *
 * Not the same question as `institutionCode`, which is where they study. This
 * is what they want to see, it is a set, and it starts as the one they chose so
 * that nobody is asked something they already answered.
 *
 * An EMPTY set means "everything", not "nothing". Somebody who never said which
 * institution they belong to has not asked to be narrowed, and hiding every
 * course from them would be reading silence as a preference.
 */
export async function institutionsOf(prisma: PrismaClient, memberId: string): Promise<string[]> {
  const rows = await prisma.memberInstitution.findMany({
    where: { memberId },
    select: { institutionCode: true },
    orderBy: { addedAt: "asc" },
  });
  return rows.map((r) => r.institutionCode);
}

/**
 * Add one. Idempotent, because the button that calls it is pressed by people
 * and a second press should not be an error.
 */
export async function addInstitution(
  prisma: PrismaClient,
  memberId: string,
  institutionCode: string,
): Promise<string[]> {
  const code = institutionCode.trim().toLowerCase();
  if (code === "") throw new Error("an institution code cannot be empty");
  await prisma.memberInstitution.upsert({
    where: { memberId_institutionCode: { memberId, institutionCode: code } },
    update: {},
    create: { memberId, institutionCode: code },
  });
  return institutionsOf(prisma, memberId);
}

/**
 * Remove one. Removing the last is allowed: an empty set means "everything",
 * which is a wider view rather than an empty screen, and refusing would make
 * the narrowing one-way.
 */
export async function removeInstitution(
  prisma: PrismaClient,
  memberId: string,
  institutionCode: string,
): Promise<string[]> {
  await prisma.memberInstitution.deleteMany({
    where: { memberId, institutionCode: institutionCode.trim().toLowerCase() },
  });
  return institutionsOf(prisma, memberId);
}
