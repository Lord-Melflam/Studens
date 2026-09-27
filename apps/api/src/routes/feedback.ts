/**
 * Taking feedback about Studens itself. FR-I1.
 *
 * PUBLIC ON PURPOSE, and for a different reason from the notice endpoint next
 * door. That one is public because the DSA requires it to be. This one is
 * public because the public link is going on social media, and the person who
 * arrives, cannot work out how to search a course and leaves is the one whose
 * opinion is worth most. They will not make an account to tell us. A form
 * behind a sign-in collects feedback only from people who already liked it
 * enough to sign in, which is the sample that flatters and teaches least.
 *
 * A POST, so feedback cannot be submitted by a link somebody clicks. The
 * session cookie is SameSite=Lax and travels on a cross-site top-level GET.
 *
 * NOTHING ABOUT THE SENDER IS RECORDED beyond a member id when they happen to
 * be signed in. See the migration for what is deliberately not a column.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import {
  FEEDBACK_KINDS,
  FeedbackInvalid,
  MESSAGE_MAX,
  MESSAGE_MIN,
  submitFeedback,
} from "@studens/platform";
import { identifyIfAny } from "../identity.js";

/**
 * AN OPEN WRITE ENDPOINT NEEDS A CEILING, and this one cannot use the ceiling
 * the rest of the product uses. `MemberQuota` counts against a member record
 * (FR-C4), and most senders here have no member record at all.
 *
 * IN MEMORY, AND DELIBERATELY NOT IN THE DATABASE. Counting per address means
 * holding addresses, and an address is personal data: writing one to a table
 * would make this the one place in Studens that keeps a record of where
 * somebody was when they did something, which the session list already refuses
 * to do (FR-A5) and the migration refuses again. Held in a process that
 * forgets it on restart, it is a speed bump that stores nothing, which is
 * honestly all it is. It stops a bored person pasting the same thing fifty
 * times; it does not stop anybody determined, and must never be described as
 * though it does (OPEN-35 makes the same point about the quota).
 *
 * THE LIMITER ITSELF IS A LIST THAT CAN GROW, which is NFR-O4 pointed at a
 * Map rather than at a page. One entry per address seen in the window is
 * unbounded if nothing ever removes them, so expired entries are swept on
 * write and the map has a hard ceiling: past it, the oldest go. A full map
 * degrades to "some callers are not counted", never to memory exhaustion.
 */
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 5;
const MAX_TRACKED = 5000;
const seen = new Map<string, { count: number; until: number }>();

/**
 * TWO FUNCTIONS, NOT ONE, and the split is the whole correctness of this.
 *
 * A single "count this request" call charges the caller for every attempt,
 * including the ones the form rejected. Somebody who types two words, is told
 * it is too short, tries again and is told the same, has then spent half their
 * allowance on being helped. Three more fumbles and the form stops answering
 * them for ten minutes, which is a punishment for using it badly rather than
 * for abusing it. Measured on the real endpoint before it was split: three
 * malformed attempts moved the counter from 0 to 3.
 *
 * So `atCeiling` only looks, and `record` is called once something is actually
 * stored. A malformed request costs a parse and a 400 and nothing else, which
 * the 64kb body limit already bounds.
 */
function atCeiling(key: string, now: number): boolean {
  for (const [k, v] of seen) {
    if (v.until <= now) seen.delete(k);
  }
  const found = seen.get(key);
  return found !== undefined && found.until > now && found.count >= PER_WINDOW;
}

function record(key: string, now: number): void {
  const found = seen.get(key);
  if (found && found.until > now) {
    found.count += 1;
    return;
  }
  if (seen.size >= MAX_TRACKED) {
    const oldest = seen.keys().next();
    if (!oldest.done) seen.delete(oldest.value);
  }
  seen.set(key, { count: 1, until: now + WINDOW_MS });
}

/** Exposed so a test can drive the window without waiting ten minutes. */
export function resetFeedbackWindow(): void {
  seen.clear();
}

export function feedbackRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "64kb" }));

  /** What the form needs to draw itself, so the kinds live in one place. */
  router.get("/feedback/form", (_req, res) => {
    res.json({ kinds: FEEDBACK_KINDS, min: MESSAGE_MIN, max: MESSAGE_MAX });
  });

  router.post("/feedback", (req, res) => {
    void (async () => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { kind, message, contactEmail, route, locale } = body;

      for (const [name, value] of Object.entries({ kind, message })) {
        if (typeof value !== "string" || value === "") {
          res.status(400).json({ error: "invalid", field: name });
          return;
        }
      }
      for (const [name, value] of Object.entries({ contactEmail, route, locale })) {
        if (value !== undefined && value !== null && typeof value !== "string") {
          res.status(400).json({ error: "invalid", field: name });
          return;
        }
      }

      // `req.ip` respects Express's trust proxy setting, which is what makes
      // this work behind the tunnel instead of counting every caller as one.
      const key = req.ip ?? "unknown";
      if (atCeiling(key, Date.now())) {
        // 429 with no detail about the window. Saying "try again in 7 minutes"
        // tells somebody probing exactly how to pace themselves.
        res.status(429).json({ error: "too-many" });
        return;
      }

      // Signed in or not: both are allowed, and which one it is decides only
      // whether the row carries a member.
      const who = await identifyIfAny(prisma, req);

      try {
        await submitFeedback(
          {
            kind: kind as string,
            message: message as string,
            contactEmail: (contactEmail as string | undefined) ?? null,
            route: (route as string | undefined) ?? null,
            locale: (locale as string | undefined) ?? null,
          },
          { client: prisma, memberId: who?.memberId ?? null },
        );
        // Charged only now, for something that was stored. A rejected form is
        // not an abuse of the endpoint.
        record(key, Date.now());

        // 202: received, and a person will read it. Not 201, because nothing
        // was created that the sender can go and look at, and no response time
        // is promised.
        res.status(202).json({ received: true });
      } catch (err) {
        if (err instanceof FeedbackInvalid) {
          res.status(400).json({ error: "invalid", field: err.field, problem: err.problem });
          return;
        }
        throw err;
      }
    })().catch(() => res.status(500).json({ error: "failed" }));
  });

  return router;
}
