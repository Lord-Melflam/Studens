/**
 * FR-I1 to FR-I3: taking feedback, and reading it back bounded.
 *
 * WHAT THESE ARE REALLY FOR. Two things about this table are easy to get
 * wrong in a way nothing else notices.
 *
 * The first is that a signed-out sender must work. It is the whole reason the
 * panel exists: the link goes on social media, and the person who gives up
 * after two screens has no account and never will. A `memberId` that turned
 * out to be required would only show up in production, on somebody else's
 * phone, as a form that never submits.
 *
 * The second is what is NOT stored. The route arrives from a browser carrying
 * whatever was in the address bar, including a search box's contents, and
 * cutting it is a property of the column rather than a rule the caller
 * remembers. A test is the only thing that keeps it that way.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  FEEDBACK_KINDS,
  FeedbackInvalid,
  MESSAGE_MAX,
  exportFeedback,
  feedbackAuthors,
  listFeedback,
  setFeedbackStatus,
  submitFeedback,
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
    "STUDENS_REQUIRE_DB=1, but no database is reachable, so the feedback " +
      "tests would have been skipped. They cover the one form a stranger uses.",
  );
}

const dbit = reachable ? it : it.skip;
const PROVIDER = "feedback-test";
const TENANT = "00000000-0000-0000-0000-0000000000f1";

let memberId = "";

async function clean() {
  if (!reachable) return;
  const mine = await prisma.member.findMany({ where: { provider: PROVIDER }, select: { id: true } });
  const ids = mine.map((m) => m.id);
  if (ids.length > 0) await prisma.feedback.deleteMany({ where: { memberId: { in: ids } } });
  await prisma.feedback.deleteMany({ where: { message: { startsWith: "ztst.fb" } } });
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
  const m = await prisma.member.create({
    data: {
      provider: PROVIDER,
      providerSubject: "sender",
      emailDomain: "example.invalid",
      username: "ztst.fb.sender",
      tenantId: TENANT,
    },
  });
  memberId = m.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const said = (over: Record<string, unknown> = {}) => ({
  kind: "bug",
  message: "ztst.fb something is wrong with this screen",
  ...over,
});

describe("anybody can say what they think, signed in or not", () => {
  dbit("takes feedback from somebody with no account", async () => {
    const row = await submitFeedback(said(), { client: prisma });
    expect(row.memberId, "a signed-out sender is the ordinary case here").toBeNull();
    expect(row.status).toBe("open");
  });

  dbit("attaches the member when there is one", async () => {
    const row = await submitFeedback(said(), { client: prisma, memberId });
    expect(row.memberId).toBe(memberId);
  });

  dbit("keeps an address only when one was given", async () => {
    const without = await submitFeedback(said(), { client: prisma });
    expect(without.contactEmail).toBeNull();
    const with_ = await submitFeedback(said({ contactEmail: "  who@example.invalid " }), {
      client: prisma,
    });
    expect(with_.contactEmail, "trimmed, because a stray space is not a different person").toBe(
      "who@example.invalid",
    );
  });

  dbit("refuses what cannot be an address", async () => {
    await expect(submitFeedback(said({ contactEmail: "not an address" }), { client: prisma }))
      .rejects.toBeInstanceOf(FeedbackInvalid);
  });

  dbit("refuses a message too short to act on, and one too long to store", async () => {
    await expect(submitFeedback(said({ message: "no" }), { client: prisma })).rejects.toBeInstanceOf(
      FeedbackInvalid,
    );
    await expect(
      submitFeedback(said({ message: "z".repeat(MESSAGE_MAX + 1) }), { client: prisma }),
    ).rejects.toBeInstanceOf(FeedbackInvalid);
  });

  dbit("refuses a kind it does not know", async () => {
    await expect(submitFeedback(said({ kind: "rant" }), { client: prisma })).rejects.toBeInstanceOf(
      FeedbackInvalid,
    );
    for (const kind of FEEDBACK_KINDS) {
      await expect(submitFeedback(said({ kind }), { client: prisma })).resolves.toBeTruthy();
    }
  });
});

describe("what the row is allowed to remember", () => {
  dbit("keeps the path and throws the query string away", async () => {
    // THE POINT OF THE WHOLE TEST FILE. The browser sends the address bar as
    // it stands, and on the search screen that carries what somebody typed.
    // Knowing they were on the search screen is most of a bug report; knowing
    // what they searched for is theirs and finds no faults.
    const row = await submitFeedback(said({ route: "/nl/app/ryc/zoeken?q=my+private+search" }), {
      client: prisma,
    });
    expect(row.route).toBe("/nl/app/ryc/zoeken");
    expect(JSON.stringify(row)).not.toContain("private");
  });

  dbit("drops a fragment too, and an empty route", async () => {
    expect((await submitFeedback(said({ route: "/en/about#team" }), { client: prisma })).route).toBe(
      "/en/about",
    );
    expect((await submitFeedback(said({ route: "  " }), { client: prisma })).route).toBeNull();
  });

  dbit("keeps the interface language, so a wording complaint is actionable", async () => {
    const row = await submitFeedback(said({ locale: "nl" }), { client: prisma });
    expect(row.locale).toBe("nl");
  });

  dbit("has nowhere to put an address or a device, by construction", async () => {
    const row = await submitFeedback(said(), { client: prisma });
    // Not a rule this file applies: the columns do not exist, which is the
    // guarantee doing its job rather than a check somebody has to remember.
    expect(Object.keys(row)).toEqual(
      expect.not.arrayContaining(["ip", "ipAddress", "userAgent", "device"]),
    );
  });
});

describe("the console reads it back a screenful at a time", () => {
  async function three() {
    await submitFeedback(said({ kind: "bug" }), { client: prisma, memberId });
    await submitFeedback(said({ kind: "idea" }), { client: prisma });
    await submitFeedback(said({ kind: "other" }), { client: prisma });
  }

  dbit("bounds the page whatever the caller asks for", async () => {
    await three();
    const page = await listFeedback({ client: prisma, perPage: 100_000 });
    expect(page.items.length).toBeLessThanOrEqual(100);
  });

  dbit("filters by kind and by sender", async () => {
    await three();
    const bugs = await listFeedback({ client: prisma, kind: "bug" });
    expect(bugs.items.every((i) => i.kind === "bug")).toBe(true);

    const mine = await listFeedback({ client: prisma, author: memberId });
    expect(mine.items.every((i) => i.memberId === memberId)).toBe(true);
    expect(mine.items[0]?.username).toBe("ztst.fb.sender");

    // "anonymous" is a GROUP and not a person: every row nobody signed for.
    const nobody = await listFeedback({ client: prisma, author: "anonymous" });
    expect(nobody.items.every((i) => i.memberId === null)).toBe(true);
    expect(nobody.items.length).toBeGreaterThan(0);
  });

  dbit("counts senders without loading every row", async () => {
    await three();
    const authors = await feedbackAuthors({ client: prisma });
    const anon = authors.find((a) => a.memberId === null);
    const named = authors.find((a) => a.memberId === memberId);
    expect(anon?.count).toBeGreaterThanOrEqual(2);
    expect(named?.username).toBe("ztst.fb.sender");
  });

  dbit("moves a row through the queue and refuses a state it does not know", async () => {
    const row = await submitFeedback(said(), { client: prisma });
    await setFeedbackStatus(row.id, "done", { client: prisma });
    const after = await prisma.feedback.findUnique({ where: { id: row.id } });
    expect(after?.status).toBe("done");
    await expect(setFeedbackStatus(row.id, "archived", { client: prisma })).rejects.toBeInstanceOf(
      FeedbackInvalid,
    );
  });
});

describe("deleting an account does not delete what that person reported", () => {
  dbit("detaches the row instead, the way FR-A15 detaches a review", async () => {
    const row = await submitFeedback(said({ contactEmail: "who@example.invalid" }), {
      client: prisma,
      memberId,
    });
    await prisma.feedback.updateMany({ where: { memberId }, data: { memberId: null } });
    await prisma.member.delete({ where: { id: memberId } });
    const after = await prisma.feedback.findUnique({ where: { id: row.id } });
    expect(after, "a bug report is not the member's to take back by leaving").not.toBeNull();
    expect(after?.memberId).toBeNull();
    expect(after?.message).toContain("something is wrong");
  });
});

describe("the export, and why the safe scope is the default", () => {
  dbit("carries no address, no username and no member id when anonymised", async () => {
    await submitFeedback(said({ contactEmail: "findme@example.invalid" }), {
      client: prisma,
      memberId,
    });
    const file = await exportFeedback({ client: prisma, secret: "ztst.secret" });
    expect(file.scope).toBe("anonymised");
    const text = JSON.stringify(file);
    // The three things a file that leaves this machine must not carry.
    expect(text).not.toContain("findme@example.invalid");
    expect(text).not.toContain("ztst.fb.sender");
    expect(text).not.toContain(memberId);
  });

  dbit("groups a sender without naming them, which is what makes it useful", async () => {
    const a = await submitFeedback(said(), { client: prisma, memberId });
    const b = await submitFeedback(said(), { client: prisma, memberId });
    const c = await submitFeedback(said(), { client: prisma });
    const file = await exportFeedback({ client: prisma, secret: "ztst.secret" });

    // SCOPED TO THE ROWS THIS TEST MADE, and it has to be. An export reads the
    // WHOLE table by design, so it is the one thing in the suite that cannot
    // be namespaced: vitest runs files in parallel, and asserting over every
    // item counted another file's rows as a second sender. The first version
    // of this test did exactly that and failed for a reason that had nothing
    // to do with what it checks.
    const byId = new Map(file.items.map((i) => [i["id"], i]));
    expect(new Set([byId.get(a.id)?.["sender"], byId.get(b.id)?.["sender"]]).size).toBe(1);
    expect(byId.get(a.id)?.["sender"]).toBeTruthy();
    // Somebody who was not signed in gets NO key. There is nothing to group
    // them by, and inventing one would be a lie about what is known.
    expect(byId.get(c.id)?.["sender"]).toBeNull();
  });

  dbit("gives the same sender the same key next time, and a different key under a different secret", async () => {
    const row = await submitFeedback(said(), { client: prisma, memberId });
    const a = await exportFeedback({ client: prisma, secret: "ztst.secret" });
    const b = await exportFeedback({ client: prisma, secret: "ztst.secret" });
    const c = await exportFeedback({ client: prisma, secret: "ztst.other" });
    // By id, for the same reason as above: the export is table-wide.
    const key = (f: typeof a): unknown => f.items.find((i) => i["id"] === row.id)?.["sender"];
    expect(key(b), "stable, or grouping across two exports is meaningless").toBe(key(a));
    // Keyed rather than a plain hash: an administrator holds every member id,
    // so an unkeyed hash of one would be reversible by the people it is
    // meant to protect the senders from.
    expect(key(c)).not.toBe(key(a));
  });

  dbit("carries the identities when full, and says who asked in the log", async () => {
    await submitFeedback(said({ contactEmail: "findme@example.invalid" }), {
      client: prisma,
      memberId,
    });
    const file = await exportFeedback({
      client: prisma,
      scope: "full",
      secret: "ztst.secret",
      actorMemberId: memberId,
    });
    expect(file.scope).toBe("full");
    expect(JSON.stringify(file)).toContain("findme@example.invalid");
    const logged = await prisma.auditLog.findFirst({
      where: { actorMemberId: memberId, action: { startsWith: "feedback:exported:full" } },
      orderBy: { at: "desc" },
    });
    // The count is in the action, so the record says how much left rather
    // than only that something did.
    expect(logged?.action).toMatch(/^feedback:exported:full:\d+$/);
  });

  dbit("refuses a full export that cannot say who asked", async () => {
    await expect(
      exportFeedback({ client: prisma, scope: "full", secret: "ztst.secret" }),
    ).rejects.toBeInstanceOf(FeedbackInvalid);
  });

  dbit("explains its own fields, so a reader needs nothing else", async () => {
    await submitFeedback(said(), { client: prisma });
    const file = await exportFeedback({ client: prisma, secret: "ztst.secret" });
    for (const key of Object.keys(file.items[0] ?? {})) {
      expect(file.fields[key], `${key} is in the file and not in its legend`).toBeTruthy();
    }
  });
});
