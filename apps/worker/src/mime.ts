/**
 * Turning a rendered message into something an SMTP server will accept.
 *
 * WHY THIS IS ITS OWN FILE. `send-mail.ts` speaks the protocol: sockets,
 * STARTTLS, verbs and reply codes. What a message looks like once it arrives
 * is a separate question with separate rules, and it is the half that can be
 * tested without a network. Splitting them means the format is checked by
 * assertions rather than by somebody reading their inbox.
 *
 * THREE THINGS WERE WRONG BEFORE THIS EXISTED, and two of them were not
 * cosmetic.
 *
 * The subject was written straight into the header. Headers are ASCII (RFC
 * 5322); a subject is not. "Changement d'adresse demandé" and "Votre compte a
 * été supprimé" both carry an accent, so both arrived mangled or were refused,
 * and nobody noticed because the message that was tested happened to be
 * English.
 *
 * There was no `Date` and no `Message-ID`. `Date` is mandatory in RFC 5322 and
 * `Message-ID` is what every threading and deduplication mechanism keys on.
 * Some submission servers add them; relying on that is relying on a favour.
 *
 * And the body went out as text/plain and nothing else, which is a defensible
 * choice for a receipt and a bad one for the message telling somebody their
 * account is suspended. A bare wall of text from an address nobody recognises
 * is the exact shape of a phishing mail, and for many people that message is
 * the only notice they will get.
 *
 * WHAT DID NOT CHANGE, because it is the reason the plain-text rule existed:
 * there is no image, no external stylesheet, no web font, no link that is not
 * already in the text, and therefore nowhere to put a tracking pixel. The HTML
 * part is a rendering of the plain part and never says anything the plain part
 * does not. The plain part remains first in the message, which is what a
 * client that prefers text will show.
 */

/** The only characters allowed unencoded in a header value. */
const ASCII = /^[\x20-\x7E]*$/;

/**
 * RFC 2047, base64 flavour: `=?UTF-8?B?...?=`.
 *
 * An encoded word may be 75 characters including the markers, so the payload
 * is chunked. It is chunked by CODE POINT and not by byte, because splitting a
 * multi-byte character across two words produces two invalid ones, and the
 * accented characters that make encoding necessary are exactly the ones that
 * are multi-byte.
 */
export function encodeHeader(value: string): string {
  if (ASCII.test(value)) return value;
  const words: string[] = [];
  let chunk = "";
  const flush = () => {
    if (chunk === "") return;
    words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
    chunk = "";
  };
  for (const ch of value) {
    // 75 minus `=?UTF-8?B?` and `?=`, converted from base64 length to bytes.
    const next = chunk + ch;
    if (Buffer.byteLength(next, "utf8") > 45) flush();
    chunk += ch;
  }
  flush();
  // Folded with a space between words, which is how a decoder is told they
  // belong to one value.
  return words.join("\r\n ");
}

/** Base64, wrapped at 76 characters, as a MIME body part must be. */
function base64Body(text: string): string {
  const raw = Buffer.from(text, "utf8").toString("base64");
  return (raw.match(/.{1,76}/g) ?? []).join("\r\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The HTML part, derived from the plain part rather than written beside it.
 *
 * ONE SOURCE OF WORDS. A second set of templates would be two things to keep
 * in step, and the day they disagree is the day somebody is told two different
 * reasons for the same decision. So the text is the source and this is a
 * rendering of it: blank line separated blocks become paragraphs, and the last
 * block, which is always the signature, becomes a footer.
 *
 * That the signature is last is guaranteed by `renderMail`, which appends it,
 * and is checked by a test rather than assumed.
 *
 * Inline styles only. Gmail and Outlook both strip or ignore a `<style>` block
 * in cases that are hard to predict, and a layout that depends on one degrades
 * into something worse than no styling at all.
 */
export function textToHtml(text: string): string {
  const blocks = text.trim().split(/\n\s*\n/);
  const signature = blocks.length > 1 ? blocks.pop()! : null;

  const p = (block: string) =>
    `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;

  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "</head>",
    '<body style="margin:0;padding:24px 16px;background:#fbfbfc;' +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
      'color:#16191d">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe3e8;' +
      'border-radius:12px;padding:28px 28px 20px">',
    // The wordmark is text. An image would need somewhere to be hosted, and a
    // remote image in a mail is a read receipt whether or not it is meant as
    // one.
    '<div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0 0 20px">Stud&#275;ns</div>',
    blocks.map(p).join("\n"),
    signature
      ? '<hr style="border:0;border-top:1px solid #dfe3e8;margin:24px 0 16px">' +
        `<div style="font-size:13px;line-height:1.5;color:#5b6470">${escapeHtml(signature).replace(/\n/g, "<br>")}</div>`
      : "",
    "</div></body></html>",
  ].join("\n");
}

export interface Message {
  from: string;
  to: string;
  subject: string;
  /** The rendered plain text, signature included. */
  body: string;
  /** Injected so a test can assert on them. */
  date?: Date;
  id?: string;
}

/**
 * The whole message: headers, a blank line, and two alternative bodies.
 *
 * `multipart/alternative` with text first. The order is the standard's way of
 * saying which part is the fallback and which is preferred, and it means a
 * client that shows text shows ours rather than a stripped approximation of
 * the HTML.
 */
export function mimeMessage(m: Message): string {
  const date = m.date ?? new Date();
  const boundary = `studens-${(m.id ?? String(date.getTime())).replace(/[^\w.-]/g, "")}`;
  const id = m.id ?? `${date.getTime()}.${Math.random().toString(36).slice(2)}@studens`;
  const text = m.body;

  const headers = [
    // A display name, because a bare relay address in a From line tells a
    // reader nothing about who is writing to them, and the relay is whatever
    // mailbox this installation was given.
    `From: Studens <${m.from}>`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${id}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    // Nothing in this product's mail is worth tracking, and a recipient who
    // replies should reach a person rather than a void.
    "Auto-Submitted: auto-generated",
  ];

  const part = (type: string, content: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="utf-8"`,
      // Base64 throughout: it carries any byte, it cannot produce a line
      // beginning with a dot, and it cannot produce a line over the 998
      // character limit. Both of those are ways a message is silently truncated
      // rather than rejected.
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(content),
      "",
    ].join("\r\n");

  return [
    headers.join("\r\n"),
    "",
    part("text/plain", text),
    part("text/html", textToHtml(text)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
