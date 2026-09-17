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
export function CatalogueLanguageNote() {
  const t = useT();
  const locale = useLocale();
  if (locale === CATALOGUE_LANG) return null;
  // A div and not a p, because on the course page this sits inside the <dl>
  // holding the fields, and a dl may hold only dt, dd and div.
  return <div className="source-lang">{t("ryc.course.sourceLanguage")}</div>;
}
