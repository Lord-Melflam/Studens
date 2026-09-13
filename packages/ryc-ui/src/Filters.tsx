/**
 * The filter bar, over a list of courses or a list of programmes.
 *
 * ONE PATTERN, USED TWICE. A group of toggle chips per dimension, each carrying
 * the number of results choosing it would leave. Chips rather than dropdowns:
 * the options are few, the counts are the useful part, and a dropdown hides the
 * counts behind a click. Multi-select within a dimension, AND across them,
 * which is what people expect without being told.
 *
 * A DIMENSION WITH ONE OPTION IS NOT SHOWN. A "Quadrimestre: Q1" filter over a
 * list where every course is Q1 is a control that can only ever do nothing.
 *
 * WHAT IS DELIBERATELY NOT HERE: no filter on the lecturer. A review naming a
 * lecturer already processes a third party's personal data (requirements 5.1),
 * and a control that gathers one person's courses in a single press turns the
 * catalogue into a tool for that. It is a separate feature with a separate
 * legal footing, and this is not it.
 */
import { useT, type Translate } from "@studens/i18n";
import type { Facet } from "./filters.js";

function Chips<T extends string | number | null>({
  facets,
  chosen,
  onToggle,
  labelFor,
}: {
  facets: Array<Facet<T>>;
  chosen: T[];
  onToggle: (v: T) => void;
  labelFor?: (f: Facet<T>) => string;
}) {
  return (
    <div className="chips">
      {facets.map((f) => {
        const on = chosen.includes(f.value);
        return (
          <button
            key={String(f.value)}
            type="button"
            className={on ? "chip on" : "chip"}
            aria-pressed={on}
            onClick={() => onToggle(f.value)}
          >
            {labelFor ? labelFor(f) : f.label}
            <span className="n">{f.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FilterGroup<T extends string | number | null>({
  legend,
  facets,
  chosen,
  onToggle,
  labelFor,
}: {
  legend: string;
  facets: Array<Facet<T>>;
  chosen: T[];
  onToggle: (v: T) => void;
  labelFor?: (f: Facet<T>) => string;
}) {
  // Nothing to choose between is not a filter. One option can only ever be
  // "everything" or "nothing", and it takes up the same room as a useful one.
  if (facets.length < 2) return null;
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      <Chips facets={facets} chosen={chosen} onToggle={onToggle} labelFor={labelFor} />
    </fieldset>
  );
}

export function FilterBar({
  children,
  active,
  onClear,
  summary,
}: {
  children: React.ReactNode;
  active: boolean;
  onClear: () => void;
  /** What the list holds right now, said in words above it. */
  summary: string;
}) {
  const t = useT();
  return (
    <div className="filters">
      <div className="filters-groups">{children}</div>
      <p className="filters-summary">
        {summary}
        {active && (
          <button type="button" className="linkish" onClick={onClear}>
            {t("ryc.filter.clear")}
          </button>
        )}
      </p>
    </div>
  );
}

/** A plain text box, used above both lists. */
export function FilterText({
  value,
  onChange,
  label,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  id: string;
}) {
  return (
    <label className="filter-text" htmlFor={id}>
      {label}
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}

/**
 * The kinds have real names; the parser's values are identifiers.
 *
 * A title the parser did not recognise is `null` and shows as "autre". It is
 * offered as a group rather than hidden, so those programmes stay reachable.
 */
export function kindLabel(t: Translate, kind: string | null): string {
  return kind === null ? t("ryc.kind.autre") : t(`ryc.kind.${kind}`);
}
