/**
 * Parsing one course page into a CourseOffering.
 *
 * TWO ERAS, BOTH VERIFIED 2026-09-10 against live pages.
 *
 *   modern  (2024 onward, served from uclouvain.be)
 *           header:  div.fa_row_1 > div.fa_cell_0   ["5.00 crédits", "30.0 h + 30.0 h", "Q2"]
 *           fields:  div.fa_row   > div.fa_cell_1 (label) + div.fa_cell_2 (value)
 *
 *   archive (2023 and older, redirected to sites.uclouvain.be/archives-portail)
 *           header:  span.cdc_cell                  ["10.0 crédits ECTS", "30.0 h"]
 *           fields:  table tr > td (label) + td (value)
 *           no quarter field at all: the era lacks it, which is not an error
 *
 * docs/design/catalogue-ingestion.md section 3.1 requires "absent because the
 * era lacks the field" to stay distinguishable from "absent because the parse
 * broke". Three states, and only the last one fails a run:
 *
 *   label absent, or present with no value  ->  null, the source does not say
 *   a value outside any plausible range     ->  ParseError, we misread it
 *   no labelled fields at all on the page   ->  ParseError, the layout changed
 *
 * The evidence for a broken parser is the RUN, not the page: one odd course is
 * a catalogue, the same field empty on every course is a selector that stopped
 * matching. snapshot.ts holds those checks.
 */
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { ParseError } from "../errors.js";
import { richBlocks, type Block } from "./rich.js";

export type Era = "modern" | "archive";

export interface ParsedOffering {
  code: string;
  year: number;
  era: Era;
  title: string;
  /**
   * ECTS, or null when the official page does not state it.
   *
   * No course in 2026-2027 has needed the null: all 6,028 checked state their
   * credits. It exists because the catalogue is scraped from a source nobody
   * here controls, so a field the source omits has to be a fact we record
   * rather than a course we lose. See design/catalogue-ingestion.md 12.8.
   */
  ects: number | null;
  /** Official TEACHING hours, not student effort. A different measurement from FR-D6. */
  contactHours: string | null;
  quarter: string | null;
  language: string | null;
  teachers: string[];
  /**
   * FR-D19: scraped, never asked of reviewers.
   *
   * Structured, not flat text. These three fields are mostly lists written in
   * a rich text editor, and a flattened list is unreadable at this length.
   * See rich.ts for the model and the measurements behind it.
   */
  assessment: Block[] | null;
  themes: Block[] | null;
  content: Block[] | null;
  owningFaculty: string | null;
  /**
   * The campuses this course is taught on, where the source states them per
   * course. A LIST, because a course is regularly taught on more than one.
   *
   * UCLouvain states the site on the programme, so this is empty for every one
   * of its courses and their site still comes through the programme. ULB
   * states it here: "Campus / Plaine", with Solbosch, Erasme, Flagey and
   * Charleroi beside it. Optional so a parser that has never heard of it needs
   * no change.
   */
  campuses?: string[];
}

/** Accent and case insensitive, whitespace collapsed. Labels carry <br /> and accents. */
function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function detectEra(html: string): Era {
  if (html.includes("fa_cell_0") || html.includes("fa_cell_1")) return "modern";
  if (html.includes("cdc_cell")) return "archive";
  throw new Error("unrecognised course page layout: neither fa_cell nor cdc_cell present");
}

/**
 * Text with <br /> read as a space, on a COPY of the node.
 *
 * Labels carry <br />, and cheerio's .text() joins across it with nothing,
 * turning "Faculté ou entité<br />en charge" into "entitéen charge" and
 * silently failing every label lookup that spans the break.
 *
 * The first fix for that replaced every <br /> in the document with a space
 * before anything read it, which fixed the labels and destroyed the structure
 * of every value: 3,988 line breaks became spaces and the long fields rendered
 * as one run-on blob. Hence the clone: the substitution now applies where it
 * is wanted and nowhere else. See LESSONS.md.
 */
function flatText($: CheerioAPI, el: AnyNode): string {
  const copy = $(el).clone();
  copy.find("br").replaceWith(" ");
  return copy.text().replace(/\s+/g, " ").trim();
}

/** A field as found on the page: its flat text, and the node it came from. */
interface FieldValue {
  text: string;
  node: AnyNode;
}

/** label -> value, built from whichever markup this era uses. */
function labelledFields($: CheerioAPI, era: Era): Map<string, FieldValue> {
  const out = new Map<string, FieldValue>();
  if (era === "modern") {
    $("div.fa_row").each((_, row) => {
      const label = $(row).find("div.fa_cell_1").first();
      const value = $(row).find("div.fa_cell_2").first();
      if (label.length === 0 || !flatText($, label[0]!) || value.length === 0) return;
      out.set(normalise(flatText($, label[0]!)), {
        text: flatText($, value[0]!),
        node: value[0]!,
      });
    });
  } else {
    $("tr").each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length < 2) return;
      const label = flatText($, cells[0]!);
      if (!label) return;
      out.set(normalise(label), { text: flatText($, cells[1]!), node: cells[1]! });
    });
  }
  return out;
}

/**
 * Look up a field by any of several label spellings.
 *
 * Absent label -> null (the era lacks it).
 * Present label with an empty value -> ALSO null, and the reason is a real page.
 *
 * This used to raise, on the theory that a label with nothing under it meant
 * the layout had changed. `cours-2025-lcems2066` disproved it: UCLouvain
 * publishes the evaluation label with a literal `<div></div>` under it, and the
 * run died on the second faculty ever crawled. Published-and-empty is a third
 * state the rule had no room for, and treating it as a parse failure means one
 * blank field on one page can stop a catalogue of nine thousand courses.
 *
 * WHAT THE OLD RULE WAS GUARDING IS STILL GUARDED, in the place it belongs. A
 * selector that silently stops matching does not empty one field on one page,
 * it empties that field on EVERY page, which is a fact about the run and not
 * about a course. `snapshot.ts` checks exactly that, and the fill rates it is
 * set against were measured: the least populated field in a real 546-course
 * crawl is 84%, so zero across a substantial run cannot happen by accident.
 */
function find(fields: Map<string, FieldValue>, labels: string[]): FieldValue | null {
  for (const [label, value] of fields) {
    if (labels.some((want) => label.includes(normalise(want)))) return value;
  }
  return null;
}

function field(
  fields: Map<string, FieldValue>,
  labels: string[],
  url: string,
  name: string,
): string | null {
  void url;
  void name;
  const found = find(fields, labels);
  if (!found) return null;
  return found.text || null;
}

/** The same lookup, keeping the structure of the value. */
function richField(
  $: CheerioAPI,
  fields: Map<string, FieldValue>,
  labels: string[],
  url: string,
  name: string,
): Block[] | null {
  void url;
  void name;
  const found = find(fields, labels);
  if (!found) return null;
  const blocks = richBlocks($, found.node);
  // The same rule as `field`: published and empty is an absence, not a failure.
  if (!blocks) return null;
  return blocks;
}

/**
 * ECTS from the header, where ZERO IS A REAL ANSWER AND ABSENCE IS ANOTHER.
 *
 * `cours-2026-bmeta1000` publishes "0.00 crédits" beside "18.0 h" and "Q2": a
 * real course, taught, with credits counted somewhere other than on it. Refusing
 * zero as implausible ended a crawl of 6,654 pages after 250 of them, and the
 * course it refused is one a student takes and would then fail to find.
 *
 * A page with NO credits cell yields null. That used to throw, on the reasoning
 * that ECTS is required in every era, and the cost of that reading was the whole
 * course: `cours-2026-wbcmm21021` is a real seminar with a title, a faculty, a
 * quarter and contact hours, and it was being dropped over the one field its
 * page omits.
 *
 * THE UPPER BOUND IS 360, AND 120 WAS WRONG. The course namespace also holds
 * BUNDLE entries standing for a whole programme: `cours-2026-mcomu1000` is
 * titled "Cours du bachelier en technologies numériques pour l'information et
 * la communication" and is worth 180 credits, which is a three year bachelor.
 * It stopped a crawl at 5,000 pages of 6,654.
 *
 * Measured across 6,028 cached pages of 2026-2027, nearly the whole year: 5,885
 * are 15 credits or fewer, 142 are between 16 and 30, NONE is between 31 and
 * 120, and exactly one is 180. So the old ceiling protected nothing in the
 * range it covered, and 360 is the largest a bundle could plausibly be, a six
 * year medicine programme. The real guard against reading the wrong number is
 * the pattern, which requires "cr" immediately after it, so a year or a room
 * number cannot be read as credits.
 *
 * The guard against a layout change moved to the snapshot, where it belongs: a
 * run in which EVERY offering lost its credits is a parser that stopped reading
 * the header, and that is visible only across the whole run.
 *
 * Same lesson as the empty evaluation field two faculties ago. A value the
 * university actually publishes is data, however odd it looks, and the place to
 * notice a broken parser is across the whole run rather than on one page.
 */
function parseEcts(headerCells: string[], url: string): number | null {
  for (const cell of headerCells) {
    const m = /([\d]+(?:[.,][\d]+)?)\s*cr/i.exec(cell);
    if (m?.[1]) {
      const n = Number(m[1].replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 360) {
        throw new ParseError(url, "ects", `implausible value ${m[1]}`);
      }
      return n;
    }
  }
  // Null, not an error and not a zero. The page is understood; it simply does
  // not state credits, and the course is worth keeping for the thirty other
  // fields it does publish.
  return null;
}

export function parseOffering(
  html: string,
  code: string,
  year: number,
  url: string,
): ParsedOffering {
  const era = detectEra(html);
  const $ = cheerio.load(html);

  // NOTE: the document is NOT mutated here. Reading a label with <br /> as a
  // space is done per node, on a clone, by flatText.
  const headerCells =
    era === "modern"
      ? $("div.fa_cell_0")
          .map((_, el) => flatText($, el))
          .get()
      : $("span.cdc_cell")
          .map((_, el) => flatText($, el))
          .get();

  if (headerCells.length === 0) {
    throw new ParseError(url, "header", "no header cells found");
  }

  const rawTitle = $("h1").length ? flatText($, $("h1")[0]!) : "";
  // The archive era puts the code in the heading: "Stage en entreprise [ LFSA2995 ]".
  const title = rawTitle.replace(/\s*\[\s*[A-Za-z]{3,6}\d{3,4}\s*\]\s*$/i, "").trim();
  if (!title) throw new ParseError(url, "title", "no h1 text");

  const fields = labelledFields($, era);
  if (fields.size === 0) {
    throw new ParseError(url, "fields", "no labelled fields found; the layout changed");
  }

  const teachersRaw = field(fields, ["enseignants", "enseignant", "teachers"], url, "teachers");

  return {
    code: code.toLowerCase(),
    year,
    era,
    title,
    ects: parseEcts(headerCells, url),
    // "30.0 h + 30.0 h". Present in both eras, but only as the second header cell.
    contactHours: headerCells.find((c) => /\bh\b/.test(c) && !/cr/i.test(c)) ?? null,
    // The archive era has no quarter at all. Absent by era, not an error.
    quarter: headerCells.find((c) => /^Q[1-4]$/i.test(c)) ?? null,
    language: field(fields, ["langue d'enseignement", "langue"], url, "language"),
    teachers: teachersRaw
      ? teachersRaw
          .split(";")
          // Roles trail the name and may nest: "(coordinateur(trice))",
          // "(supplée X)". Cut at the first parenthesis rather than trying to
          // match balanced pairs, which leaves stray brackets behind.
          .map((t) => t.split("(")[0]!.replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 1)
      : [],
    assessment: richField(
      $,
      fields,
      ["modes d'evaluation", "mode d'evaluation", "evaluation"],
      url,
      "assessment",
    ),
    themes: richField($, fields, ["themes abordes"], url, "themes"),
    content: richField($, fields, ["contenu"], url, "content"),
    owningFaculty: entity(
      field(
        fields,
        ["faculte ou entite en charge", "faculte en charge", "entite en charge"],
        url,
        "owningFaculty",
      ),
    ),
  };
}

/**
 * The entity in charge, without the arrow the page draws it with.
 *
 * UCLouvain renders this field as a breadcrumb, so the scraped value is
 * "> EPL" rather than "EPL". It was stored and displayed with the arrow, which
 * showed up on the course page as "Faculté en charge: > BTCI". Stripped at the
 * parse rather than at the screen, because it is not a display concern: the
 * arrow is punctuation from the surrounding page, not part of the value, and a
 * filter grouping by entity would otherwise group on it.
 */
function entity(raw: string | null): string | null {
  if (raw === null) return null;
  const cleaned = raw.replace(/^\s*>\s*/, "").trim();
  return cleaned === "" ? null : cleaned;
}

/**
 * The language a course is actually taught in.
 *
 * UCLouvain states the teaching language and any accommodation in one field,
 * separated by an angle bracket:
 *
 *   "Anglais > Facilités pour suivre le cours en français"
 *   "Français > English-friendly"
 *
 * The whole string belongs on the course page, because the accommodation is
 * exactly what a hesitant student needs to read. A filter needs the first part
 * alone: without this, "Anglais" and "Anglais > Facilités..." are two different
 * languages and the filter offers eight options for five languages.
 */
export function mainLanguage(language: string | null): string | null {
  if (language === null) return null;
  const main = language.split(">")[0]!.trim();
  return main === "" ? null : main;
}
