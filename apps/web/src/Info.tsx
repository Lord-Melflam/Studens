/**
 * A small "i" that explains the control beside it.
 *
 * WHY IT EXISTS. The settings panel showed three keys, three number fields and
 * a range, and nothing else. `ryc.reviewsPerPage` and `platform.quotaPerWindow`
 * look alike and are not alike at all: one decides how long a page is, the
 * other decides how much anybody may publish in a week. An administrator who
 * confuses them limits the product by accident and has no way to find out from
 * the screen. Reported as exactly that: you cannot put things like this in an
 * admin panel without saying what they are.
 *
 * CLOSED BY DEFAULT, AND IN THE FLOW WHEN OPEN. Not a tooltip on hover: a
 * hover tooltip does not exist on a phone, disappears while being read, and
 * cannot be reached from a keyboard. This is a button that toggles a paragraph
 * which pushes the rest of the row down, so nothing is drawn on top of
 * anything and nothing depends on a pointer.
 *
 * IT HOLDS NO TEXT OF ITS OWN. The explanation is passed in, because the
 * places that need one belong to modules and the shell may not carry a
 * module's vocabulary (FR-B16). The settings panel gets its sentences from the
 * API for that reason.
 */
import { useId, useState } from "react";
import { useT } from "@studens/i18n";

export function Info({ children, label }: { children: React.ReactNode; label?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        className="info-mark"
        aria-expanded={open}
        aria-controls={id}
        // A screen reader hears what this explains, not the letter "i".
        aria-label={label ?? t("info.open")}
        onClick={() => setOpen(!open)}
      >
        {/* Drawn rather than typed. A lowercase i in the page font is a
            different height in every language's font stack and never centres
            inside a circle. */}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="4.6" r="1" fill="currentColor" />
          <rect x="7.1" y="6.8" width="1.8" height="5" rx="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <p className="info-body" id={id}>
          {children}
        </p>
      )}
    </>
  );
}
