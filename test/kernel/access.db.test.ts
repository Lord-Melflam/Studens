/**
 * FR-E21: asking an administrator for something out of reach.
 *
 * THE TEST THAT MATTERS MOST IS THE ONE ABOUT WHAT THIS DOES NOT DO. The name
 * "access request" invites a permission table, and `roles.ts` states the rule
 * this was built under: three roles and no lattice, no per-action grant,
 * because there are two powers to control and a table of them would be a
 * system to maintain rather than a rule to read.
 *
 * So the kernel here stores questions and answers and cannot change anybody's
 * role. Granting means appointing, which happens in the route where the two
 * halves meet, through the function that already does it and already audits.
 * If a future change gives this file the power to grant, the last test in it
 * fails, which is the point of writing it down.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  AccessRefused,
  REASON_MIN,
  askForAccess,
  decideAccess,
  listAccessRequests,
} from "@studens/platform";

const prisma = new PrismaClient();
let reachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  reachable = true;
} catch {
  reachable = false;
}

if (process.env["STUDENS_REQUIRE_DB"] === "1" && !reachable) {
  throw new Error(
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the access " +
      "request tests would have been skipped. They cover the one path that " +
      "could quietly become a permission system.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "ztst-access";
const TENANT = "00000000-0000-0000-0000-0000000000a1";
const SECTIONS = ["roles", "reglages"] as const;

let asker = "";
let admin = "";

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({ where: { provider: PROVIDER }, select: { id: true } });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.accessRequest.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorMemberId: { in: ids } } });
  }
  await prisma.member.deleteMany({ where: { provider: PROVIDER } });
}

beforeEach(async () => {
  if (!reachable) return;
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: "test" },
  });
  await clean();
  const a = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: "asker",
      emailDomain: "example.invalid",
      username: "ztst.access.asker",
      role: "moderator",
      tenantId: TENANT,
    },
  });
  const b = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: "admin",
      emailDomain: "example.invalid",
      username: "ztst.access.admin",
      role: "admin",
      tenantId: TENANT,
    },
  });
  asker = a.id;
  admin = b.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const WHY = "I read the reports at weekends and I keep needing this screen.";

describe("somebody asks", () => {
  dbit("records the question, the screen and who asked", async () => {
    const row = await askForAccess(asker, "reglages", WHY, {
      client: prisma,
      sections: SECTIONS,
    });
    expect(row.section).toBe("reglages");
    expect(row.status).toBe("open");
    expect(row.username).toBe("ztst.access.asker");
  });

  dbit("refuses a reason too thin to decide on", async () => {
    // "please" is not a request anybody can answer, and an administrator
    // deciding on nothing decides on who asked.
    await expect(
      askForAccess(asker, "roles", "please", { client: prisma, sections: SECTIONS }),
    ).rejects.toBeInstanceOf(AccessRefused);
    expect(WHY.length).toBeGreaterThan(REASON_MIN);
  });

  dbit("refuses a screen that is not on the list the caller passed", async () => {
    // The sections are the console's vocabulary, handed in at the boundary.
    // The platform never learns what a section is.
    await expect(
      askForAccess(asker, "signalements", WHY, { client: prisma, sections: SECTIONS }),
    ).rejects.toBeInstanceOf(AccessRefused);
  });

  dbit("refuses a second open request for the same screen", async () => {
    await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    await expect(
      askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS }),
    ).rejects.toBeInstanceOf(AccessRefused);
    // A different screen is a different question.
    await expect(
      askForAccess(asker, "reglages", WHY, { client: prisma, sections: SECTIONS }),
    ).resolves.toBeTruthy();
  });

  dbit("lets them ask again once it has been answered", async () => {
    const first = await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    await decideAccess(first.id, "declined", admin, "Not yet, ask me in a month.", {
      client: prisma,
    });
    // A refusal is not permanent: circumstances change.
    await expect(
      askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS }),
    ).resolves.toBeTruthy();
  });
});

describe("an administrator answers", () => {
  dbit("requires a reason on a refusal and not on a grant", async () => {
    const one = await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    // A "no" with nothing attached is the worst version of this feature: the
    // asker learns only that somebody saw it.
    await expect(decideAccess(one.id, "declined", admin, "", { client: prisma })).rejects.toBeInstanceOf(
      AccessRefused,
    );
    // Granting needs no words, because the power arriving says it.
    await expect(decideAccess(one.id, "granted", admin, null, { client: prisma })).resolves
      .toBeUndefined();
  });

  dbit("writes the audit row in the same transaction as the answer", async () => {
    const one = await askForAccess(asker, "reglages", WHY, { client: prisma, sections: SECTIONS });
    await decideAccess(one.id, "declined", admin, "The quota is mine to set.", { client: prisma });
    const logged = await prisma.auditLog.findFirst({
      where: { actorMemberId: admin, action: { startsWith: "access:" } },
    });
    expect(logged?.action).toBe("access:declined:reglages");
    expect(logged?.targetId, "the record names who asked, not who answered").toBe(asker);
  });

  dbit("refuses to answer the same question twice", async () => {
    const one = await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    await decideAccess(one.id, "granted", admin, null, { client: prisma });
    await expect(
      decideAccess(one.id, "declined", admin, "changed my mind", { client: prisma }),
    ).rejects.toBeInstanceOf(AccessRefused);
  });

  dbit("shows the asker their own and the administrator everybody's", async () => {
    await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    const theirs = await listAccessRequests({ client: prisma, memberId: asker });
    expect(theirs.every((r) => r.memberId === asker)).toBe(true);
    const all = await listAccessRequests({ client: prisma });
    expect(all.length).toBeGreaterThanOrEqual(theirs.length);
  });
});

describe("what this deliberately cannot do", () => {
  /**
   * THE LATTICE TEST. If a change ever gives this kernel the power to grant,
   * this fails, and it should: granting means appointing, and appointing lives
   * in `roles.ts` where it is one function, audited, and reachable only by an
   * administrator. A request row that carried a power would be a per-action
   * permission table arriving through the back door.
   */
  dbit("never changes anybody's role, whatever the answer", async () => {
    const before = await prisma.member.findUnique({ where: { id: asker }, select: { role: true } });
    const one = await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    await decideAccess(one.id, "granted", admin, null, { client: prisma });
    const after = await prisma.member.findUnique({ where: { id: asker }, select: { role: true } });
    expect(after?.role, "granting is appointing, and appointing is not here").toBe(before?.role);
  });

  dbit("carries no column that could hold a per-screen power", async () => {
    const one = await askForAccess(asker, "roles", WHY, { client: prisma, sections: SECTIONS });
    const row = await prisma.accessRequest.findUnique({ where: { id: one.id } });
    // A request is a question and an answer. Anything resembling a grant, an
    // expiry or a scope would be the permission system nobody decided to build.
    expect(Object.keys(row ?? {})).toEqual(
      expect.not.arrayContaining(["granted", "grants", "expiresAt", "scope", "permissions"]),
    );
  });
});
