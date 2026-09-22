/**
 * Drain the outbox. FR-H5.
 *
 *   npm run mail            # send what is queued, once
 *   npm run mail -- --watch # keep going, every 30 seconds
 *
 * WHY A QUEUE AND NOT A SEND INSIDE THE REQUEST. A relay that is slow or down
 * must not make a submission hang or a deletion fail, and a moderation decision
 * must not be lost because mail bounced. The row is the unit of retry, and it
 * survives a restart because it is in the database rather than in memory.
 *
 * NO DEPENDENCY, AND NO VENDOR. Delivery is plain SMTP over a socket, spoken
 * directly, because zero budget rules out the paid tiers and every free tier
 * lapses (FR-H6). The relay's address is configuration; nothing here knows who
 * provides it. That also keeps `nodemailer` and its transitive tree out of a
 * project whose dependency list is currently five packages.
 *
 * WITH NO RELAY CONFIGURED IT PRINTS INSTEAD OF SENDING, and says so loudly on
 * every run. That is the development path, and it is deliberately not silent:
 * an absence is invisible unless something prints it, which is the lesson from
 * LESSONS.md section 9 and the reason sign-in prints its provider list.
 */
import { createConnection, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { PrismaClient } from "@prisma/client";
import { mailRelayConfigured } from "@studens/platform";
import { loadDotEnv } from "./env.js";
import { renderMail } from "./mail-templates.js";
import { mimeMessage } from "./mime.js";
import { LOGO_BASE64, LOGO_CID, LOGO_NAME, LOGO_TYPE } from "./logo.js";

const BATCH = 25;
/** After this many failures a row is left alone, to be looked at by a person. */
const MAX_ATTEMPTS = 5;

interface Relay {
  host: string;
  port: number;
  /** Absent where the relay does not ask for credentials, which is normal. */
  user: string | undefined;
  pass: string | undefined;
  from: string;
}

function relay(): Relay | null {
  // `mailRelayConfigured` asks the same question for the API, which has to
  // know whether a queued message can ever leave before it tells somebody one
  // is on its way. One function, so the promise and the delivery agree.
  if (!mailRelayConfigured()) return null;
  const host = process.env["STUDENS_SMTP_HOST"]!;
  const from = process.env["STUDENS_MAIL_FROM"]!;
  return {
    host,
    port: Number(process.env["STUDENS_SMTP_PORT"] ?? 587),
    user: process.env["STUDENS_SMTP_USER"],
    pass: process.env["STUDENS_SMTP_PASS"],
    from,
  };
}

/** Read one SMTP reply, which may span several lines. */
function reply(socket: Socket | TLSSocket): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      // A final line has a space after the code; a continuation has a hyphen.
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        socket.off("data", onData);
        socket.off("error", reject);
        resolve({ code: Number(last.slice(0, 3)), text: buffer });
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function say(
  socket: Socket | TLSSocket,
  line: string,
  expect: number[],
): Promise<{ code: number; text: string }> {
  socket.write(`${line}\r\n`);
  const res = await reply(socket);
  if (!expect.includes(res.code)) {
    throw new Error(`SMTP said ${res.code} to ${line.split(" ")[0]}: ${res.text.trim()}`);
  }
  return res;
}

/**
 * Dot-stuffing: a line that is a single dot would otherwise end the message.
 *
 * It splits on `\r?\n` rather than on `\n`. The message now arrives with CRLF
 * endings already, and splitting that on `\n` alone leaves a carriage return
 * on the end of every line, which the join then turns into `\r\r\n`. Harmless
 * looking, and enough to make a strict server reject the whole message.
 *
 * In practice base64 bodies cannot produce a leading dot at all, since the
 * alphabet excludes it. The header block can, in a subject, so this stays.
 */
function stuff(body: string): string {
  return body
    .split(/\r?\n/)
    .map((l) => (l.startsWith(".") ? `.${l}` : l))
    .join("\r\n");
}

async function deliver(r: Relay, to: string, subject: string, body: string): Promise<void> {
  const plain = createConnection({ host: r.host, port: r.port });
  await new Promise<void>((res, rej) => {
    plain.once("connect", () => res());
    plain.once("error", rej);
  });
  await reply(plain);
  await say(plain, `EHLO ${r.host}`, [250]);
  // STARTTLS always. A relay that cannot do it is one that would carry an
  // address and a confirmation link in the clear, which is worse than not
  // sending at all.
  await say(plain, "STARTTLS", [220]);
  const socket = tlsConnect({ socket: plain, servername: r.host });
  await new Promise<void>((res, rej) => {
    socket.once("secureConnect", () => res());
    socket.once("error", rej);
  });

  try {
    await say(socket, `EHLO ${r.host}`, [250]);
    if (r.user && r.pass) {
      await say(socket, "AUTH LOGIN", [334]);
      await say(socket, Buffer.from(r.user).toString("base64"), [334]);
      await say(socket, Buffer.from(r.pass).toString("base64"), [235]);
    }
    await say(socket, `MAIL FROM:<${r.from}>`, [250]);
    await say(socket, `RCPT TO:<${to}>`, [250, 251]);
    await say(socket, "DATA", [354]);
    // The message itself is built in mime.ts, which knows nothing about
    // sockets and is therefore testable without one. Everything that used to
    // be assembled inline here, including a subject written raw into a header
    // that may only hold ASCII, lives there now.
    const message = mimeMessage({
      from: r.from,
      to,
      subject,
      body,
      // Attached, never fetched. See the note on `logo.ts`.
      logo: { cid: LOGO_CID, type: LOGO_TYPE, name: LOGO_NAME, base64: LOGO_BASE64 },
    });
    await say(socket, `${stuff(message)}\r\n.`, [250]);
    await say(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
    plain.destroy();
  }
}

export async function drainOnce(prisma: PrismaClient): Promise<{ sent: number; failed: number }> {
  const r = relay();
  const due = await prisma.mailOutbox.findMany({
    where: { sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    const { subject, body } = renderMail(row.kind, row.locale, row.payload as object);
    try {
      if (r) {
        await deliver(r, row.toAddress, subject, body);
      } else {
        // The development path. Printed in full so the confirmation link in it
        // can be clicked, which is how the email change is testable with no
        // relay at all.
        console.log(
          `\n--- mail (NOT SENT, no relay configured) ---\n` +
            `to: ${row.toAddress}\nsubject: ${subject}\n\n${body}\n---\n`,
        );
      }
      await prisma.mailOutbox.update({
        where: { id: row.id },
        data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      sent += 1;
    } catch (err) {
      // The row stays unsent and is retried, up to MAX_ATTEMPTS. The error is
      // kept on the row rather than only logged, so a stuck queue can be
      // understood without digging through process output.
      await prisma.mailOutbox.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        },
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

const isEntry = process.argv[1]?.endsWith("send-mail.js") ?? false;
if (isEntry) {
  loadDotEnv();
  const prisma = new PrismaClient();
  const watch = process.argv.includes("--watch");

  if (!relay()) {
    console.warn(
      "\n  !!  NO MAIL RELAY CONFIGURED. Messages are printed, not sent.\n" +
        "      Set STUDENS_SMTP_HOST and STUDENS_MAIL_FROM to deliver them.\n",
    );
  }

  const run = async () => {
    const { sent, failed } = await drainOnce(prisma);
    if (sent || failed) console.log(`mail: ${sent} sent, ${failed} failed`);
  };

  if (watch) {
    void (async () => {
      for (;;) {
        await run().catch((e: unknown) => console.error("mail worker", e));
        await new Promise((r) => setTimeout(r, 30_000));
      }
    })();
  } else {
    run()
      .catch((e: unknown) => {
        console.error(e);
        process.exitCode = 1;
      })
      .finally(() => void prisma.$disconnect());
  }
}
