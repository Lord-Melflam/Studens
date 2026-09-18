/**
 * The three long fields, which live only on a ULB course page.
 *
 * The programme listing carries everything else, so this is a SECOND pass and
 * costs one request per course rather than one per programme: about 5,400
 * against 286. That is why it is a flag and not the default.
 *
 * The page's shape is regular and needs no guessing: each section is an
 * `h2.paragraphe__titre--1` holding the label, followed by a
 * `.paragraphe__contenu--1` holding the prose. The label is matched on, not the
 * position, because a section a course does not have is simply absent and the
 * next one takes its place.
 *
 * No HTML from ULB reaches a screen: `richBlocks` turns it into the same closed
 * set of shapes UCLouvain's prose goes through, so there is no sanitiser in the
 * path and one renderer serves both.
 */
import * as cheerio from "cheerio";
import { richBlocks, type Block } from "../../ingestion/parse/rich.js";
import { normaliseName } from "./faculties.js";

export interface UlbCourseProse {
  /** "Contenu du cours". */
  content: Block[] | null;
  /** "Evaluation", which ULB titles more plainly than UCLouvain does. */
  assessment: Block[] | null;
  /**
   * The campuses, as published: "Plaine", "Solbosch", "Erasme", "Flagey".
   *
   * A LIST, because a course is regularly taught on more than one. ULB writes
   * them comma-separated in one field, and on a 149-course slice five courses
   * read "Solbosch, Flagey" and one lists five at once. Kept as one string,
   * every combination would have become its own site and a filter would have
   * offered "Flagey, Hors campus ULB, Autre campus, Plaine, Solbosch" as a
   * place to go.
   *
   * Empty where the page does not say. "Autre campus" and "Hors campus ULB"
   * are values ULB publishes, not missing ones, and are kept as published.
   */
  campuses: string[];
}

/**
 * WHAT IS DELIBERATELY NOT MAPPED, and why it is not an oversight.
 *
 * ULB publishes "Objectifs (et/ou acquis d'apprentissages spécifiques)",
 * "Pré-requis et Co-requis", "Méthodes d'enseignement et activités
 * d'apprentissages" and "Contribution au profil d'enseignement". The catalogue
 * has no column for any of them.
 *
 * `themes` is the tempting home for the objectives and it is the wrong one.
 * UCLouvain's `themes` is "Thèmes abordés", the topics a course covers;
 * objectives are what a student should be able to do afterwards. Putting one in
 * the other's column would make a field mean two things depending on which
 * university a row came from, and nothing on screen would say so.
 */
const WANTED: Array<{ label: string; field: "content" | "assessment" }> = [
  { label: "contenu du cours", field: "content" },
  { label: "evaluation", field: "assessment" },
];

export function parseCourseProse(html: string): UlbCourseProse {
  const $ = cheerio.load(html);
  const out: UlbCourseProse = { content: null, assessment: null, campuses: [] };

  /**
   * The campus sits under an h3 inside a section, not under one of the h2s
   * above, so it is found on its own rather than by walking the sections.
   *
   * Matched on the heading and not the position: "Autres renseignements" holds
   * contacts, the campus and anything else ULB has to add, in whatever order a
   * given course happens to have them.
   */
  $("h3").each((_, el) => {
    if (out.campuses.length > 0) return;
    if (normaliseName($(el).text()) !== "campus") return;
    const value = $(el).nextAll("p").first().text().replace(/\s+/g, " ").trim();
    out.campuses = value
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  });

  $("h2.paragraphe__titre--1").each((_, el) => {
    const label = normaliseName($(el).text());
    const want = WANTED.find((w) => w.label === label);
    if (!want || out[want.field] !== null) return;
    // The prose is the sibling that follows the heading, not a descendant of
    // it. `nextAll().first()` rather than `next()` because ULB puts comment
    // nodes and whitespace between the two.
    const body = $(el).nextAll(".paragraphe__contenu--1").first();
    if (body.length === 0) return;
    out[want.field] = richBlocks($, body[0]!);
  });

  return out;
}
