/**
 * WHAT EACH MODULE DOES WHEN A MEMBER LEAVES.
 *
 * Listed here and nowhere else. A module that is not in this array is a module
 * whose data survives a deletion, so adding one is a deliberate act with a
 * visible diff, which is what FR-B14 makes review for.
 *
 * MOVED OUT OF `routes/account.ts` ON 2026-09-27, when an administrator gained
 * the ability to carry out an erasure somebody cannot carry out themselves
 * (FR-E19). Two routes now need the list, and the whole value of the sentence
 * above is that there is one list: a second copy is how a module quietly stops
 * being erased on one of the two paths.
 *
 * This is the composition layer, which is the only place allowed to know both
 * the platform and the modules (FR-B11).
 */
import { RYC_MODULE, detachMemberReviews, exportMemberReviews } from "@studens/ryc";
import { detachMemberReports, type MemberErasure } from "@studens/platform";

export const ERASURES: MemberErasure[] = [
  {
    module: RYC_MODULE,
    erase: detachMemberReviews,
    export: exportMemberReviews,
  },
  {
    /*
      FR-E8 and FR-A15. The notices somebody filed stay; the link to them goes.
      A report is not theirs to withdraw: one may already have caused a
      contribution to be held, and Article 16 asks us to be able to show what we
      did about it. This is why platform.Report has no foreign key to Member,
      which would have cascaded them away.
    */
    module: "reports",
    erase: detachMemberReports,
  },
];
