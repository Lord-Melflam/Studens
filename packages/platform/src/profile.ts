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
  return name;
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
    data["username"] = patch.username === null ? null : checkUsername(patch.username);
  }
  for (const key of ["locale", "institutionCode", "studies", "interests"] as const) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.yearOfStudy !== undefined) data["yearOfStudy"] = patch.yearOfStudy;
  if (patch.onboardingStep !== undefined) data["onboardingStep"] = patch.onboardingStep;
  if (patch.onboardedAt !== undefined) {
    // FR-F14: finishing sets it, and replaying the first run clears it along
    // with the progress, so anyone can redo their setup.
    data["onboardedAt"] = patch.onboardedAt ? new Date() : null;
    if (!patch.onboardedAt) data["onboardingStep"] = 0;
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
