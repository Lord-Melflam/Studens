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
import { useState } from "react";
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
    <div className="chipset">
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

/**
 * The same options as rows rather than as pills.
 *
 * A chip is the right shape for "Q1" and for "Louvain-la-Neuve", and the wrong
 * one for "Faculte d'architecture, d'ingenierie architecturale, d'urbanisme
 * (LOCI)". Twenty of those wrap to three lines each inside a rounded border,
 * and the group becomes a wall of pills nobody can scan. Rows give every
 * option one line, the same left edge and the count in the same place, which
 * is what makes a list of twenty readable at a glance.
 *
 * The full label is on `title`, because one line means some of them are cut.
 */
function Rows<T extends string | number | null>({
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
    <div className="optlist">
      {facets.map((f) => {
        const on = chosen.includes(f.value);
        const label = labelFor ? labelFor(f) : f.label;
        return (
          <button
            key={String(f.value)}
            type="button"
            className={on ? "opt on" : "opt"}
            aria-pressed={on}
            onClick={() => onToggle(f.value)}
            title={label}
          >
            <span className="opt-box" aria-hidden="true" />
            <span className="opt-label">{label}</span>
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
  const t = useT();
  /**
   * EVERY GROUP OPENS. A reader can fold one; the panel does not fold it for
   * them.
   *
   * Two of them used to start folded, the two long ones, because 20 faculties
   * and 22 fields of study put 57 chips above the first programme. That fixed
   * the crowding by removing the filters, which is the thing that was
   * objected to. The crowding is fixed below instead, by a search box and a
   * list that scrolls inside its own group, and then there is nothing left for
   * the fold to buy.
   */
  const [open, setOpen] = useState(true);
  const [needle, setNeedle] = useState("");
  // Nothing to choose between is not a filter. One option can only ever be
  // "everything" or "nothing", and it takes up the same room as a useful one.
  if (facets.length < 2) return null;

  const picked = facets.filter((f) => chosen.includes(f.value));
  const text = (f: Facet<T>): string => (labelFor ? labelFor(f) : f.label);

  /**
   * A LONG GROUP IS SEARCHABLE, NOT HIDDEN.
   *
   * It used to fold behind "choose from 31", which is what was objected to:
   * the long lists were hidden behind a label. Folding was an answer to
   * crowding and it answered it by removing the thing rather than making it
   * usable, so 31 faculties and 22 fields of study were one click away from
   * being visible at all and no click away from being findable.
   *
   * Typing is what people do with a list that long. The box appears only where
   * it earns its place, and the list under it scrolls instead of pushing the
   * programmes off the screen.
   */
  const searchable = facets.length > SEARCH_ABOVE;
  const q = needle.trim().toLowerCase();
  const shown =
    searchable && q !== ""
      ? facets.filter((f) => text(f).toLowerCase().includes(q) || chosen.includes(f.value))
      : facets;

  return (
    <fieldset className={open ? "filter-group" : "filter-group shut"}>
      {/*
        A real header row rather than a legend and a link. It says the name,
        what is chosen, and whether it is open, and the whole row is the
        control: at eight groups stacked in a column, a target the width of a
        word is the difference between a panel you can use and one you poke at.
      */}
      <button
        type="button"
        className="group-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="group-name">{legend}</span>
        <span className="group-state">
          {picked.length > 0 ? picked.map(text).join(", ") : t("ryc.filter.any", { n: facets.length })}
        </span>
        <span className="group-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="group-body">
          {searchable && (
            <input
              type="search"
              className="group-search"
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder={t("ryc.filter.narrow")}
              aria-label={legend}
            />
          )}
          {/* The threshold that turns on the search box turns on the rows
              too: they are the same judgement, that this dimension has more
              options than the eye can take in as pills. */}
          {searchable ? (
            <Rows facets={shown} chosen={chosen} onToggle={onToggle} labelFor={labelFor} />
          ) : (
            <Chips facets={shown} chosen={chosen} onToggle={onToggle} labelFor={labelFor} />
          )}
          {searchable && shown.length === 0 && (
            <p className="group-none">{t("ryc.filter.noOption")}</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Above this many options a group gets a search box and a scrolling list.
 *
 * Twelve, because the two that hurt are the faculties (31 across two
 * universities) and the fields of study (22), and the ones that do not are the
 * terms, the credits, the languages and the campuses. It is a threshold rather
 * than a list of dimensions so a catalogue that grows does not need this file
 * edited again.
 */
const SEARCH_ABOVE = 12;

export function FilterBar({
  children,
  active,
  onClear,
  summary,
  scope,
}: {
  children: React.ReactNode;
  active: boolean;
  onClear: () => void;
  /** What the list holds right now, said in words above it. */
  summary: string;
  /** Which universities the catalogue is, above the filters over it. */
  scope?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="filters">
      {scope}
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

/**
 * WHICH UNIVERSITIES THE CATALOGUE IS, and how to change them.
 *
 * Not a filter. The member's universities ARE the catalogue, and everything
 * below counts inside them: 690 programmes rather than 976 with one chip lit.
 * The first version was rejected as fragile and as noise, and it does not
 * survive five or ten universities.
 *
 * So this sits above the filters, says what the scope is in a line, and hides
 * the rest until asked. Adding a university is a deliberate act with its own
 * control, not one chip among eleven that happens to be off. At ten
 * institutions the closed state is still one line.
 *
 * It offers only universities that have a catalogue loaded, taken from the
 * programmes on screen rather than from a list: an institution nobody can
 * browse is not something to offer, and the same rule already decides what the
 * first run lets somebody pick (FR-F12).
 */
export function ScopePicker({
  all,
  mine,
  onAdd,
  onRemove,
}: {
  all: string[];
  mine: string[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Nothing to add and nothing to drop: one university in the world and it is
  // yours. A control that can only ever do nothing is not shown.
  if (all.length < 2 && mine.length <= 1) return null;

  const label =
    mine.length === 0
      ? t("ryc.scope.all")
      : mine.map((c) => c.toUpperCase()).join(", ");

  return (
    <div className={open ? "scope open" : "scope"}>
      <p className="scope-line">
        <span className="scope-what">{label}</span>
        <button type="button" className="linkish" onClick={() => setOpen(!open)}>
          {open ? t("ryc.scope.done") : t("ryc.scope.change")}
        </button>
      </p>
      {open && (
        <ul className="scope-list">
          {all.map((code) => {
            const on = mine.includes(code);
            return (
              <li key={code}>
                <button
                  type="button"
                  className={on ? "chip on" : "chip"}
                  aria-pressed={on}
                  onClick={() => (on ? onRemove(code) : onAdd(code))}
                >
                  {code.toUpperCase()}
                </button>
              </li>
            );
          })}
          <li className="scope-hint">{t("ryc.scope.hint")}</li>
        </ul>
      )}
    </div>
  );
}
