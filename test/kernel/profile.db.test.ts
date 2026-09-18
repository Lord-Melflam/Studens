/**
 * The first run's server side, against a real PostgreSQL.
 *
 * Three of these need the database because the property IS the database: the
 * unique index is what decides a clash of usernames, not a prior lookup, and
 * the institution list is a seeded table rather than a constant.
 *
 * Skipped when no database is reachable, and a hard failure when the runner
 * says there should be one. See the note at the top of kernel.db.test.ts for
 * why that variable exists.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { UsernameInvalid, readProfile, usernamesFor, writeProfile } from "@studens/platform";
import { listInstitutions } from "@studens/ref";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the first run's " +
      "tests would have been skipped. They cover the username index, the " +
      "institution seed and FR-F14's replay.",
  );
}

const dbit = reachable ? it : it.skip;

let one = "";
let two = "";

async function seed(): Promise<void> {
  if (!reachable) return;
  // Its OWN tenant id. It shared `...t2` with test/auth/session.db.test.ts, and
  // Vitest runs files in parallel workers: both found nothing, both inserted,
  // and one got a unique violation. It only surfaced when an unrelated new test
  // file changed which files overlap.
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t6" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t6", name: "test" },
  });
  const mk = async (subject: string) => {
    const m = await prisma.member.upsert({
      where: { provider_providerSubject: { provider: "test", providerSubject: subject } },
      update: {},
      create: {
        provider: "test",
        providerSubject: subject,
        emailDomain: "example.invalid",
        tenantId: tenant.id,
      },
    });
    return m.id;
  };
  one = await mk("profile-one");
  two = await mk("profile-two");
}

async function reset(): Promise<void> {
  if (!reachable) return;
  for (const id of [one, two]) {
    await prisma.member.update({
      where: { id },
      data: {
        username: null,
        locale: null,
        institutionCode: null,
        studies: null,
        yearOfStudy: null,
        interests: null,
        onboardedAt: null,
        onboardingStep: 0,
      },
    });
  }
}

await seed();
beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

/**
 * Names carry a `ztst` prefix because this runs against a developer's own
 * database, which already holds whatever they signed in as. The first version
 * used "ztst.one", the same name the manual walkthrough had just taken, and
 * failed on a clash that said nothing about the code.
 */
describe("a username is decided by the index, not by a lookup (FR-F6)", () => {
  dbit("takes the first and refuses the second", async () => {
    await writeProfile(prisma, one, { username: "ztst.one" });
    // Two people choosing the same name in the same second would both pass a
    // check-then-write, which is why the constraint is the thing that decides.
    await expect(writeProfile(prisma, two, { username: "ztst.one" })).rejects.toBeInstanceOf(
      UsernameInvalid,
    );
    const clash = await writeProfile(prisma, two, { username: "ztst.one" }).catch(
      (e: unknown) => e as UsernameInvalid,
    );
    expect(clash.reason).toBe("taken");
  });

  dbit("lets somebody keep the name they already have", async () => {
    await writeProfile(prisma, one, { username: "ztst.one" });
    // Saving the profile again must not collide with oneself, or editing any
    // other field would become impossible once a name is set.
    const again = await writeProfile(prisma, one, { username: "ztst.one", studies: "droit" });
    expect(again.username).toBe("ztst.one");
    expect(again.studies).toBe("droit");
  });

  dbit("stores it lowercased, whatever was typed", async () => {
    const saved = await writeProfile(prisma, one, { username: "  ZTST_Two " });
    expect(saved.username).toBe("ztst_two");
  });

  /**
   * THE NAME A READER SEES IS WHAT HAS TO BE UNIQUE.
   *
   * `username` alone was unique, and that let `lou.martin`, `lou-martin`,
   * `lou_martin` and `loumartin` all exist at once: four accounts that read as
   * one person. It matters here more than in most products, because the name is
   * displayed beside somebody's opinion of a named lecturer, and because one of
   * those four could be the administrator.
   */
  dbit("refuses a name that differs only by its separators", async () => {
    await writeProfile(prisma, one, { username: "ztst.sep" });
    for (const impersonation of ["ztst-sep", "ztst_sep", "ztstsep", "ZTST.SEP"]) {
      const clash = await writeProfile(prisma, two, { username: impersonation }).catch(
        (e: unknown) => e as UsernameInvalid,
      );
      expect(clash).toBeInstanceOf(UsernameInvalid);
      expect(clash.reason).toBe("taken");
    }
  });

  dbit("still lets somebody keep their own name, separators and all", async () => {
    // The check must not fire against oneself, or a member with a separator in
    // their name could never save their profile again.
    await writeProfile(prisma, one, { username: "ztst.keep" });
    const again = await writeProfile(prisma, one, { username: "ztst.keep", studies: "droit" });
    expect(again.username).toBe("ztst.keep");
  });

  dbit("refuses a reserved name spelled with separators", async () => {
    // `m.o.d.e.r.a.t.o.r` reads as the platform speaking and walked straight
    // past a list that only matched the stored string.
    const clash = await writeProfile(prisma, one, { username: "m.o.d.e.r.a.t.o.r" }).catch(
      (e: unknown) => e as UsernameInvalid,
    );
    expect(clash.reason).toBe("reserved");
  });
});

describe("one screen at a time (FR-F5)", () => {
  dbit("a patch leaves the fields it does not name alone", async () => {
    await writeProfile(prisma, one, { username: "ztst.resume", onboardingStep: 3 });
    await writeProfile(prisma, one, { studies: "sciences", onboardingStep: 4 });
    const p = await readProfile(prisma, one);
    expect(p?.username).toBe("ztst.resume");
    expect(p?.studies).toBe("sciences");
    expect(p?.onboardingStep).toBe(4);
  });

  dbit("a field can be emptied again", async () => {
    await writeProfile(prisma, one, { studies: "sciences" });
    await writeProfile(prisma, one, { studies: null });
    expect((await readProfile(prisma, one))?.studies).toBeNull();
  });
});

describe("finishing, and doing it again (FR-F14)", () => {
  dbit("finishing stamps a time", async () => {
    const saved = await writeProfile(prisma, one, {
      username: "ztst.finished",
      onboardedAt: true,
    });
    expect(saved.onboardedAt).toBeInstanceOf(Date);
  });

  /**
   * Replaying clears the progress as well as the stamp. If it cleared only the
   * stamp, the app would send the member to the wizard and the wizard would
   * resume on the last screen, so "go through the setup again" would mean
   * "see the final screen again".
   */
  dbit("replaying sends someone back to the start", async () => {
    await writeProfile(prisma, one, { username: "ztst.again", onboardingStep: 5 });
    await writeProfile(prisma, one, { onboardedAt: true });
    const replay = await writeProfile(prisma, one, { onboardedAt: false });
    expect(replay.onboardedAt).toBeNull();
    expect(replay.onboardingStep).toBe(0);
    // The name survives, because it is what other people already see.
    expect(replay.username).toBe("ztst.again");
  });
});

describe("the institutions (FR-F10, FR-F12)", () => {
  dbit("lists every institution, and opens the ones whose catalogue is in", async () => {
    const all = await listInstitutions({ client: prisma });
    // Every Belgian university, because listing UCLouvain alone would read as
    // a UCLouvain product. Eleven, and Saint-Louis is deliberately not one of
    // them: it merged into UCLouvain in 2023.
    expect(all.length).toBeGreaterThanOrEqual(11);
    expect(all.map((i) => i.code)).not.toContain("saint-louis");

    // FR-F12 is about the RULE, not about the count. This used to assert the
    // open set was exactly ["uclouvain"], which made adding a second catalogue
    // look like a regression: the test failed on the day ULB was ingested,
    // which is the day it was supposed to pass.
    const open = all.filter((i) => i.available).map((i) => i.code);
    expect(open).toContain("uclouvain");
    expect(open.length).toBeLessThan(all.length);
    for (const code of open) expect(code).not.toBe("");
  });

  dbit("puts the ones that can be chosen first", async () => {
    const all = await listInstitutions({ client: prisma });
    // Whatever the open set is, none of the closed ones may come before an
    // open one: an institution somebody can pick should not be below a list of
    // institutions they cannot.
    const lastOpen = all.map((i) => i.available).lastIndexOf(true);
    const firstClosed = all.map((i) => i.available).indexOf(false);
    expect(firstClosed).toBeGreaterThan(lastOpen);
  });

  /**
   * FR-F11: a colour we do not know is null, never approximated. An invented
   * institutional colour is an invented fact about that institution.
   */
  dbit("carries no colour it has not been given", async () => {
    const all = await listInstitutions({ client: prisma });
    for (const i of all) {
      if (i.colour !== null) expect(i.colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(all.find((i) => i.code === "uclouvain")?.colour).toBe("#1b4a8f");
  });
});

describe("a module can show a name without being able to look one up", () => {
  dbit("resolves the ids it is given, and nothing else", async () => {
    await writeProfile(prisma, one, { username: "ztst.shown" });
    const names = await usernamesFor(prisma, [one, two]);
    expect(names.get(one)).toBe("ztst.shown");
    // A member with no name yet resolves to null rather than being missing, so
    // the caller can tell "no name" from "no such member".
    expect(names.get(two)).toBeNull();
  });

  dbit("asks nothing when there is nothing to ask about", async () => {
    expect((await usernamesFor(prisma, [])).size).toBe(0);
  });
});
