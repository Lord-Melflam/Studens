/**
 * Leaving: deletion, detaching, export, notifications and the address.
 *
 * FR-A11 to FR-A15, FR-H1 to FR-H4, and OPEN-46.
 *
 * Against a real PostgreSQL, because most of what matters here IS the database:
 * whether a cascade reaches, whether a transaction rolls back, and whether a
 * detached review is still there afterwards.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  CONFIRM_MAX_AGE_SECONDS,
  EmailInvalid,
  OPTIONAL_KINDS,
  checkEmail,
  confirmEmailChange,
  deleteAccount,
  enqueueMail,
  exportAccount,
  mailRelayConfigured,
  notifyMember,
  readPreferences,
  requestEmailChange,
  setPreference,
  type MemberErasure,
} from "@studens/platform";
import { RYC_MODULE, detachMemberReviews, exportMemberReviews } from "@studens/ryc";
import { upsertCourse } from "../fixtures/catalogue.js";

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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the account tests " +
      "would have been skipped. They cover deletion, detaching and the outbox.",
  );
}

const dbit = reachable ? it : it.skip;

const KEY = "test-signing-key-not-a-secret";
const ERASURES: MemberErasure[] = [
  { module: RYC_MODULE, erase: detachMemberReviews, export: exportMemberReviews },
];

let tenantId = "";
let courseId = "";

async function freshMember(subject: string, email = `${subject}@example.invalid`) {
  const m = await prisma.member.create({
    data: {
      provider: "acct-test",
      providerSubject: subject,
      emailDomain: "example.invalid",
      providerEmail: email,
      contactEmail: email,
      contactVerifiedAt: new Date(),
      username: `ztst.acct.${subject}`,
      tenantId,
    },
  });
  return m.id;
}

async function seed() {
  if (!reachable) return;
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000t3" },
    update: {},
    create: { id: "00000000-0000-0000-0000-0000000000t3", name: "test" },
  });
  tenantId = tenant.id;
  const course = await upsertCourse(prisma, "ztst0002");
  courseId = course.id;
}

async function clean() {
  if (!reachable) return;
  await prisma.reviewAttributed.deleteMany({ where: { courseId } });
  await prisma.mailOutbox.deleteMany({ where: { toAddress: { contains: "example.invalid" } } });
  await prisma.member.deleteMany({ where: { provider: "acct-test" } });
}

await seed();
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const review = (memberId: string) => ({
  memberId,
  courseId,
  academicYear: 2024,
  recommendation: 4,
  workloadVsEcts: 3,
  difficulty: 3,
  body: "x".repeat(150),
});

describe("deleting an account (FR-A15, Article 17)", () => {
  dbit("removes the member, the sessions, the preferences and the quota", async () => {
    const id = await freshMember("gone");
    await prisma.session.create({
      data: { memberId: id, tokenHash: `hash-${id}`, issuedAt: new Date(), lastSeenAt: new Date() },
    });
    await setPreference(prisma, id, "digest.weekly", true);
    await prisma.memberQuota.create({
      data: { memberId: id, windowStart: new Date("2026-09-01"), used: 2 },
    });

    const report = await deleteAccount(prisma, id, { erasures: ERASURES });
    expect(report.sessionsRevoked).toBe(1);

    expect(await prisma.member.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.session.count({ where: { memberId: id } })).toBe(0);
    expect(await prisma.notificationPreference.count({ where: { memberId: id } })).toBe(0);
    expect(await prisma.memberQuota.count({ where: { memberId: id } })).toBe(0);
  });

  /**
   * OPEN-46, decided 2026-09-13: DETACH. The text stays, the name
   * goes. The review is still readable by the students who were relying on it.
   */
  dbit("detaches attributed reviews rather than deleting them", async () => {
    const id = await freshMember("author");
    const created = await prisma.reviewAttributed.create({ data: review(id) });

    const report = await deleteAccount(prisma, id, { erasures: ERASURES });
    expect(report.modules[RYC_MODULE]).toBe(1);

    const after = await prisma.reviewAttributed.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.body).toBe(created.body);
    expect(after.memberId).toBeNull();
    expect(after.detachedAt).not.toBeNull();
  });

  /**
   * A detached review must not become an anonymous one. If it did it would
   * inflate the number FR-C21 puts in front of the next contributor, so the
   * figure they use to judge their own exposure would be wrong.
   */
  dbit("a detached review is counted as neither named nor anonymous", async () => {
    const { reviewsFor } = await import("@studens/ryc");
    const id = await freshMember("counted");
    await prisma.reviewAttributed.create({ data: review(id) });

    const before = await reviewsFor(prisma, courseId);
    expect(before.aggregate.named).toBe(1);
    expect(before.aggregate.detached).toBe(0);

    await deleteAccount(prisma, id, { erasures: ERASURES });

    const after = await reviewsFor(prisma, courseId);
    expect(after.aggregate.count).toBe(1);
    expect(after.aggregate.named).toBe(0);
    expect(after.aggregate.anonymous).toBe(0);
    expect(after.aggregate.detached).toBe(1);
    // And it carries no author at all, rather than the word "anonyme".
    expect(after.reviews[0]?.path).toBe("detached");
    expect(after.reviews[0]?.author).toBeNull();
  });

  /**
   * Several people deleting their accounts leaves several detached rows on one
   * course. The unique index is on (memberId, courseId, academicYear) and
   * Postgres treats NULLs as distinct, which is the behaviour wanted: the rule
   * binds a member, and there is no longer a member.
   */
  dbit("many detached reviews can coexist on one course and year", async () => {
    for (const who of ["a", "b", "c"]) {
      const id = await freshMember(`multi-${who}`);
      await prisma.reviewAttributed.create({ data: review(id) });
      await deleteAccount(prisma, id, { erasures: ERASURES });
    }
    expect(await prisma.reviewAttributed.count({ where: { courseId, memberId: null } })).toBe(3);
  });

  /**
   * A module that throws must abort the whole deletion. A half-deleted account
   * is worse than a refused one, because the person believes it is gone.
   */
  dbit("a module that fails leaves the account intact", async () => {
    const id = await freshMember("kept");
    const boom: MemberErasure = {
      module: "explodes",
      erase: () => Promise.reject(new Error("no")),
    };
    await expect(deleteAccount(prisma, id, { erasures: [boom] })).rejects.toThrow();
    expect(await prisma.member.findUnique({ where: { id } })).not.toBeNull();
  });
});

describe("the export (FR-A15, Article 20)", () => {
  dbit("carries the account, the preferences and the module's own rows", async () => {
    const id = await freshMember("exporter");
    await prisma.reviewAttributed.create({ data: review(id) });
    await setPreference(prisma, id, "digest.weekly", true);

    const data = await exportAccount(prisma, id, { erasures: ERASURES });
    expect(data.account["username"]).toBe("ztst.acct.exporter");
    expect(data.account["providerEmail"]).toBe("exporter@example.invalid");
    expect(data.notifications.some((n) => n.kind === "digest.weekly" && n.enabled)).toBe(true);
    const ryc = data.modules[RYC_MODULE] as { attributedReviews: unknown[] };
    expect(ryc.attributedReviews).toHaveLength(1);
  });

  dbit("says in the file what is not in the file", async () => {
    // An export is read months later, out of context. Its silences need
    // explaining inside it, not only on the page that produced it.
    const id = await freshMember("silent");
    const data = await exportAccount(prisma, id, { erasures: ERASURES });
    expect(data.notIncluded.join(" ")).toMatch(/anonymous/i);
  });
});

describe("notification preferences (FR-H1, FR-H2)", () => {
  dbit("every optional kind starts off, because absence is not consent", async () => {
    const id = await freshMember("quiet");
    const prefs = await readPreferences(prisma, id);
    expect(prefs).toHaveLength(OPTIONAL_KINDS.length);
    expect(prefs.every((p) => !p.enabled)).toBe(true);
  });

  dbit("records when the decision was made, for Article 7(1)", async () => {
    const id = await freshMember("consent");
    await setPreference(prisma, id, "digest.weekly", true);
    const row = await prisma.notificationPreference.findUniqueOrThrow({
      where: { memberId_kind: { memberId: id, kind: "digest.weekly" } },
    });
    expect(row.decidedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  dbit("refuses a kind nobody declared", async () => {
    const id = await freshMember("unknown");
    await expect(setPreference(prisma, id, "not.a.kind", true)).rejects.toThrow();
  });

  dbit("queues nothing for a kind the member did not choose", async () => {
    const id = await freshMember("declined");
    expect(await notifyMember(prisma, id, "digest.weekly")).toBe("declined");
    expect(await prisma.mailOutbox.count({ where: { toAddress: "declined@example.invalid" } })).toBe(0);
  });

  dbit("queues to the confirmed address once the kind is chosen", async () => {
    const id = await freshMember("willing");
    await setPreference(prisma, id, "digest.weekly", true);
    expect(await notifyMember(prisma, id, "digest.weekly")).toBe("queued");
    const row = await prisma.mailOutbox.findFirstOrThrow({
      where: { toAddress: "willing@example.invalid" },
    });
    expect(row.kind).toBe("digest.weekly");
    expect(row.sentAt).toBeNull();
  });

  /** FR-A13: nothing optional goes to an address nobody confirmed. */
  dbit("sends nothing to an unconfirmed address", async () => {
    const id = await freshMember("unconfirmed");
    await prisma.member.update({ where: { id }, data: { contactVerifiedAt: null } });
    await setPreference(prisma, id, "digest.weekly", true);
    expect(await notifyMember(prisma, id, "digest.weekly")).toBe("unreachable");
  });

  dbit("refuses to queue a kind that has no meaning", async () => {
    await expect(
      enqueueMail(prisma, { to: "x@example.invalid", kind: "invented.kind" }),
    ).rejects.toThrow();
  });
});

describe("changing the contact address (FR-A12, FR-A13)", () => {
  dbit("changes nothing until the link is opened", async () => {
    const id = await freshMember("mover");
    await requestEmailChange(prisma, id, "New.Place@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });

    const still = await prisma.member.findUniqueOrThrow({ where: { id } });
    expect(still.contactEmail).toBe("mover@example.invalid");

    // Scoped to this test's own two addresses. Reading the whole outbox made
    // it a test about every other row in the table, and it failed on one left
    // by a manual walkthrough. Same lesson as the session count in
    // callback.db.test.ts: assert only over what this test created.
    const queued = await prisma.mailOutbox.findMany({
      where: { toAddress: { in: ["new.place@example.invalid", "mover@example.invalid"] } },
      orderBy: { createdAt: "asc" },
    });
    const confirm = queued.find((m) => m.kind === "email.confirm");
    expect(confirm?.toAddress).toBe("new.place@example.invalid");

    // The OLD address is told, and told before the change takes effect. That is
    // what makes a session takeover visible to the person losing it.
    const warned = queued.find((m) => m.kind === "email.changed");
    expect(warned?.toAddress).toBe("mover@example.invalid");
  });

  /**
   * The other half of the same boundary: just inside the window still works.
   * A test that only checks the far side passes just as happily if the
   * lifetime is accidentally set to zero.
   */
  dbit("accepts a token issued just inside the window", async () => {
    const id = await freshMember("justintime");
    const almost = new Date(Date.now() - (CONFIRM_MAX_AGE_SECONDS - 120) * 1000);
    const { token } = await requestEmailChange(prisma, id, "intime@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
      now: almost,
    });
    const done = await confirmEmailChange(prisma, token, { key: KEY });
    expect(done.email).toBe("intime@example.invalid");
  });

  dbit("applies the change when the token comes back", async () => {
    const id = await freshMember("confirmer");
    const { token } = await requestEmailChange(prisma, id, "elsewhere@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    const done = await confirmEmailChange(prisma, token, { key: KEY });
    expect(done.memberId).toBe(id);

    const after = await prisma.member.findUniqueOrThrow({ where: { id } });
    expect(after.contactEmail).toBe("elsewhere@example.invalid");
    expect(after.contactVerifiedAt).not.toBeNull();
    // FR-A12: identity is untouched by a contact change.
    expect(after.providerEmail).toBe("confirmer@example.invalid");
  });

  dbit("refuses a token signed with another key", async () => {
    const id = await freshMember("forged");
    const { token } = await requestEmailChange(prisma, id, "attacker@example.invalid", {
      key: "a-different-key-entirely",
      baseUrl: "http://localhost:3001",
    });
    await expect(confirmEmailChange(prisma, token, { key: KEY })).rejects.toThrow();
  });

  dbit("refuses an expired token", async () => {
    const id = await freshMember("late");
    // Derived from the constant rather than written as a number. It was three
    // hours, which stopped being expired the moment the lifetime went from one
    // hour to twenty-four, and the test would have gone green while proving
    // the opposite of its name.
    const longAgo = new Date(Date.now() - (CONFIRM_MAX_AGE_SECONDS + 60) * 1000);
    const { token } = await requestEmailChange(prisma, id, "stale@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
      now: longAgo,
    });
    await expect(confirmEmailChange(prisma, token, { key: KEY })).rejects.toThrow();
  });

  dbit("refuses a token for a member who has since been deleted", async () => {
    const id = await freshMember("vanished");
    const { token } = await requestEmailChange(prisma, id, "ghost@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    await deleteAccount(prisma, id, { erasures: ERASURES });
    await expect(confirmEmailChange(prisma, token, { key: KEY })).rejects.toThrow();
  });
});

describe("what an address may look like", () => {
  it("accepts an ordinary one and lowercases it", () => {
    expect(checkEmail("  Marie.Dupont@Student.UCLouvain.BE ")).toBe(
      "marie.dupont@student.uclouvain.be",
    );
  });

  it("refuses what is plainly not an address", () => {
    for (const bad of ["", "marie", "marie@", "@uclouvain.be", "marie@uclouvain", "a b@c.be"]) {
      expect(() => checkEmail(bad), bad).toThrow(EmailInvalid);
    }
  });

  /**
   * Deliberately permissive, and this is the point rather than a gap. The only
   * check that means anything is whether a message arrives, and that check is
   * the confirmation link. A stricter pattern would reject valid addresses,
   * which happens, in exchange for catching typos the link catches anyway.
   */
  it("accepts the odd-looking ones that are nonetheless valid", () => {
    expect(checkEmail("p+tag@sub.domain.example")).toBe("p+tag@sub.domain.example");
    expect(checkEmail("o'brien@example.ie")).toBe("o'brien@example.ie");
  });
});

/**
 * The screen may not promise a message this installation cannot send.
 *
 * REPORTED BY FRANÇOIS, 2026-09-13. He changed his contact address, the screen
 * said "A message has gone to <his address>", and no message had gone anywhere:
 * the row was queued correctly and no relay was configured, so it could never
 * leave. He waited for a link that was not coming.
 *
 * The queueing was right. The sentence was not. A product that says something
 * happened when it did not is worse than one that says it cannot: the first
 * makes somebody doubt their own inbox, the second tells them what to fix.
 */
describe("what the interface may claim about mail", () => {
  const HOST = "STUDENS_SMTP_HOST";
  const FROM = "STUDENS_MAIL_FROM";

  function withEnv(vars: Record<string, string | undefined>, run: () => void) {
    const before = { [HOST]: process.env[HOST], [FROM]: process.env[FROM] };
    try {
      for (const [k, v] of Object.entries(vars)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      run();
    } finally {
      for (const [k, v] of Object.entries(before)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it("reports that nothing can be delivered when no relay is set", () => {
    withEnv({ [HOST]: undefined, [FROM]: undefined }, () => {
      expect(mailRelayConfigured()).toBe(false);
    });
  });

  it("needs BOTH a host and a sender, since neither alone can deliver", () => {
    withEnv({ [HOST]: "smtp.example.invalid", [FROM]: undefined }, () => {
      expect(mailRelayConfigured()).toBe(false);
    });
    withEnv({ [HOST]: undefined, [FROM]: "studens@example.invalid" }, () => {
      expect(mailRelayConfigured()).toBe(false);
    });
    withEnv({ [HOST]: "smtp.example.invalid", [FROM]: "studens@example.invalid" }, () => {
      expect(mailRelayConfigured()).toBe(true);
    });
  });

  /**
   * The queue is still written either way. A message that cannot go out today
   * goes out the day a relay is configured, so the request is not lost: it is
   * the CLAIM that changes, not the behaviour.
   */
  dbit("queues the message even when it cannot be sent", async () => {
    const id = await freshMember("waiting");
    await requestEmailChange(prisma, id, "somewhere@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    const queued = await prisma.mailOutbox.findFirstOrThrow({
      where: { toAddress: "somewhere@example.invalid" },
    });
    expect(queued.kind).toBe("email.confirm");
    expect(queued.sentAt).toBeNull();
    expect(queued.attempts).toBe(0);
  });
});

/**
 * A confirmation link works once.
 *
 * FOUND BY USING IT, 2026-09-13. Verifying the lifetime change, I replayed a
 * two-hour-old link three times against a live account and it applied every
 * time, overwriting an address the member had since set. The token was
 * replayable for its whole lifetime, which barely mattered at one hour and
 * matters at twenty-four. FR-A13 said "single-use" and the implementation was
 * not; I had quietly dropped the word from the requirement while rewriting it,
 * which is the worse half of the mistake.
 *
 * Single use with NO stored state: the token carries a fingerprint of the
 * contact state it was issued against, and applying the change moves that
 * state. Nothing to write, nothing to clean up, nothing to expire twice.
 */
describe("a confirmation link is single-use (FR-A13)", () => {
  dbit("the same link a second time does nothing", async () => {
    const id = await freshMember("once");
    const { token } = await requestEmailChange(prisma, id, "first@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });

    await confirmEmailChange(prisma, token, { key: KEY });
    expect((await prisma.member.findUniqueOrThrow({ where: { id } })).contactEmail).toBe(
      "first@example.invalid",
    );

    await expect(confirmEmailChange(prisma, token, { key: KEY })).rejects.toThrow();
  });

  /**
   * The replay that actually happened: the member moves on, and an old link
   * must not be able to drag them back to a previous address.
   */
  dbit("an old link cannot undo a later change", async () => {
    const id = await freshMember("moved");
    const { token: old } = await requestEmailChange(prisma, id, "old@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    await confirmEmailChange(prisma, old, { key: KEY });

    const { token: recent } = await requestEmailChange(prisma, id, "new@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    await confirmEmailChange(prisma, recent, { key: KEY });

    await expect(confirmEmailChange(prisma, old, { key: KEY })).rejects.toThrow();
    expect((await prisma.member.findUniqueOrThrow({ where: { id } })).contactEmail).toBe(
      "new@example.invalid",
    );
  });

  /**
   * Two requests outstanding at once: whichever is opened first wins and
   * invalidates the other. Either order is safe; what must not happen is both
   * applying, because then the last link seen decides and the member cannot
   * tell which address they ended up with.
   */
  dbit("of two outstanding links, only the first opened applies", async () => {
    const id = await freshMember("racing");
    const a = await requestEmailChange(prisma, id, "a@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    const b = await requestEmailChange(prisma, id, "b@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });

    await confirmEmailChange(prisma, b.token, { key: KEY });
    await expect(confirmEmailChange(prisma, a.token, { key: KEY })).rejects.toThrow();
    expect((await prisma.member.findUniqueOrThrow({ where: { id } })).contactEmail).toBe(
      "b@example.invalid",
    );
  });

  /** The previous address must not be readable from the link itself. */
  dbit("carries no address but the new one", async () => {
    const id = await freshMember("private", "secret.old@example.invalid");
    const { token } = await requestEmailChange(prisma, id, "shown@example.invalid", {
      key: KEY,
      baseUrl: "http://localhost:3001",
    });
    const payload = Buffer.from(token.split(".")[0]!, "base64url").toString("utf8");
    expect(payload).toContain("shown@example.invalid");
    // The payload is base64 and readable by anybody who sees the URL.
    expect(payload).not.toContain("secret.old@example.invalid");
  });
});
