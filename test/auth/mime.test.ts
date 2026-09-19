/**
 * What a message looks like by the time a mail server sees it.
 *
 * THE HALF THAT COULD NEVER BE TESTED BEFORE. Building the message was inline
 * in `send-mail.ts`, between a socket and a reply code, so the only way to
 * check it was to send one and look in an inbox. Two defects lived there for
 * as long as the sender existed, and the one message anybody had actually
 * looked at was in English, which is exactly the case that hides the first.
 */
import { describe, expect, it } from "vitest";
import { encodeHeader, mimeMessage, textToHtml, renderMail, TEMPLATED_KINDS } from "@studens/worker";

const LOCALES = ["fr", "nl", "en"];

/** Pull one part's decoded content out of a built message. */
function part(message: string, type: string): string {
  const re = new RegExp(
    `Content-Type: ${type}; charset="utf-8"\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([\\s\\S]*?)\\r\\n\\r\\n--`,
  );
  const m = re.exec(message);
  expect(m, `no ${type} part`).not.toBeNull();
  return Buffer.from(m![1]!.replace(/\r\n/g, ""), "base64").toString("utf8");
}

describe("a subject may only hold ASCII (RFC 5322)", () => {
  it("leaves an ASCII subject exactly as it is", () => {
    expect(encodeHeader("Your Studens account is suspended")).toBe(
      "Your Studens account is suspended",
    );
  });

  /**
   * The bug this file was written for. Two French subjects carry an accent,
   * and both went into the header raw.
   */
  it("encodes the two French subjects that carry an accent", () => {
    for (const subject of ["Changement d'adresse demandé", "Votre compte a été supprimé"]) {
      const encoded = encodeHeader(subject);
      expect(encoded, subject).toMatch(/^=\?UTF-8\?B\?/);
      expect(encoded).not.toContain("é");
      // And it round-trips, which is the only thing a reader cares about.
      const decoded = encoded
        .split("\r\n ")
        .map((w) => Buffer.from(/=\?UTF-8\?B\?(.*)\?=/.exec(w)![1]!, "base64").toString("utf8"))
        .join("");
      expect(decoded).toBe(subject);
    }
  });

  it("splits by character, never through the middle of one", () => {
    // Every character is three bytes, so a byte-wise split would cut one in
    // half and produce two words that decode to nothing.
    const long = "é".repeat(60);
    const encoded = encodeHeader(long);
    const decoded = encoded
      .split("\r\n ")
      .map((w) => Buffer.from(/=\?UTF-8\?B\?(.*)\?=/.exec(w)![1]!, "base64").toString("utf8"))
      .join("");
    expect(decoded).toBe(long);
  });

  it("keeps every encoded word inside the 75 character limit", () => {
    for (const word of encodeHeader("é".repeat(80)).split("\r\n ")) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
  });
});

describe("the message a server receives", () => {
  const built = () =>
    mimeMessage({
      from: "relay@example.invalid",
      to: "someone@example.invalid",
      subject: "Votre compte a été supprimé",
      body: "First line.\n\nSecond paragraph.\n\nStudens\nAn independent project.",
      date: new Date("2026-09-19T20:00:00.000Z"),
      id: "fixed@studens",
    });

  it("carries the headers RFC 5322 requires and threading needs", () => {
    const m = built();
    expect(m).toContain("From: Studens <relay@example.invalid>");
    expect(m).toContain("To: someone@example.invalid");
    // Both were absent before, and both were being supplied as a favour by
    // whichever submission server happened to be in front.
    expect(m).toMatch(/Date: .+\+0000/);
    expect(m).toContain("Message-ID: <fixed@studens>");
  });

  it("offers the plain text first and the HTML second", () => {
    const m = built();
    expect(m).toContain("multipart/alternative");
    // Order is the standard's way of saying which is the fallback. A client
    // that prefers text must find ours rather than a stripped HTML.
    expect(m.indexOf('text/plain')).toBeLessThan(m.indexOf('text/html'));
  });

  it("says the same thing in both parts", () => {
    const m = built();
    const text = part(m, "text/plain");
    expect(text).toContain("First line.");
    expect(text).toContain("Second paragraph.");

    const html = part(m, "text/html");
    expect(html).toContain("First line.");
    expect(html).toContain("Second paragraph.");
  });

  it("base64s both parts, so no line can be truncated or end the message", () => {
    const m = built();
    for (const line of m.split("\r\n")) expect(line.length).toBeLessThanOrEqual(998);
    expect((m.match(/Content-Transfer-Encoding: base64/g) ?? []).length).toBe(2);
  });

  it("closes the multipart body, with a boundary a header can hold", () => {
    const m = built();
    // The id becomes the boundary with everything a boundary may not contain
    // stripped, so `fixed@studens` gives `studens-fixedstudens`.
    expect(m).toContain('boundary="studens-fixedstudens"');
    expect(m.trimEnd().endsWith("--studens-fixedstudens--")).toBe(true);
  });
});

describe("the HTML part is a rendering of the text, not a second copy", () => {
  it("has no image, no remote asset and therefore nowhere for a pixel", () => {
    const html = textToHtml("A line.\n\nStudens\nAn independent project.");
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/@import/i);
  });

  it("escapes what the text contains rather than trusting it", () => {
    const html = textToHtml("Reason: <script>alert(1)</script> & co\n\nStudens\nx.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("puts the last block in a footer, because that is the signature", () => {
    const html = textToHtml("Body.\n\nStudens\nAn independent project.");
    expect(html).toContain("<hr");
    expect(html.indexOf("<hr")).toBeLessThan(html.indexOf("An independent project."));
    expect(html.indexOf("Body.")).toBeLessThan(html.indexOf("<hr"));
  });

  it("survives a message that is a single block", () => {
    const html = textToHtml("Only this.");
    expect(html).toContain("Only this.");
    expect(html).not.toContain("<hr");
  });
});

/**
 * The footer rule above assumes the signature is the last block. It is, by
 * construction, because renderMail appends it. Checked rather than assumed,
 * for every template in every language.
 */
describe("every rendered message ends with its signature", () => {
  for (const kind of TEMPLATED_KINDS) {
    for (const locale of LOCALES) {
      it(`${kind} in ${locale}`, () => {
        const { body } = renderMail(kind, locale, {
          url: "https://example.invalid/x",
          to: "a@example.invalid",
          reason: "R",
        });
        const last = body.trim().split(/\n\s*\n/).pop()!;
        expect(last).toMatch(/^Studens\n/);
      });
    }
  }
});
