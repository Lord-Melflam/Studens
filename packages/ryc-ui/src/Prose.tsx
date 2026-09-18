/**
 * Rendering the catalogue's structured fields.
 *
 * The three long course-page fields (evaluation, themes, content) arrive as
 * blocks rather than text, because they are lists: 4,040 list items and 3,988
 * line breaks across the 546 pages crawled. See the block model and its
 * measurements in packages/ref/src/ingestion/parse/rich.ts.
 *
 * No HTML from UCLouvain reaches this component. The parser turned their
 * markup into a small closed set of shapes, and this file turns that set into
 * our own elements, so there is no sanitiser and no dangerouslySetInnerHTML
 * anywhere in the path.
 */
import { useId } from "react";
import { useLocale, useT } from "@studens/i18n";

/**
 * THE LANGUAGE EVERY BLOCK ON THIS PAGE IS IN, and it is not the visitor's.
 *
 * Not a guess. The crawl fetches `uclouvain.be/cours-<year>-<code>`, which is
 * the French edition of a course page, so every block stored in the catalogue
 * is French whatever language the interface is showing. An English visitor
 * reads English labels around a French record, and until now nothing on the
 * page said so: it read as a bug, or as a product that had given up halfway.
 *
 * It is a constant rather than a field on the course because there is nothing
 * to vary yet: one crawl, one language. It becomes a field the day OPEN-47 is
 * answered, and this is the one line that has to change when it is.
 *
 * Marking it matters beyond the note on screen. A screen reader on an English
 * page pronounces French with English phonemes unless the element says
 * otherwise, so `lang` here is the difference between a paragraph somebody can
 * listen to and noise.
 */
export const CATALOGUE_LANG = "fr";

/** Mirrors the parser's model. The API response is the contract, not the type. */
export interface Span {
  t: string;
  b?: boolean;
  i?: boolean;
  c?: boolean;
}

export type Block =
  | { kind: "p"; lines: Span[][] }
  | { kind: "h"; lines: Span[][] }
  | { kind: "list"; ordered: boolean; items: Block[][] }
  | { kind: "table"; rows: string[][] };

function Text({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        let node = <>{s.t}</>;
        if (s.c) node = <code>{node}</code>;
        if (s.i) node = <em>{node}</em>;
        if (s.b) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** Lines inside one paragraph, separated by the break the source had. */
function Lines({ lines }: { lines: Span[][] }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          <Text spans={line} />
        </span>
      ))}
    </>
  );
}

function One({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return (
        <p>
          <Lines lines={block.lines} />
        </p>
      );
    case "h":
      // h4, not h3: the field's own label is the h3 on the course page, and a
      // heading inside a field is below it.
      return (
        <h4>
          <Lines lines={block.lines} />
        </h4>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Blocks blocks={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "table":
      return (
        // Course pages carry wide tables. Scrolling inside the field beats a
        // page that scrolls sideways as a whole.
        <div className="prose-table">
          <table>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <One key={i} block={b} />
      ))}
    </>
  );
}

/** A course-page field: its label, and its blocks. Absent fields render nothing. */
export function ProseField({ label, blocks }: { label: string; blocks: Block[] | null }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="field">
      <dt>{label}</dt>
      {/* The label is the visitor's language, the body is the catalogue's, and
          `lang` is what stops the two being read as one. */}
      <dd className="prose" lang={CATALOGUE_LANG}>
        <Blocks blocks={blocks} />
      </dd>
    </div>
  );
}

/**
 * A course-page field that starts folded.
 *
 * WHY FOLDED HERE AND OPEN IN THE FILTER PANEL, because the two defaults are
 * opposite and that is not drift.
 *
 * In the filter panel, folding hid the controls somebody needs to use the
 * screen, and the groups are short. Here the content is long-form prose, and
 * what it pushes off the bottom of the page is the reviews, which are the
 * product. François: "it can be really exhaustive and take space for courses
 * having large descriptions ... otherwise the review will come only far away
 * at the bottom of the page". A UCLouvain assessment field alone runs to three
 * items, a weighting list, a paragraph on generative AI and one on the second
 * session, and there are seven fields like it.
 *
 * The short facts above are NOT folded. Teachers, credits, hours and the
 * campus are a line each, they are what the page is looked up for, and a
 * heading you have to open to read one line is worse than the line.
 *
 * WHICH ONES ARE OPEN IS IN THE ADDRESS, and this component holds no state of
 * its own. It was local for one day, which was long enough to be wrong twice:
 * a refresh closed everything a reader had opened, and there was no way to
 * send somebody the bibliography of a course rather than the course. FR-B21 is
 * the rule and it applies here like everywhere else, so the caller owns the
 * set and this renders what it is told.
 */
export function FoldedField({
  label,
  blocks,
  open,
  onToggle,
}: {
  label: string;
  blocks: Block[] | null;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className={open ? "field fold open" : "field fold"}>
      {/* A `dt` holding a button: the whole row is the control, and the button
          carries the label, so a screen reader announces the field name and
          its state together rather than "button, collapsed". */}
      <dt>
        <button
          type="button"
          className="fold-head"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span className="fold-name">{label}</span>
          {/* Drawn, not built out of two rotated borders. The border trick
              gives a hairline that thickens on the diagonal and sits a pixel
              off its own centre, which is most of why this row looked like an
              accordion from 2012. */}
          <svg className="fold-chevron" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M5.5 8 10 12.5 14.5 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </dt>
      {/* Not rendered at all while folded rather than hidden with CSS: a
          closed field holds hundreds of elements on a long course, and seven
          of them is a page the browser lays out and nobody reads. */}
      {open && (
        <dd className="prose" id={id} lang={CATALOGUE_LANG}>
          <Blocks blocks={blocks} />
        </dd>
      )}
    </div>
  );
}

/**
 * One line saying the record below is in a language the visitor did not pick.
 *
 * It renders only when those two differ, because on a French page it would be
 * saying that French is French. That condition is the whole value of it: the
 * note is not decoration, it is the answer to "why is half this page in
 * another language", asked by somebody who otherwise concludes the product is
 * broken.
 *
 * It states a fact and makes no promise. It does not say a translation is
 * coming, because whether one ever does is OPEN-47 and nobody has decided.
 */
export function CatalogueLanguageNote({ institution }: { institution: string }) {
  const t = useT();
  const locale = useLocale();
  if (locale === CATALOGUE_LANG) return null;
  // A div and not a p, because on the course page this sits inside the <dl>
  // holding the fields, and a dl may hold only dt, dd and div.
  //
  // THE INSTITUTION IS A PARAMETER because this line named UCLouvain whatever
  // the course. That was true while there was one catalogue and became a
  // falsehood the hour ULB loaded: an English reader on a ULB course was told
  // UCLouvain had published it. The note exists to be accurate about where the
  // French came from, so naming the wrong university defeats the whole point
  // of having it.
  return (
    <div className="source-lang">
      {t("ryc.course.sourceLanguage", { name: institution.toUpperCase() })}
    </div>
  );
}
