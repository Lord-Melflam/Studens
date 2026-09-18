/**
 * The member's own record, and the list they choose an institution from.
 *
 * FR-F4 to FR-F14. Three routes and no more: the first run is a sequence of
 * screens over ONE resource, not a wizard endpoint per step. A step is a value
 * in `onboardingStep`, so the browser can be closed on screen three and reopened
 * there (FR-F5) without the server holding any per-client state.
 *
 * Everything that writes is a PATCH with only the fields that screen owns, so a
 * later screen cannot silently blank an earlier one and a reload cannot replay
 * a whole profile over a newer edit.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import {
  TEXT_LIMITS,
  TextInvalid,
  checkFreeText,
  UsernameInvalid,
  readProfile,
  writeProfile,
  institutionsOf,
  addInstitution,
  removeInstitution,
  type ProfilePatch,
} from "@studens/platform";
import { listInstitutions } from "@studens/ref";
import { identify, identifyIfAny } from "../identity.js";

/** The languages the platform speaks. Kept here so a bad value cannot be stored. */
const LOCALES = new Set(["fr", "nl", "en"]);

/**
 * What a PATCH body may contain.
 *
 * Written out rather than spread, because `prisma.member.update` takes whatever
 * object it is given: a body spread straight in could set `role` to `admin`.
 * An allowlist is the only version of this that is safe to read quickly.
 */
function patchFrom(body: unknown): ProfilePatch {
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: ProfilePatch = {};

  if ("username" in b) {
    if (typeof b["username"] !== "string") throw new BadRequest("username");
    patch.username = b["username"];
  }
  if ("locale" in b) {
    const v = b["locale"];
    if (v !== null && (typeof v !== "string" || !LOCALES.has(v))) throw new BadRequest("locale");
    patch.locale = v as string | null;
  }
  if ("institutionCode" in b) {
    const v = b["institutionCode"];
    if (v !== null && typeof v !== "string") throw new BadRequest("institutionCode");
    patch.institutionCode = v as string | null;
  }
  for (const key of ["studies", "interests"] as const) {
    if (key in b) {
      const v = b[key];
      if (v !== null && typeof v !== "string") throw new BadRequest(key);
      // Length and content are decided by `checkFreeText` in the platform, not
      // here, so the browser, this route and the write path cannot disagree
      // about what is acceptable. It throws TextInvalid with a reason, which
      // the handler turns into something the screen can actually say.
      patch[key] = v as string | null;
    }
  }
  if ("yearOfStudy" in b) {
    const v = b["yearOfStudy"];
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9)) {
      throw new BadRequest("yearOfStudy");
    }
    patch.yearOfStudy = v as number | null;
  }
  if ("onboardingStep" in b) {
    const v = b["onboardingStep"];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 9) {
      throw new BadRequest("onboardingStep");
    }
    patch.onboardingStep = v;
  }
  if ("onboardedAt" in b) {
    if (typeof b["onboardedAt"] !== "boolean") throw new BadRequest("onboardedAt");
    patch.onboardedAt = b["onboardedAt"];
  }
  return patch;
}

/**
 * Which field the rules refused.
 *
 * `checkFreeText` reports what is wrong, not where: it is given one string at a
 * time and has no idea what it is called. Rather than thread a name through it,
 * the patch is re-checked here to find the offender, which is two string tests
 * on a request that is already failing.
 */
function textFieldOf(patch: ProfilePatch, err: TextInvalid): string {
  for (const key of ["studies", "interests"] as const) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    try {
      checkFreeText(value, TEXT_LIMITS[key]);
    } catch {
      return key;
    }
  }
  // Should not happen: something threw and nothing re-throws. Naming the reason
  // is still better than naming nothing.
  return err.reason;
}

class BadRequest extends Error {
  constructor(readonly field: string) {
    super(`bad field: ${field}`);
    this.name = "BadRequest";
  }
}

/**
 * Whether a code names an institution somebody may choose today.
 *
 * FR-F11: every institution is listed and only the ingested ones are
 * selectable. Choosing one whose catalogue has not been loaded scopes the
 * browse screen to a catalogue that is not there, and the screen has no way to
 * tell that from a filter that happens to match nothing.
 *
 * One function because there are two ways in, the first run's PATCH and the
 * browse screen's POST, and the second was written without the check: it
 * accepted `kuleuven` and left the member scoped to an empty catalogue. Two
 * copies of a rule is how that happens again.
 */
async function selectable(prisma: PrismaClient, code: string): Promise<boolean> {
  const known = await listInstitutions({ client: prisma });
  return known.some((i) => i.code === code && i.available);
}

export function profileRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "4kb" }));

  /**
   * FR-F12: every institution, with only the available ones selectable.
   *
   * Public, and deliberately so. It is a list of Belgian institutions, it says
   * nothing about any member, and the sign-in page needs it before there is a
   * session to check.
   */
  /**
   * The member's own set: which catalogues they want in front of them.
   *
   * Separate from `/institutions`, which lists what exists. This is a
   * preference about the member, so it lives in the platform beside the rest of
   * their profile and RYC reads it rather than storing its own copy (FR-B11).
   */
  /**
   * `identifyIfAny`, NOT `identify`, because this is a read.
   *
   * `identify` issues a session when the development identity is on, so with
   * it here every signed-out page load of the browse screen created a member
   * and set a cookie, and a visitor with no account was answered with
   * somebody's preference. The screen believed it: it scoped the catalogue to
   * UCLouvain and showed 690 programmes of 976 to a visitor who had never
   * chosen anything.
   *
   * 401 and not an empty list. The client reads the two differently, as null
   * against an empty set, and only null means "nobody has told us", which is
   * the state that must leave the catalogue whole.
   */
  router.get("/me/institutions", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      res.json({ institutions: await institutionsOf(prisma, who.memberId) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.post("/me/institutions", (req, res) => {
    void (async () => {
      const who = await identify(prisma, req, res);
      if (!who) return;
      const code = (req.body ?? {}).code as unknown;
      if (typeof code !== "string" || code.trim() === "") {
        res.status(400).json({ error: "invalid", field: "code" });
        return;
      }
      const wanted = code.trim().toLowerCase();
      if (!(await selectable(prisma, wanted))) {
        res.status(400).json({ error: "invalid", field: "code" });
        return;
      }
      res.json({ institutions: await addInstitution(prisma, who.memberId, wanted) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.delete("/me/institutions/:code", (req, res) => {
    void (async () => {
      const who = await identify(prisma, req, res);
      if (!who) return;
      res.json({ institutions: await removeInstitution(prisma, who.memberId, req.params.code) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.get("/institutions", (_req, res) => {
    void (async () => {
      res.json({ institutions: await listInstitutions({ client: prisma }) });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.get("/profile", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      const profile = await readProfile(prisma, who.memberId);
      if (!profile) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      // FR-A12: both addresses, so the panel can show which one it may edit.
      const addresses = await prisma.member.findUnique({
        where: { id: who.memberId },
        select: { providerEmail: true, contactEmail: true, contactVerifiedAt: true },
      });
      res.json({
        username: profile.username,
        locale: profile.locale,
        institutionCode: profile.institutionCode,
        studies: profile.studies,
        yearOfStudy: profile.yearOfStudy,
        interests: profile.interests,
        onboarded: profile.onboardedAt !== null,
        onboardingStep: profile.onboardingStep,
        // FR-A9 again, so the first run can show what it knows without a second
        // call. Evidence of an address, never proof of enrolment.
        emailDomain: who.emailDomain,
        providerEmail: addresses?.providerEmail ?? null,
        contactEmail: addresses?.contactEmail ?? null,
        contactVerified: addresses?.contactVerifiedAt !== null,
      });
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  router.patch("/profile", (req, res) => {
    void (async () => {
      const who = await identifyIfAny(prisma, req);
      if (!who) {
        res.status(401).json({ error: "sign in required" });
        return;
      }

      let patch: ProfilePatch;
      try {
        patch = patchFrom(req.body);
      } catch (err) {
        res.status(400).json({ error: "invalid", field: (err as BadRequest).field });
        return;
      }

      // FR-F13: the institution is self-declared, so it is checked against the
      // list for shape only. It sets no tenant and grants nothing: the tenant
      // comes from the provider domain, and saying "KU Leuven" here does not
      // make anyone a KU Leuven member.
      if (patch.institutionCode && !(await selectable(prisma, patch.institutionCode))) {
        res.status(400).json({ error: "invalid", field: "institutionCode" });
        return;
      }

      // FR-F6: finishing needs a username, and nothing else.
      if (patch.onboardedAt === true) {
        const current = await readProfile(prisma, who.memberId);
        const willHave = patch.username ?? current?.username ?? null;
        if (!willHave) {
          res.status(400).json({ error: "invalid", field: "username" });
          return;
        }
      }

      try {
        const saved = await writeProfile(prisma, who.memberId, patch);
        res.json({
          username: saved.username,
          locale: saved.locale,
          institutionCode: saved.institutionCode,
          studies: saved.studies,
          yearOfStudy: saved.yearOfStudy,
          interests: saved.interests,
          onboarded: saved.onboardedAt !== null,
          onboardingStep: saved.onboardingStep,
        });
      } catch (err) {
        if (err instanceof UsernameInvalid) {
          res.status(409).json({ error: "username", reason: err.reason });
          return;
        }
        if (err instanceof TextInvalid) {
          // The field AND the reason. "invalid" on its own is what left
          // somebody staring at a button that would not move.
          res.status(400).json({
            error: "text",
            field: textFieldOf(patch, err),
            reason: err.reason,
            max: err.max,
          });
          return;
        }
        throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
