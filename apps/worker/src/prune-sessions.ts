/**
 * Delete sessions that can never authenticate anybody again.
 *
 *   npm run prune           # once
 *   npm run prune -- --watch  # every six hours
 *
 * NFR-O4. THE TABLE ONLY GREW. `verifySession` refuses an expired row and
 * leaves it, `revokeSession` writes a timestamp rather than deleting, and
 * nothing anywhere removed one, so every session anybody had ever held was
 * still a row. It was noted as a gap on 2026-09-21 with a few hundred rows in
 * it, which is when a growth problem is cheap.
 *
 * IN THE WORKER, not in a request. It is a `deleteMany` over a whole table:
 * done inside a sign-in it would put an unbounded delete on the one path that
 * has to be fast, and a lock on the table everybody authenticates against.
 *
 * SIX HOURS, not thirty seconds like the mail drain. Nothing waits on this and
 * nothing is worse for the delay: the rows it removes were already refused by
 * `verifySession` before this ran. The point is that the table stops growing,
 * not that it is empty at any particular moment.
 */
import { PrismaClient } from "@prisma/client";
import { pruneSessions } from "@studens/platform";
import { loadDotEnv } from "./env.js";

const EVERY = 6 * 60 * 60 * 1000;

const isEntry = process.argv[1]?.endsWith("prune-sessions.js") ?? false;
if (isEntry) {
  loadDotEnv();
  const prisma = new PrismaClient();
  const watch = process.argv.includes("--watch");

  const run = async () => {
    const { deleted } = await pruneSessions({ client: prisma });
    // Printed even at zero when run by hand, because somebody running this is
    // asking a question and "nothing to do" is an answer. In watch mode a
    // silent tick is the normal case and saying so every six hours is noise.
    if (deleted > 0 || !watch) console.log(`sessions: ${deleted} removed`);
  };

  if (watch) {
    void (async () => {
      for (;;) {
        await run().catch((e: unknown) => console.error("prune worker", e));
        await new Promise((r) => setTimeout(r, EVERY));
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
