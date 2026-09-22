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
import {
  encodeHeader,
  mimeMessage,
  textToHtml,
  renderMail,
  TEMPLATED_KINDS,
  LOGO_BASE64,
  LOGO_CID,
  LOGO_NAME,
  LOGO_TYPE,
} from "@studens/worker";

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

/**
 * The shape `send-mail.ts` actually builds, which is the one that reaches a
 * person. Everything above it tests the message without a logo, and that is
 * no longer the message anybody receives.
 */
describe("with the mark attached, the message nests correctly", () => {
  const logo = { cid: LOGO_CID, type: LOGO_TYPE, name: LOGO_NAME, base64: LOGO_BASE64 };
  const built = () =>
    mimeMessage({
      from: "relay@example.invalid",
      to: "someone@example.invalid",
      subject: "Votre compte Studens est suspendu",
      body: "Motif.\n\nStudens\nAn independent project.",
      date: new Date("2026-09-22T09:00:00.000Z"),
      id: "fixed@studens",
      logo,
    });

  it("wraps the alternative in related, rather than replacing it", () => {
    const m = built();
    expect(m).toContain('Content-Type: multipart/related; type="multipart/alternative"');
    expect(m).toContain("Content-Type: multipart/alternative");
    // Text first inside the alternative, still. A client that does not
    // understand `related` finds the alternative inside it and still prefers
    // the part we wrote over a stripped rendering of the HTML.
    expect(m.indexOf("text/plain")).toBeLessThan(m.indexOf("text/html"));
    expect(m.indexOf("multipart/alternative")).toBeLessThan(m.indexOf("text/plain"));
  });

  /**
   * Two nested multiparts sharing one delimiter is a message that ends at the
   * first inner terminator. It fails by truncating rather than by being
   * rejected, so nothing reports it and the reader simply loses the end.
   */
  it("gives the two multiparts different boundaries", () => {
    const boundaries = [...built().matchAll(/boundary="([^"]+)"/g)].map((x) => x[1]!);
    expect(boundaries).toHaveLength(2);
    expect(new Set(boundaries).size, "the nested parts share a delimiter").toBe(2);
  });

  it("closes both, innermost first", () => {
    const m = built();
    const [related, alternative] = [...m.matchAll(/boundary="([^"]+)"/g)].map((x) => x[1]!);
    expect(m).toContain(`--${alternative}--`);
    expect(m.trimEnd().endsWith(`--${related}--`)).toBe(true);
    expect(m.indexOf(`--${alternative}--`)).toBeLessThan(m.lastIndexOf(`--${related}--`));
  });

  it("attaches the mark inline, with the id the HTML refers to", () => {
    const m = built();
    expect(m).toContain("Content-Type: image/png");
    // Angle brackets in the header, bare in the URL. Getting that backwards is
    // how an inline image silently becomes an attachment nobody asked for.
    expect(m).toContain(`Content-ID: <${LOGO_CID}>`);
    expect(m).toContain(`Content-Disposition: inline; filename="${LOGO_NAME}"`);
    // Decoded, because the HTML part is base64 like every other body: the cid
    // is not literally in the bytes a server sees.
    expect(part(m, "text/html")).toContain(`src="cid:${LOGO_CID}"`);
  });

  it("wraps the image base64 like every other body, at 76 characters", () => {
    for (const line of built().split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(998);
    }
    const body = built().split(`Content-Disposition: inline`)[1]!;
    for (const line of body.split("\r\n").filter((l) => /^[A-Za-z0-9+/=]+$/.test(l))) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it("sends an image that is a real PNG of the size the HTML claims", () => {
    const bytes = Buffer.from(LOGO_BASE64, "base64");
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    // 96 square, drawn at 40, so it stays sharp where the screen doubles it.
    expect(bytes.readUInt32BE(16)).toBe(96);
    expect(bytes.readUInt32BE(20)).toBe(96);
    // Small enough that it costs nothing per message. A signature that adds
    // real weight to a suspension notice is a signature not worth having.
    expect(bytes.length).toBeLessThan(8 * 1024);
  });

  it("puts nothing remote anywhere in the whole message", () => {
    const m = built();
    // The one place a URL legitimately appears is a confirmation link in the
    // body, and this fixture has none, so the whole message may be checked.
    expect(m).not.toMatch(/https?:\/\//);
  });
});

describe("the HTML part is a rendering of the text, not a second copy", () => {
  /**
   * THE RULE SHARPENED, AND WHY IT HAD TO BE.
   *
   * This used to assert `not.toMatch(/<img/)`, which is not the property
   * anybody wanted. The property is that opening a message asks nobody for
   * anything: a mail that fetches an image from a server is a read receipt
   * whether or not it was meant as one, and it reports the time, the address
   * and roughly the place it was opened. An image ATTACHED to the message is
   * already in the client before it is opened and reports nothing.
   *
   * The old assertion also stopped describing what is sent the moment a logo
   * was attached, because it only ever looked at the no-logo call. A test that
   * passes while the real message does something else is worse than no test,
   * so the sender's actual shape is asserted below as well.
   */
  it("carries nothing remote, with or without the mark", () => {
    for (const html of [
      textToHtml("A line.\n\nStudens\nAn independent project."),
      textToHtml("A line.\n\nStudens\nAn independent project.", LOGO_CID),
    ]) {
      expect(html, "a remote reference is a read receipt").not.toMatch(/https?:\/\//);
      expect(html).not.toMatch(/<link/i);
      expect(html).not.toMatch(/@import/i);
      expect(html).not.toMatch(/url\(/i);
      // Every src in the document, whatever it is, must be a cid.
      for (const [, src] of html.matchAll(/src="([^"]*)"/g)) {
        expect(src, "an image src that is not a cid leaves the message").toMatch(/^cid:/);
      }
    }
  });

  it("draws no image at all when it is not given one", () => {
    const html = textToHtml("A line.\n\nStudens\nAn independent project.");
    expect(html).not.toMatch(/<img/i);
  });

  it("refers to the attached mark exactly once when it is", () => {
    const html = textToHtml("A line.\n\nStudens\nAn independent project.", LOGO_CID);
    expect((html.match(/<img/gi) ?? []).length).toBe(1);
    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    // Most clients block images by default, so the alt text is what the
    // majority of recipients read. It has to be a word, not "logo".
    expect(html).toContain('alt="Studens"');
    // Sized in the attributes as well as the style, because Outlook on Windows
    // renders through Word and takes the attributes.
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
  });

  it("keeps the mark out of the message and in the signature", () => {
    const html = textToHtml("Body text.\n\nStudens\nAn independent project.", LOGO_CID);
    expect(html.indexOf("Body text.")).toBeLessThan(html.indexOf("<img"));
    expect(html.indexOf("<hr")).toBeLessThan(html.indexOf("<img"));
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
