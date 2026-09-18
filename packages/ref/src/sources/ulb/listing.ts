/**
 * Reading ULB's programme listing.
 *
 * WHERE A ULB COURSE ROW COMES FROM, and it is not the course page. The
 * programme page on www.ulb.be carries no course list: it fetches one from
 * `/api/formation`, which answers with JSON wrapping rendered HTML. That
 * listing carries, per course, everything a summary needs except the long
 * prose fields: the code, the title, the language, the quadrimester, the
 * lecturers, the credits and the contact hours.
 *
 * That is worth about twenty times the requests. ULB publishes roughly 286
 * programmes in French against several thousand courses, so one request per
 * programme fills most of the catalogue and the per-course pages are needed
 * only for content, objectives and the assessment method.
 *
 * It also differs from UCLouvain in a way worth stating plainly: UCLouvain
 * publishes the quadrimester on the COURSE page and ULB does not, and ULB
 * publishes it on the LISTING and UCLouvain does not. Neither is missing it.
 * They put it in different places, which is the whole reason a source is an
 * interface and not a flag.
 *
 * No HTML from ULB reaches a screen from here: this produces plain fields, and
 * the long prose goes through the same block model as UCLouvain's (rich.ts).
 */
import * as cheerio from "cheerio";

export interface ListedCourse {
  /** `comm-b1010`, lowercased to match how every other code is stored. */
  code: string;
  title: string;
  /** As published: `fr`, `en`. Null when the row omits it. */
  language: string | null;
  /** "premier quadrimestre" and the like, as published. Null when absent. */
  quarter: string | null;
  teachers: string[];
  /** Null when the row states no credits, never 0 as a stand-in. */
  ects: number | null;
  /** "cours magistral: 24h", the teaching hours as published. */
  contactHours: string | null;
}

/** `comm-b1010` in `https://www.ulb.be/fr/programme/2025-comm-b1010`. */
const COURSE_HREF = /\/programme\/\d{4}-([a-z]+-[a-z]\d{3,4})(?:[/?#]|$)/i;

/**
 * A lecturer's name without the role ULB appends.
 *
 * "Someone Someone (Coordonnateur)" is a name and a role, and the role belongs
 * to the programme rather than to the person. UCLouvain's parser cuts at the
 * first parenthesis for the same reason and against the same shape.
 */
function teacherName(raw: string): string {
  return raw.split("(")[0]!.replace(/\s+/g, " ").trim();
}

/**
 * The credits line: "5 crédits [cours magistral: 24h]".
 *
 * Both halves are optional in principle, so each is read on its own and a row
 * missing one keeps the other. A course whose credits are absent is a course
 * we keep and say so about, never a course we drop: design 12.8.
 */
export function parseCredits(raw: string): { ects: number | null; contactHours: string | null } {
  const text = raw.replace(/\s+/g, " ").trim();
  const credits = /(\d+(?:[.,]\d+)?)\s*cr[ée]dits?/i.exec(text);
  const hours = /\[([^\]]+)\]/.exec(text);
  const ects = credits ? Number(credits[1]!.replace(",", ".")) : null;
  return {
    // A value that is not a number is not a number of credits. Guarded rather
    // than trusted, because this is a string from a source we do not control.
    ects: ects !== null && Number.isFinite(ects) ? ects : null,
    contactHours: hours ? hours[1]!.replace(/\s+/g, " ").trim() : null,
  };
}

export interface ParsedListing {
  courses: ListedCourse[];
  /** Rows that are not courses, with why. Reported rather than dropped quietly. */
  skipped: Array<{ code: string; reason: "no title" | "placeholder" }>;
}

/**
 * A code whose number is all zeros is a slot, not a course.
 *
 * ULB uses two: `HULB-0000` "Cours externe à l'Université" and `TEMP-0000`
 * "Cours extérieurs au programme". They are allowances, a way of saying "spend
 * this many credits outside the programme", and they appear 374 times across
 * the 2025 crawl with credits from 5 to 60 depending on where they sit.
 *
 * They cannot be kept. A course code is unique within a catalogue, so 374 rows
 * would collapse into one course carrying whichever credit figure was written
 * last, and nobody can review "Cours extérieurs au programme": it is not a
 * thing anybody took.
 *
 * Distinguished by the all-zero number rather than by listing the two codes,
 * because that is ULB's convention and a list of two would not survive a third.
 */
export function isPlaceholderCode(code: string): boolean {
  return /^[a-z]+-0+$/i.test(code);
}

export function parseListing(html: string, year: number): ListedCourse[] {
  return parseListingFully(html, year).courses;
}

/**
 * ONE ACADEMIC YEAR, AND THE RESPONSE HOLDS SEVERAL.
 *
 * `/api/formation` answers with every year it has, not the one asked for. For
 * `BA-TECN` on 2026-09-18 that is 48 course items for 2025-2026 and 42 for
 * 2026-2027, one after another in the same document, and the metadata beside
 * them says the DEFAULT year is 2026.
 *
 * Read without filtering, every course of both years was filed under one, with
 * whichever block came first winning on a code present in both. A catalogue
 * that silently mixes two academic years is worse than one that is a year out
 * of date: FR-D16 exists because a review states its own year, and it cannot
 * if the year on the offering is a guess.
 *
 * The year is on the inner element's id, `a2025b1c1`, which is ULB's own
 * marker and not a position anything here invented.
 */
export function parseListingFully(html: string, year: number): ParsedListing {
  const $ = cheerio.load(html);
  const out: ListedCourse[] = [];
  const skipped: ParsedListing["skipped"] = [];
  const seen = new Set<string>();

  const wanted = `a${year}`;
  $(".prg-course-item").each((_, el) => {
    const item = $(el);
    const marker = item.find(".prg-cours[id]").first().attr("id") ?? "";
    if (!marker.startsWith(wanted)) return;
    const code = item.find(".prg-coursMnemonique").first().text().trim().toLowerCase();
    // The href carries the code too, read as a second chance rather than
    // trusted as the only one. A row with neither is not a course anything can
    // be filed under.
    const href = item.find(".prg-coursIntitule a[href]").first().attr("href") ?? "";
    const fromHref = COURSE_HREF.exec(href)?.[1]?.toLowerCase() ?? "";
    const id = code || fromHref;
    if (!id || seen.has(id)) return;
    seen.add(id);

    const title = item.find(".prg-coursIntitule a").first().text().replace(/\s+/g, " ").trim();
    const language = item.find(".prg-coursLangue").first().text().trim() || null;
    const quarter =
      item.find(".prg-coursQuadrimestreCarte").first().text().replace(/\s+/g, " ").trim() || null;
    const teachers = item
      .find(".prg-coursTitulaires span")
      .map((__, s) => teacherName($(s).text()))
      .get()
      .filter((n) => n.length > 1);

    const credits = item.find(".prg-coursCredits").first().clone();
    // The quadrimester is repeated inside the credits line. Removed before
    // reading it, or "premier quadrimestre" ends up inside the contact hours.
    credits.find(".prg-coursQuadrimestreListe").remove();
    const { ects, contactHours } = parseCredits(credits.text());

    /**
     * A ROW WITH NO TITLE IS A PLACEHOLDER, NOT A COURSE.
     *
     * ULB publishes some entries as a code and nothing else: the link text is
     * empty, `data-nre` is empty, and there are no credits, no hours, no
     * language and no lecturers. Their own course pages are titled "-".
     *
     * Measured across the full 2025 crawl: 134 such rows, 42 distinct courses,
     * out of 62,707 rows. Every one of the 134 carries no credits, no hours,
     * no language and no lecturer, so there is no other field to lose.
     *
     * That is the difference from a course with no credits, which is KEPT
     * (design 12.8): dropping one of those would have cost the thirty fields
     * the source does publish about it. Here the source publishes nothing, so
     * keeping the row would put a course in the catalogue that no reader can
     * identify and no reviewer can recognise.
     *
     * Returned to the caller rather than dropped in silence, so a run can say
     * how many it saw.
     */
    if (isPlaceholderCode(id)) {
      skipped.push({ code: id, reason: "placeholder" });
      return;
    }
    if (!title) {
      skipped.push({ code: id, reason: "no title" });
      return;
    }

    out.push({ code: id, title, language, quarter, teachers, ects, contactHours });
  });

  return { courses: out, skipped };
}
