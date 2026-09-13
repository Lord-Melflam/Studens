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
import { UsernameInvalid, readProfile, writeProfile, type ProfilePatch } from "@studens/platform";
import { listInstitutions } from "@studens/ref";
import { identifyIfAny } from "../identity.js";

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
      // Free text, so it is bounded here. The column is unbounded TEXT and the
      // body limit is 4kb, but neither is a statement about what this means.
      if (typeof v === "string" && v.length > 120) throw new BadRequest(key);
      patch[key] = v === null ? null : (v as string).trim() || null;
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

class BadRequest extends Error {
  constructor(readonly field: string) {
    super(`bad field: ${field}`);
    this.name = "BadRequest";
  }
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
      if (patch.institutionCode) {
        const known = await listInstitutions({ client: prisma });
        const match = known.find((i) => i.code === patch.institutionCode);
        if (!match || !match.available) {
          res.status(400).json({ error: "invalid", field: "institutionCode" });
          return;
        }
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
        throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
