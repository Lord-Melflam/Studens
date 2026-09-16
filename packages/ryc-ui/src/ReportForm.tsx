/**
 * Reporting a review. FR-E8, DSA Article 16.
 *
 * ARTICLE 16 ASKS FOR A MECHANISM THAT IS "EASILY ACCESSIBLE AND USER-FRIENDLY",
 * which is a design obligation and not only an endpoint. So the control sits on
 * the contribution itself rather than behind a contact page, it opens in place
 * rather than navigating away, and it needs no account: the person most likely
 * to notice that a review names them is the lecturer it names, who has no
 * reason to have an account here.
 *
 * IT SAYS WHAT EACH CATEGORY DOES. Two of them hide the review at once
 * (FR-E11), and a person choosing between "illegal" and "inaccurate" should
 * know that, both so they use the first when it applies and so they do not when
 * it does not. Hiding that would make the strong option look free.
 *
 * IT PROMISES NO DEADLINE (FR-E13). The legal standard is acting expeditiously
 * once we know, which names no number; naming one here would create an
 * obligation the law did not impose, and a missed promise is evidence against
 * us at the moment somebody is complaining. It says what happens instead.
 */
import { useState } from "react";
import { useT } from "@studens/i18n";
import { api, REPORT_CATEGORIES, REPORT_DETAIL_MIN, type ReportCategory } from "./api.js";

/** The two that hide the review the moment the notice arrives (FR-E11). */
const IMMEDIATE: ReadonlySet<string> = new Set(["illegal", "thirdparty"]);

export function ReportForm({
  targetId,
  onClose,
}: {
  targetId: string;
  onClose: () => void;
}) {
  const t = useT();
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [detail, setDetail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | { held: boolean }>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const short = detail.trim().length < REPORT_DETAIL_MIN;

  async function send() {
    if (category === "" || short) return;
    setBusy(true);
    setFailed(null);
    try {
      const outcome = await api.report({
        targetId,
        category,
        detail: detail.trim(),
        contactEmail: contactEmail.trim() || undefined,
      });
      setSent({ held: outcome.held });
    } catch {
      setFailed(t("ryc.report.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="report-form sent" role="status">
        <p>
          <strong>{t("ryc.report.thanks")}</strong>
        </p>
        {/* Said only when true. A notice that changed nothing yet must not
            imply it did. */}
        <p>{sent.held ? t("ryc.report.sent.held") : t("ryc.report.sent.queued")}</p>
        <p className="hint">{t("ryc.report.nodeadline")}</p>
        <button type="button" className="ghost" onClick={onClose}>
          {t("ryc.report.close")}
        </button>
      </div>
    );
  }

  return (
    <div className="report-form">
      <h4>{t("ryc.report.title")}</h4>
      <p className="hint">{t("ryc.report.lede")}</p>

      <fieldset className="report-categories">
        <legend>{t("ryc.report.why")}</legend>
        {REPORT_CATEGORIES.map((c) => (
          <label key={c} className={category === c ? "report-cat on" : "report-cat"}>
            <input
              type="radio"
              name={`report-${targetId}`}
              checked={category === c}
              onChange={() => setCategory(c)}
            />
            <span>
              <strong>{t(`ryc.report.cat.${c}`)}</strong>
              <span className="hint">
                {t(`ryc.report.cat.${c}.hint`)}
                {/* The consequence, on the two that have one. */}
                {IMMEDIATE.has(c) && <> {t("ryc.report.cat.immediate")}</>}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="field-label" htmlFor={`report-detail-${targetId}`}>
        {t("ryc.report.detail")}
      </label>
      <textarea
        id={`report-detail-${targetId}`}
        className="text-input"
        rows={4}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder={t("ryc.report.detail.placeholder")}
      />
      {/* Article 16(2)(a) wants a substantiated explanation, so the floor is
          stated rather than enforced silently by a disabled button. */}
      <p className={short && detail !== "" ? "field-note bad" : "field-note"}>
        {t("ryc.report.detail.rule", { min: REPORT_DETAIL_MIN })}
      </p>

      <label className="field-label" htmlFor={`report-email-${targetId}`}>
        {t("ryc.report.contact")}
      </label>
      <input
        id={`report-email-${targetId}`}
        className="text-input"
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        placeholder={t("ryc.report.contact.placeholder")}
      />
      {/* Article 16(4) and 16(5): optional, and the only way to be told what
          was decided. Saying why it is asked for is what makes it worth giving. */}
      <p className="field-note">{t("ryc.report.contact.hint")}</p>

      {failed && <p className="error">{failed}</p>}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy || category === "" || short}
          onClick={() => void send()}
        >
          {busy ? t("ryc.report.sending") : t("ryc.report.send")}
        </button>
        <button type="button" className="ghost" onClick={onClose} disabled={busy}>
          {t("ryc.report.cancel")}
        </button>
      </div>
    </div>
  );
}
