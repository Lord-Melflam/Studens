/**
 * Turning one course-page field into structured blocks.
 *
 * The catalogue's prose fields are not prose. They are lists, most of them,
 * written by lecturers in a rich text editor. Flattening them to one string
 * loses the only thing that makes a 2,000 character field readable.
 *
 * MEASURED across the 546 cached course pages, 1,390 field values
 * (`Modes d'évaluation`, `Thèmes abordés`, `Contenu`):
 *
 *     li 4040   br 3988   ul 818   strong 523   div 262
 *     i 109     ol 81     td 67    u 57         code 45
 *     tr 29     table 10  h2/h3/h4 11           a 4
 *
 *     list nesting: 3857 items at depth 1, 176 at depth 2, 7 at depth 3
 *
 * So the model needs lists (ordered and not, nested three deep), line breaks,
 * inline emphasis, headings and tables, and nothing else.
 *
 * TWO BULLET CONVENTIONS, both in heavy use. Some authors use <ul><li>; others
 * type "- " at the start of a line and separate lines with <br />. The counts
 * above show neither is rare. Real markup is honoured as markup; the typed
 * convention is recognised only for a RUN of two or more consecutive lines, so
 * a single line that happens to open with a hyphen is left as a line.
 *
 * What is deliberately dropped:
 *   - <a href>: 4 occurrences. The text is kept, the destination is not. An
 *     outbound link inside scraped content is a redirect we do not control.
 *   - <u>: 57 occurrences, kept as plain text. Underline is presentational and
 *     in a browser it reads as a link.
 */
import type { AnyNode, Element } from "domhandler";
import type { CheerioAPI } from "cheerio";

/** A run of text with optional emphasis. Three flags, no nesting of styles. */
export interface Span {
  t: string;
  /** strong, b, big */
  b?: true;
  /** i, em */
  i?: true;
  /** code, tt */
  c?: true;
}

export type Block =
  /** A paragraph. `lines` are the <br /> separated lines inside it. */
  | { kind: "p"; lines: Span[][] }
  | { kind: "h"; lines: Span[][] }
  | { kind: "list"; ordered: boolean; items: Block[][] }
  | { kind: "table"; rows: string[][] };

const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "table", "h1", "h2", "h3", "h4", "h5", "h6"]);
const BOLD = new Set(["strong", "b", "big"]);
const ITALIC = new Set(["i", "em"]);
const CODE = new Set(["code", "tt", "samp", "kbd"]);
const HEADING = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Non-breaking spaces are spaces. Collapse runs, but never trim mid-span. */
function clean(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
}

interface Style {
  b?: true;
  i?: true;
  c?: true;
}

/** Accumulates spans into lines, and lines into paragraphs. */
class Para {
  private lines: Span[][] = [[]];

  push(text: string, style: Style): void {
    if (!text) return;
    const line = this.lines[this.lines.length - 1]!;
    const last = line[line.length - 1];
    // Merge with the previous span when the styling is identical, so a
    // sentence split across two text nodes does not become two spans.
    if (last && !!last.b === !!style.b && !!last.i === !!style.i && !!last.c === !!style.c) {
      last.t += text;
      return;
    }
    line.push({ t: text, ...style });
  }

  breakLine(): void {
    this.lines.push([]);
  }

  /** Trim, drop empty lines, and return null when nothing survived. */
  take(): Span[][] | null {
    const out: Span[][] = [];
    for (const line of this.lines) {
      const spans: Span[] = [];
      for (const s of line) {
        const t = s.t;
        if (t.trim() === "") continue;
        spans.push({ ...s, t });
      }
      if (spans.length === 0) continue;
      spans[0]!.t = spans[0]!.t.replace(/^\s+/, "");
      spans[spans.length - 1]!.t = spans[spans.length - 1]!.t.replace(/\s+$/, "");
      out.push(spans);
    }
    this.lines = [[]];
    return out.length === 0 ? null : out;
  }
}

function isElement(n: AnyNode): n is Element {
  return n.type === "tag";
}

/** The plain text of a node, for table cells where formatting is not modelled. */
function plain($: CheerioAPI, el: AnyNode): string {
  const c = $(el).clone();
  c.find("br").replaceWith(" ");
  return clean(c.text()).trim();
}

function tableBlock($: CheerioAPI, el: Element): Block | null {
  const rows: string[][] = [];
  $(el)
    .find("tr")
    .each((_, tr) => {
      const cells = $(tr)
        .children("td,th")
        .map((_i, td) => plain($, td))
        .get();
      if (cells.some((c) => c !== "")) rows.push(cells);
    });
  return rows.length === 0 ? null : { kind: "table", rows };
}

function listBlock($: CheerioAPI, el: Element): Block | null {
  const items: Block[][] = [];
  $(el)
    .children("li")
    .each((_, li) => {
      const inner = walk($, li);
      if (inner.length > 0) items.push(inner);
    });
  return items.length === 0 ? null : { kind: "list", ordered: el.tagName === "ol", items };
}

/**
 * Walk one element's children into blocks.
 *
 * Inline content accumulates into a paragraph, which is flushed whenever a
 * block level element interrupts it. That is what keeps "text, then a list,
 * then more text" in its original order.
 */
function walk($: CheerioAPI, root: AnyNode, style: Style = {}): Block[] {
  const out: Block[] = [];
  const para = new Para();

  const flush = (): void => {
    const lines = para.take();
    if (lines) out.push({ kind: "p", lines });
  };

  const visit = (node: AnyNode, st: Style): void => {
    if (node.type === "text") {
      para.push(clean((node as unknown as { data: string }).data), st);
      return;
    }
    if (!isElement(node)) return;

    const tag = node.tagName;
    if (tag === "br") {
      para.breakLine();
      return;
    }
    if (tag === "script" || tag === "style") return;

    if (tag === "ul" || tag === "ol") {
      flush();
      const b = listBlock($, node);
      if (b) out.push(b);
      return;
    }
    if (tag === "table") {
      flush();
      const b = tableBlock($, node);
      if (b) out.push(b);
      return;
    }
    if (HEADING.has(tag)) {
      flush();
      const inner = walk($, node, st);
      // A heading holds one line of text; anything block level inside it is
      // kept as its own block rather than silently dropped.
      for (const b of inner) out.push(b.kind === "p" ? { kind: "h", lines: b.lines } : b);
      return;
    }
    if (BLOCK_TAGS.has(tag)) {
      flush();
      for (const b of walk($, node, st)) out.push(b);
      return;
    }

    const next: Style = { ...st };
    if (BOLD.has(tag)) next.b = true;
    if (ITALIC.has(tag)) next.i = true;
    if (CODE.has(tag)) next.c = true;
    for (const child of node.children) visit(child, next);
  };

  for (const child of ($(root)[0] as Element | undefined)?.children ?? []) visit(child, style);
  flush();
  return out;
}

/**
 * A bullet typed by hand at the start of a line.
 *
 * The characters are the ones actually used on these pages: hyphen, en dash,
 * asterisk, bullet, middle dot, and a lowercase "o" (a Word artefact, where a
 * second level bullet was pasted as a letter). Code, not prose.
 */
const TYPED_BULLET = /^\s*[-–*•·o]\s+(?=\S)/;

function lineText(line: Span[]): string {
  return line.map((s) => s.t).join("");
}

/** Strip the marker from a line, keeping its spans and their emphasis. */
function stripMarker(line: Span[]): Span[] {
  const out = line.map((s) => ({ ...s }));
  const first = out[0];
  if (first) first.t = first.t.replace(TYPED_BULLET, "");
  return out.filter((s) => s.t !== "");
}

/**
 * Promote runs of hand-typed bullets to real lists.
 *
 * Only a run of two or more consecutive marked lines counts. One line opening
 * with a hyphen is far more likely to be a dash than a list of one.
 */
function promoteTypedBullets(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (block.kind === "list") {
      out.push({ ...block, items: block.items.map(promoteTypedBullets) });
      continue;
    }
    if (block.kind !== "p") {
      out.push(block);
      continue;
    }

    let plainRun: Span[][] = [];
    let bulletRun: Span[][] = [];
    const closePlain = (): void => {
      if (plainRun.length) out.push({ kind: "p", lines: plainRun });
      plainRun = [];
    };
    const closeBullets = (): void => {
      if (bulletRun.length >= 2) {
        // Only now is the paragraph before the run known to be finished. Doing
        // this when the FIRST marked line appeared would split a paragraph in
        // two every time one line happened to open with a hyphen.
        closePlain();
        out.push({
          kind: "list",
          ordered: false,
          items: bulletRun.map((l) => [{ kind: "p" as const, lines: [stripMarker(l)] }]),
        });
      } else {
        plainRun.push(...bulletRun);
      }
      bulletRun = [];
    };

    for (const line of block.lines) {
      if (TYPED_BULLET.test(lineText(line))) {
        bulletRun.push(line);
      } else {
        closeBullets();
        plainRun.push(line);
      }
    }
    closeBullets();
    closePlain();
  }
  return out;
}

/** The public entry point: one field element to blocks, or null if it is empty. */
export function richBlocks($: CheerioAPI, el: AnyNode): Block[] | null {
  const blocks = promoteTypedBullets(walk($, el));
  return blocks.length === 0 ? null : blocks;
}

/** Flat text of a block tree, for anything that needs a plain string. */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  const walkBlocks = (bs: Block[]): void => {
    for (const b of bs) {
      if (b.kind === "p" || b.kind === "h") parts.push(b.lines.map(lineText).join("\n"));
      else if (b.kind === "list") for (const item of b.items) walkBlocks(item);
      else for (const row of b.rows) parts.push(row.join(" "));
    }
  };
  walkBlocks(blocks);
  return parts.join("\n");
}
