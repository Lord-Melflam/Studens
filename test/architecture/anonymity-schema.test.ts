/**
 * FR-C8: unlinkability is covered by an automated test that fails if an
 * identifier ever reaches the anonymous path.
 *
 * This parses prisma/schema.prisma directly rather than querying a database,
 * so it runs in CI with no infrastructure and fails before a migration is ever
 * written. It is the concrete form of the argument in
 * docs/design/architecture-style.md section 4: the invariant is checkable
 * because there is one schema to enumerate.
 *
 * If this file is failing, do not weaken it. Read docs/requirements.md 3.3.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

function model(name: string): string {
  const m = schema.match(new RegExp(`^model\\s+${name}\\s*\\{([\\s\\S]*?)^\\}`, "m"));
  if (!m) throw new Error(`model ${name} not found in prisma/schema.prisma`);
  return m[1]!;
}

/** Field names, ignoring comments, attributes and blank lines. */
function fields(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("///") && !l.startsWith("@@"))
    .map((l) => l.split(/\s+/)[0]!)
    .filter((n) => /^[A-Za-z_]\w*$/.test(n));
}

/** Anything that could carry, or be turned into, a member reference. */
const FORBIDDEN = /(member|user|owner|author|submitter|creator|contributor|account|subject|session|email|pseudonym|nym|hmac|signature|token|fingerprint|ip)/i;

describe("ReviewAnonymous carries nothing about its author (FR-C2, FR-C20)", () => {
  const body = model("ReviewAnonymous");
  const names = fields(body);

  it("has fields at all, so the test is not vacuous", () => {
    expect(names.length).toBeGreaterThan(5);
  });

  it("has no field that could hold a member identifier", () => {
    const offenders = names.filter((n) => FORBIDDEN.test(n));
    expect(
      offenders,
      `ReviewAnonymous must carry no member reference in any column, in any form. ` +
        `Offending field(s): ${offenders.join(", ")}. See docs/requirements.md FR-C2 and FR-C20.`,
    ).toEqual([]);
  });

  it("declares no relation to any platform model", () => {
    expect(body).not.toMatch(/@relation/);
  });

  it("has no tenant column (FR-C19)", () => {
    expect(
      names.some((n) => /tenant|institution|faculty/i.test(n)),
      "the tenant of an anonymous contribution is derived from the target, never stored from " +
        "the submitting member: storing it writes an author attribute onto the record (FR-C16)",
    ).toBe(false);
  });

  it("uses a random identifier, not a sequence (FR-C18, FR-C5)", () => {
    expect(body).toMatch(/id\s+String\s+@id\s+@default\(uuid\(\)\)/);
    expect(body, "an autoincrementing id publishes insertion order").not.toMatch(/autoincrement/);
  });

  it("stores its date at day precision only (FR-C5)", () => {
    expect(
      body,
      "a precise timestamp is a de facto join key against the quota counter: see " +
        "docs/design/anonymous-rate-limiting.md 4.1",
    ).toMatch(/createdAt\s+DateTime\s+@db\.Date/);
  });

  it("has no updatedAt, because it can never be edited (FR-C9)", () => {
    expect(names).not.toContain("updatedAt");
  });
});

describe("the quota counter stays unlinkable (FR-C4)", () => {
  const body = model("MemberQuota");
  const names = fields(body);

  it("has no per-submission timestamp", () => {
    const stamps = names.filter((n) => /at$|time|stamp/i.test(n) && n !== "windowStart");
    expect(
      stamps,
      "a fixed window counter carries a window start and a count, nothing more. A precise " +
        "timestamp would allow joining a member to a contribution by time, and rolling windows " +
        "require exactly those timestamps, so both are forbidden.",
    ).toEqual([]);
  });

  it("keeps the window at day precision", () => {
    expect(body).toMatch(/windowStart\s+DateTime\s+@db\.Date/);
  });

  it("stores no reference to any contribution", () => {
    expect(names.some((n) => /review|contribution|target|course/i.test(n))).toBe(false);
  });
});

describe("the two paths are structurally separate (FR-C6)", () => {
  it("attributed and anonymous reviews are different models", () => {
    expect(schema).toMatch(/^model\s+ReviewAttributed\s*\{/m);
    expect(schema).toMatch(/^model\s+ReviewAnonymous\s*\{/m);
  });

  it("the attributed path is the only one holding a member id", () => {
    expect(fields(model("ReviewAttributed"))).toContain("memberId");
  });

  it("no model outside platform stores an email address", () => {
    const nonPlatform = schema
      .split(/^model\s+/m)
      .slice(1)
      .filter((block) => !/@@schema\("platform"\)/.test(block));
    for (const block of nonPlatform) {
      expect(block).not.toMatch(/^\s*email\b/mi);
    }
  });
});

describe("the reference module holds no member data (FR-B9)", () => {
  it("no ref model carries a member reference", () => {
    const refBlocks = schema
      .split(/^model\s+/m)
      .slice(1)
      .filter((block) => /@@schema\("ref"\)/.test(block));
    expect(refBlocks.length).toBeGreaterThan(3);
    for (const block of refBlocks) {
      const name = block.split(/\s/)[0];
      for (const f of fields(block)) {
        expect(
          /(member|session|quota)/i.test(f),
          `ref.${name}.${f} looks like data about a Member. FR-B9 permits third-party data ` +
            `from a public source, such as lecturer names, but nothing identifying a platform user.`,
        ).toBe(false);
      }
    }
  });
});
