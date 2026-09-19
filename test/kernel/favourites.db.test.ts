/**
 * WHICH CATALOGUES A MEMBER WANTS IN FRONT OF THEM.
 *
 * The catalogue follows the university chosen on the fifth page of the first
 * run, and a control adds or removes another as an RYC favourite: a way to
 * narrow and to widen as somebody goes.
 *
 * Not the same question as `Member.institutionCode`, which is where somebody
 * studies and is a preference rather than a tenant (FR-F13). This is what they
 * want to see, and it is a set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { addInstitution, institutionsOf, removeInstitution, writeProfile } from "@studens/platform";

const prisma = new PrismaClient();
let reachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  reachable = true;
} catch {
  reachable = false;
}
if (process.env["STUDENS_REQUIRE_DB"] === "1" && !reachable) {
  throw new Error("STUDENS_REQUIRE_DB=1 and no database, so the favourites tests would be skipped");
}
const dbit = reachable ? it : it.skip;

const TENANT = "00000000-0000-0000-0000-0000000000t7";
const SUBJECT = "favourites";
let memberId = "";

beforeAll(async () => {
  if (!reachable) return;
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: "test" },
  });
  const m = await prisma.member.upsert({
    where: { provider_providerSubject: { provider: "test", providerSubject: SUBJECT } },
    update: {},
    create: {
      provider: "test",
      providerSubject: SUBJECT,
      emailDomain: "example.invalid",
      tenantId: TENANT,
    },
  });
  memberId = m.id;
  await prisma.memberInstitution.deleteMany({ where: { memberId } });
});

afterAll(async () => {
  if (reachable) await prisma.memberInstitution.deleteMany({ where: { memberId } });
  await prisma.$disconnect();
});

describe("a member's set of catalogues", () => {
  dbit("is empty until something says otherwise, which means everything", async () => {
    // An empty set is "not narrowed", not "nothing". Somebody who never said
    // which institution they belong to has not asked to be limited, and hiding
    // every course from them would be reading silence as a preference.
    expect(await institutionsOf(prisma, memberId)).toEqual([]);
  });

  dbit("starts as the institution chosen at the first run", async () => {
    // Otherwise the setup asks which university you belong to and the
    // catalogue shows you all of them: the question asked, then ignored.
    await writeProfile(prisma, memberId, { institutionCode: "uclouvain" });
    expect(await institutionsOf(prisma, memberId)).toEqual(["uclouvain"]);
  });

  dbit("keeps the old one when the answer changes", async () => {
    // Somebody moving from UCLouvain to ULB probably wants both for a while,
    // and dropping one is a decision a person makes with a button rather than
    // something a profile edit does behind their back.
    await writeProfile(prisma, memberId, { institutionCode: "ulb" });
    expect((await institutionsOf(prisma, memberId)).sort()).toEqual(["uclouvain", "ulb"]);
  });

  dbit("adds the same one twice without complaining", async () => {
    // The button is pressed by people, and a second press is not an error.
    await addInstitution(prisma, memberId, "ulb");
    await addInstitution(prisma, memberId, "ULB");
    expect((await institutionsOf(prisma, memberId)).filter((c) => c === "ulb")).toHaveLength(1);
  });

  dbit("lets the last one go, because narrowing must not be one-way", async () => {
    await removeInstitution(prisma, memberId, "uclouvain");
    await removeInstitution(prisma, memberId, "ulb");
    // Back to "everything", which is a wider view and not an empty screen.
    expect(await institutionsOf(prisma, memberId)).toEqual([]);
  });

  dbit("keeps them in the order they were added", async () => {
    await addInstitution(prisma, memberId, "ulb");
    await addInstitution(prisma, memberId, "uclouvain");
    expect(await institutionsOf(prisma, memberId)).toEqual(["ulb", "uclouvain"]);
  });
});
