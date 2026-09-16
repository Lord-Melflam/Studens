/**
 * The notice and action endpoint. FR-E8, DSA Article 16.
 *
 * PUBLIC ON PURPOSE. Article 16 requires the mechanism to be accessible to "any
 * individual or entity", and requiring an account would narrow that to the
 * people who already joined. The person best placed to notice that a review
 * names them is the lecturer it names, who has no reason to have an account
 * here and every reason to be able to complain.
 *
 * THE COMPOSITION POINT, again. The platform stores notices and knows nothing
 * about reviews; RYC knows what a review is and holds no grant on the report
 * table. This file is the only place that knows both, exactly as it is for
 * usernames and for erasure.
 *
 * A POST, so a notice cannot be submitted by a link somebody clicks: the
 * session cookie is SameSite=Lax and travels on a cross-site top-level GET, and
 * a report that holds a review is a state change worth protecting from that.
 */
import { Router, json } from "express";
import { PrismaClient } from "@prisma/client";
import {
  DETAIL_MAX,
  DETAIL_MIN,
  REPORT_CATEGORIES,
  ReportInvalid,
  submitReport,
  type Moderatable,
} from "@studens/platform";
import { RYC_REVIEW_KIND, holdReview, reviewExists } from "@studens/ryc";
import { identifyIfAny } from "../identity.js";

/**
 * What can be reported.
 *
 * One entry per module that has content somebody might complain about. A module
 * absent from this list is a module whose content cannot be reported, which for
 * a hosting provider is a decision and not an omission, so it is visible here
 * rather than implied by the absence of code.
 */
const TARGETS: Moderatable[] = [
  { kind: RYC_REVIEW_KIND, exists: reviewExists, hold: holdReview },
];

export function reportRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(json({ limit: "8kb" }));

  /**
   * What a reporting form needs to draw itself.
   *
   * Public, and it names the two categories that hide the content at once. A
   * person choosing between "illegal" and "inaccurate" should know the first
   * has an immediate effect, both so they use it when it applies and so they do
   * not use it when it does not.
   */
  router.get("/reports/categories", (_req, res) => {
    res.json({
      categories: REPORT_CATEGORIES,
      detail: { min: DETAIL_MIN, max: DETAIL_MAX },
      kinds: TARGETS.map((t) => t.kind),
    });
  });

  router.post("/reports", (req, res) => {
    void (async () => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { targetKind, targetId, category, detail, contactEmail } = body;

      for (const [name, value] of Object.entries({ targetKind, targetId, category, detail })) {
        if (typeof value !== "string" || value === "") {
          res.status(400).json({ error: "invalid", field: name });
          return;
        }
      }
      if (contactEmail !== undefined && contactEmail !== null && typeof contactEmail !== "string") {
        res.status(400).json({ error: "invalid", field: "contactEmail" });
        return;
      }

      // Signed in or not: both are allowed, and which one it is decides only
      // whether the notice carries a member (FR-E8, FR-E12).
      const who = await identifyIfAny(prisma, req);

      try {
        const outcome = await submitReport(
          prisma,
          {
            targetKind: targetKind as string,
            targetId: targetId as string,
            category: category as string,
            detail: detail as string,
            reporterMemberId: who?.memberId ?? null,
            contactEmail: (contactEmail as string | undefined) ?? null,
          },
          { targets: TARGETS },
        );

        // 202: received and queued for a person to read. Not 201, because the
        // thing that matters to the reporter has not happened yet, and not 200,
        // because nothing was returned. FR-E13: no response time is promised,
        // so the body says what happened rather than when the rest will.
        res.status(202).json({
          received: true,
          held: outcome.held,
          duplicate: outcome.duplicate,
        });
      } catch (err) {
        if (err instanceof ReportInvalid) {
          // `target: not-found` answers the same whether the id never existed
          // or is already held, so the endpoint cannot be used to discover
          // which reviews are under moderation.
          res.status(400).json({ error: "report", field: err.field, reason: err.reason });
          return;
        }
        throw err;
      }
    })().catch(() => res.status(500).json({ error: "unavailable" }));
  });

  return router;
}
