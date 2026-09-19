/**
 * The Studens mark: a course sheet with something added under it, beside the
 * name spelled the way the name is actually spelled.
 *
 * WHY THIS ONE. Six directions were drawn and this one was chosen. The sheet
 * is literally what the product does to a catalogue, it publishes the record
 * and adds something underneath it, and the long e is not decoration: Studens
 * is Latin, `studēns`, and the macron is the one graphic idea the name already
 * contains. The accent colours the `ē` alone, so the eye lands on the thing
 * that makes the word a word rather than a string.
 *
 * INLINE SVG, NOT A FILE. It inherits `currentColor` for the ink, so it works
 * on any background a theme produces without shipping a second asset, and
 * there is no request for it at any size. That matters more than it sounds:
 * this is the first thing on every page in every zone.
 *
 * `aria-label` and not a title on the path, because a screen reader should
 * hear the product's name, not a description of a rectangle.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brandmark compact" : "brandmark"} aria-label="Studens">
      <svg viewBox="0 0 40 52" aria-hidden="true" className="brandmark-icon">
        {/* The published record. */}
        <rect
          x="1.75"
          y="1.75"
          width="36.5"
          height="28.5"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <rect x="8" y="10" width="22" height="4" rx="2" fill="currentColor" />
        <rect x="8" y="19" width="14" height="4" rx="2" className="brandmark-faint" />
        {/* What students add to it. */}
        <rect x="5" y="37" width="30" height="13" rx="6.5" className="brandmark-added" />
      </svg>
      <span className="brandmark-word" aria-hidden="true">
        Stud<span className="brandmark-e">ē</span>ns
      </span>
    </span>
  );
}
