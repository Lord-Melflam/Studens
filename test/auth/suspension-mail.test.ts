/**
 * The message that goes with a suspension.
 *
 * WHY IT IS TESTED AT ALL. A template with no test fails in the worker, at
 * send time, with nobody watching: `renderMail` throws on a kind it does not
 * know, and the row sits in the outbox while the person it was for concludes
 * the site is broken. That is the exact failure this whole path exists to
 * remove, so it cannot be reintroduced by a typo in a key.
 *
 * It renders rather than reading the source, which the older template test
 * deliberately does not do. That test is about one number stated in three
 * translations, and reading the file is enough for it. These are about what
 * the reader actually receives: a date formatted in their language, a reason
 * printed whole, and a contact line that is there or absent depending on
 * configuration. None of that is visible in the source.
 */
import { afterEach, describe, expect, it } from "vitest";
import { TRANSACTIONAL } from "@studens/platform";
import { TEMPLATED_KINDS, renderMail } from "@studens/worker";

const LOCALES = ["fr", "nl", "en"];

/** Enough variables to satisfy every template at once. */
const VARS = { url: "https://example.invalid/x", to: "someone@example.invalid", reason: "R" };

afterEach(() => {
  delete process.env["STUDENS_CONTACT_EMAIL"];
});

describe("every template renders", () => {
  for (const kind of TEMPLATED_KINDS) {
    for (const locale of LOCALES) {
      it(`${kind} in ${locale}`, () => {
        const { subject, body } = renderMail(kind, locale, VARS);
        expect(subject.length, "a message with no subject line is spam").toBeGreaterThan(5);
        expect(body.length).toBeGreaterThan(40);
        // A variable the template forgot to interpolate shows up like this,
        // and it is the one defect a rendering test can catch for free.
        expect(body).not.toContain("undefined");
        expect(body).not.toContain("[object Object]");
      });
    }
  }

  it("covers both of the suspension kinds", () => {
    expect(TEMPLATED_KINDS).toContain("account.suspended");
    expect(TEMPLATED_KINDS).toContain("account.reinstated");
  });

  /**
   * Both are transactional, never a preference (FR-H2). The kind exists so
   * that somebody who never opened the notification screen, which is most
   * people, is still told that their own account was stopped.
   */
  it("and both are sent whatever the preferences say", () => {
    expect(TRANSACTIONAL.has("account.suspended")).toBe(true);
    expect(TRANSACTIONAL.has("account.reinstated")).toBe(true);
  });
});

describe("the suspension message", () => {
  const reason = "Insultes répétées envers un enseignant nommé";

  it("prints the reason in the moderator's own words", () => {
    for (const locale of LOCALES) {
      const { body } = renderMail("account.suspended", locale, { reason, until: null });
      expect(body, `${locale} drops the reason`).toContain(reason);
    }
  });

  it("states an end date in the reader's language, not the server's", () => {
    const until = new Date("2026-12-24T10:00:00.000Z").toISOString();
    const fr = renderMail("account.suspended", "fr", { reason, until }).body;
    const en = renderMail("account.suspended", "en", { reason, until }).body;
    expect(fr).toContain("24 décembre 2026");
    expect(en).toContain("December 24, 2026");
  });

  /**
   * Permanent is stated as having no end, never as a date far away. The column
   * holds null for it, and every reader of that null must say the same thing.
   */
  it("says a permanent suspension has no end date", () => {
    const { body } = renderMail("account.suspended", "fr", { reason, until: null });
    expect(body).toContain("pas de date de fin");
    expect(body).not.toMatch(/\d{4}/);
  });

  it("carries no link, like every message about losing access", () => {
    for (const locale of LOCALES) {
      const { body } = renderMail("account.suspended", locale, { reason, until: null });
      expect(body, "a link here is the shape phishing takes").not.toContain("http");
    }
  });

  it("offers an address to write to only when one is configured", () => {
    const without = renderMail("account.suspended", "fr", { reason, until: null }).body;
    expect(without, "no address means no invitation to write").not.toContain("écrivez à");

    process.env["STUDENS_CONTACT_EMAIL"] = "moderation@example.invalid";
    const with_ = renderMail("account.suspended", "fr", { reason, until: null }).body;
    expect(with_).toContain("moderation@example.invalid");
  });
});
