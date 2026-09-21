/**
 * Step 2 of the review path: the fork.
 *
 * A screen of its own, with two cards side by side and no default. The two
 * halves are deliberately not symmetric:
 *
 *   - the named card sends on one press
 *   - the anonymous card leads to one more screen
 *
 * Only one of the two cannot be undone, so only one of the two costs an extra
 * confirmation (docs/typeset/frontend-design.tex 6, FR-C23).
 *
 * WHAT THE CARDS MAY SAY. This is the screen where a person makes a permanent
 * choice by comparing two lists, so a claim on either list that is not true
 * today is a thumb on the scale. Editing an attributed review (FR-C14) and
 * "Mes avis" (FR-D12) are specified and NOT BUILT, so the named card does not
 * offer them as reasons to choose it. They are named as planned, once, in the
 * one place where the difference between the branches is permanent anyway.
 * test/ui/path-claims.test.ts holds this.
 *
 * IN THREE LANGUAGES since 2026-09-13. This screen more than any other: it is
 * where somebody accepts that something is permanent, and accepting that in a
 * language you half read is not consent.
 */
import { useT, type Translate } from "@studens/i18n";
import type { ReviewContext, ReviewDraft } from "./api.js";
import { Steps } from "./Steps.js";

function Counts({ ctx }: { ctx: ReviewContext }) {
  const t = useT();
  const named = t("ryc.counts.named", { count: ctx.named });
  const anon = t("ryc.counts.anon", { count: ctx.anonymous });
  return (
    <p className="counts">
      {/* FR-C21: the two numbers, before the choice and not after it. */}
      {t("ryc.counts.lead")} <strong>{named}</strong> {t("ryc.counts.and")}{" "}
      <strong>{anon}</strong>.{ctx.anonymous === 0 && ` ${t("ryc.counts.first")}`}
      <em>{t("ryc.counts.note")}</em>
    </p>
  );
}

/**
 * What you are about to publish, collapsed.
 *
 * The choice on this screen is about the text, and until now the text was on
 * the previous screen. Deciding whether you want your name on something you
 * cannot currently see is a decision made half blind.
 */
export function DraftSummary({ draft }: { draft: ReviewDraft | null }) {
  const t = useT();
  if (!draft) return null;
  return (
    <details className="draft">
      <summary>
        {t("ryc.draft.reread")}
        <span className="draft-facts">
          {draft.academicYear}-{draft.academicYear + 1} ·{" "}
          {t("ryc.draft.facts", {
            recommendation: draft.recommendation,
            workload: draft.workloadVsEcts,
            difficulty: draft.difficulty,
            chars: draft.body.length,
          })}
        </span>
      </summary>
      <p className="draft-body">{draft.body}</p>
      {draft.advice && (
        <p className="draft-advice">
          <strong>{t("ryc.draft.advice")}</strong> {draft.advice}
        </p>
      )}
    </details>
  );
}

export function PathChoice({
  ctx,
  draft,
  onNamed,
  onAnonymous,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  draft: ReviewDraft | null;
  onNamed: () => void;
  onAnonymous: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const t: Translate = useT();
  return (
    <section className="fork">
      <Steps current="fork" />
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        {t("ryc.fork.back")}
      </button>
      <h3>{t("ryc.fork.title")}</h3>
      <p className="form-lead">{t("ryc.fork.lede")}</p>

      <DraftSummary draft={draft} />

      <div className="fork-cards">
        <article className="card card-named">
          <span className="chip-named">{t("ryc.fork.named.chip")}</span>
          <ul>
            <li>{t("ryc.fork.named.1")}</li>
            <li>{t("ryc.fork.named.2")}</li>
            <li>{t("ryc.fork.named.3")}</li>
            {/* FR-D28: this may be said here now, and could not be before.
                Editing (FR-C14) and "Mes avis" (FR-D12) ship in the same
                change as this line, which is the coupling that requirement
                asks for. Deletion on request is still not built and is still
                absent from both cards. */}
            <li>{t("ryc.fork.named.4")}</li>
          </ul>
          <button type="button" className="primary named" onClick={onNamed} disabled={busy}>
            {t("ryc.fork.named.cta")}
          </button>
        </article>

        <article className="card card-anon">
          <span className="chip-anon">{t("ryc.fork.anon.chip")}</span>
          <p className="card-lead">{t("ryc.fork.anon.lead")}</p>
          <ul>
            <li>{t("ryc.fork.anon.1")}</li>
            <li>
              <strong>{t("ryc.fork.anon.2")}</strong>
            </li>
            <li>{t("ryc.fork.anon.3")}</li>
          </ul>
          <Counts ctx={ctx} />
          <button type="button" className="primary anon" onClick={onAnonymous} disabled={busy}>
            {t("ryc.fork.anon.cta")}
          </button>
        </article>
      </div>

      {/*
        Said once, below both cards, and not as an argument for either. A
        feature that does not exist yet belongs in a footnote, not in the list
        someone reads to make a decision they cannot take back.
      */}
      <p className="fork-note">{t("ryc.fork.note")}</p>
    </section>
  );
}

/**
 * Step 3, on the anonymous branch only.
 *
 * The extra screen exists because of what happens after it: once the row is
 * written there is no member id attached to it anywhere, so nobody, including
 * an administrator with the database open, can find it again on your behalf
 * (FR-C9). It is the last moment at which the decision is still reversible.
 */
export function AnonymousConfirm({
  ctx,
  draft,
  onConfirm,
  onBack,
  busy,
}: {
  ctx: ReviewContext;
  draft: ReviewDraft | null;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const t = useT();
  return (
    <section className="confirm">
      <Steps current="confirm" />
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        {t("ryc.confirm.back")}
      </button>
      <span className="chip-anon">{t("ryc.fork.anon.chip")}</span>
      <h3>{t("ryc.confirm.title")}</h3>

      <ul className="confirm-points">
        <li>
          {t("ryc.confirm.1.before")} <strong>{t("ryc.confirm.1.strong")}</strong>
        </li>
        <li>
          {t("ryc.confirm.2")} <em>{t("ryc.confirm.2.em")}</em>
        </li>
        <li>{t("ryc.confirm.3")}</li>
      </ul>

      {/* Last chance to reread it, on the screen where rereading still matters. */}
      <DraftSummary draft={draft} />

      <Counts ctx={ctx} />

      <div className="actions">
        <button type="button" className="primary anon" onClick={onConfirm} disabled={busy}>
          {busy ? t("ryc.confirm.sending") : t("ryc.confirm.cta")}
        </button>
        {/*
          A second way out, beside the irreversible button. Someone who has
          scrolled this far and hesitates should not have to scroll back up to
          the link at the top to change their mind. It says what it does: it
          does not publish anything, it returns to the choice.
        */}
        <button type="button" className="ghost" onClick={onBack} disabled={busy}>
          {t("ryc.confirm.return")}
        </button>
      </div>
    </section>
  );
}
