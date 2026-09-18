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
   * Four more that both universities publish, under different names.
   *
   * ULB's labels on the left, UCLouvain's on the right:
   *   "Objectifs (et/ou acquis ...)"      / "Acquis d'apprentissage"
   *   "Pré-requis et Co-requis"           / "Préalables"
   *   "Méthodes d'enseignement et ..."    / "Méthodes d'enseignement"
   *   "Références, bibliographie et ..."  / "Bibliographie"
   *
   * The objectives used to be deliberately dropped, because the only column
   * that could have held them was `themes` and that means something else.
   * They have a column of their own now, so they are read.
   */
  objectives: Block[] | null;
  prerequisites: Block[] | null;
  teachingMethods: Block[] | null;
  bibliography: Block[] | null;
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
 * The sections read, by the label ULB gives them.
 *
 * Matched on a normalised label, so the curly apostrophe and the accents that
 * differ between ULB's own pages cannot make a section vanish. `normaliseName`
 * is the same function that stopped two whole faculties matching nothing.
 *
 * WHAT IS STILL NOT MAPPED, and why it is not an oversight. ULB also publishes
 * "Contribution au profil d'enseignement" and "Support(s) de cours". The first
 * is about the programme rather than the course; the second is a list of
 * materials, and neither has a column. When one is wanted it gets a column of
 * its own rather than being folded into a field that means something else,
 * which is the rule that kept the objectives out until they had one.
 */
const WANTED: Array<{ label: string; field: ProseField }> = [
  { label: "contenu du cours", field: "content" },
  { label: "evaluation", field: "assessment" },
  { label: "objectifs et ou acquis d apprentissages specifiques", field: "objectives" },
  { label: "pre requis et co requis", field: "prerequisites" },
  { label: "methodes d enseignement et activites d apprentissages", field: "teachingMethods" },
  { label: "references bibliographie et lectures recommandees", field: "bibliography" },
];

type ProseField =
  | "content"
  | "assessment"
  | "objectives"
  | "prerequisites"
  | "teachingMethods"
  | "bibliography";

export function parseCourseProse(html: string): UlbCourseProse {
  const $ = cheerio.load(html);
  const out: UlbCourseProse = {
    content: null,
    assessment: null,
    objectives: null,
    prerequisites: null,
    teachingMethods: null,
    bibliography: null,
    campuses: [],
  };

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

  /**
   * SOME OF THEM ARE ONE LEVEL DOWN, and the bibliography is one.
   *
   * "Références, bibliographie et lectures recommandées" is not a section of
   * its own: it is an `h3` inside another, beside "Support(s) de cours" and,
   * elsewhere, the campus. Reading only the `h2` sections found it nowhere and
   * left the column null on every ULB course, which would have looked exactly
   * like a university that publishes no bibliography.
   *
   * The block is everything between this heading and the next one, since there
   * is no wrapper to grab. Collected rather than taking the first element,
   * because the content is a paragraph on one course and a list on the next.
   */
  $(".paragraphe__contenu--1 h3").each((_, el) => {
    const label = normaliseName($(el).text());
    const want = WANTED.find((w) => w.label === label);
    if (!want || out[want.field] !== null) return;
    const parts = $(el)
      .nextUntil("h3")
      .toArray()
      .flatMap((node) => richBlocks($, node) ?? []);
    out[want.field] = parts.length > 0 ? parts : null;
  });

  return out;
}
