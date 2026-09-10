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
 * docs/design/catalogue-ingestion.md section 3.1 requires ECTS in every era and
 * requires "absent because the era lacks the field" to be distinguishable from
 * "absent because the parse broke". The rule that separates them is in
 * errors.ts: a missing LABEL is absent by era, a present label with no value is
 * a ParseError.
 */
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { ParseError } from "../errors.js";

export type Era = "modern" | "archive";

export interface ParsedOffering {
  code: string;
  year: number;
  era: Era;
  title: string;
  /** ECTS. Required in every era. */
  ects: number;
  /** Official TEACHING hours, not student effort. A different measurement from FR-D6. */
  contactHours: string | null;
  quarter: string | null;
  language: string | null;
  teachers: string[];
  /** FR-D19: scraped, never asked of reviewers. */
  assessment: string | null;
  themes: string | null;
  content: string | null;
  owningFaculty: string | null;
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

/** label -> value, built from whichever markup this era uses. */
function labelledFields($: CheerioAPI, era: Era): Map<string, string> {
  const out = new Map<string, string>();
  if (era === "modern") {
    $("div.fa_row").each((_, row) => {
      const label = $(row).find("div.fa_cell_1").first().text();
      const value = $(row).find("div.fa_cell_2").first();
      if (!label.trim() || value.length === 0) return;
      out.set(normalise(label), value.text().replace(/\s+/g, " ").trim());
    });
  } else {
    $("tr").each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length < 2) return;
      const label = $(cells[0]!).text();
      if (!label.trim()) return;
      out.set(normalise(label), $(cells[1]!).text().replace(/\s+/g, " ").trim());
    });
  }
  return out;
}

/**
 * Look up a field by any of several label spellings.
 * Absent label  -> null (the era lacks it).
 * Present label with an empty value -> ParseError (the layout changed).
 */
function field(
  fields: Map<string, string>,
  labels: string[],
  url: string,
  name: string,
): string | null {
  for (const [label, value] of fields) {
    if (labels.some((want) => label.includes(normalise(want)))) {
      if (!value) throw new ParseError(url, name, "label present but value empty");
      return value;
    }
  }
  return null;
}

function parseEcts(headerCells: string[], url: string): number {
  for (const cell of headerCells) {
    const m = /([\d]+(?:[.,][\d]+)?)\s*cr/i.exec(cell);
    if (m?.[1]) {
      const n = Number(m[1].replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || n > 120) {
        throw new ParseError(url, "ects", `implausible value ${m[1]}`);
      }
      return n;
    }
  }
  throw new ParseError(url, "ects", "no credits cell found; ECTS is required in every era");
}

export function parseOffering(
  html: string,
  code: string,
  year: number,
  url: string,
): ParsedOffering {
  const era = detectEra(html);
  const $ = cheerio.load(html);

  // Labels carry <br />, and cheerio's .text() joins across it with nothing,
  // turning "Faculté ou entité<br />en charge" into "entitéen charge" and
  // silently failing every label lookup that spans the break. Replace breaks
  // with whitespace once, before anything reads text.
  $("br").replaceWith(" ");

  const headerCells =
    era === "modern"
      ? $("div.fa_cell_0")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
      : $("span.cdc_cell")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get();

  if (headerCells.length === 0) {
    throw new ParseError(url, "header", "no header cells found");
  }

  const rawTitle = $("h1").first().text().replace(/\s+/g, " ").trim();
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
    assessment: field(
      fields,
      ["modes d'evaluation", "mode d'evaluation", "evaluation"],
      url,
      "assessment",
    ),
    themes: field(fields, ["themes abordes"], url, "themes"),
    content: field(fields, ["contenu"], url, "content"),
    owningFaculty: field(
      fields,
      ["faculte ou entite en charge", "faculte en charge", "entite en charge"],
      url,
      "owningFaculty",
    ),
  };
}
