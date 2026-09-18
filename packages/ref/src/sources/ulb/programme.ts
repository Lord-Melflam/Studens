/**
 * Reading one ULB programme page.
 *
 * The page is where the organisers, the title and the kind come from. The
 * COURSES do not come from here: the page carries no list and fetches one from
 * `/api/formation`. See listing.ts.
 */
import * as cheerio from "cheerio";
import { facultyOf, parseFaculties, type UlbFaculty } from "./faculties.js";

export interface UlbProgramme {
  code: string;
  title: string;
  /** Every organiser as published, ULB faculties and partners together. */
  organisers: string[];
  /** The ULB faculty among them, or null when none of them is one. */
  faculty: string | null;
  /** From the code, which is where ULB states it. Null when it states none. */
  kind: string | null;
  /** 120 or 60 for a master whose code says so. */
  credits: number | null;
  /**
   * The path the page's own script asks `/api/formation` for, as published.
   *
   * READ, NOT BUILT. It was built from the programme code at first, on the
   * assumption that `2025-ba-biolb` means `anet=BA-BIOLB`. Two programmes in a
   * trial crawl proved otherwise and answered 404, so the assumption was
   * costing real course lists. The page states the parameter; there is no
   * reason to guess it.
   *
   * Null when the page carries no such block, which is ordinary: on 80
   * programmes sampled, 9 have none.
   */
  listingPath: string | null;
}

/**
 * What a ULB programme code says about the programme.
 *
 * `ba-tecn`, `ma-inge`, `ma60-es3sh`, `ms-urde`, `m-bimes`. The prefix is
 * ULB's own statement of the kind, which is better than parsing it out of a
 * title the way UCLouvain's has to be: UCLouvain writes the kind into the name
 * and ULB writes it into the identifier.
 *
 * Anything else keeps a null. `poli4` and `capaes` are real prefixes and this
 * does not know what they are, and guessing would put a word in a column that
 * a filter then offers as if somebody had published it.
 */
export function kindFromCode(code: string): { kind: string | null; credits: number | null } {
  const prefix = code.toLowerCase().split("-")[0] ?? "";
  switch (prefix) {
    case "ba":
      return { kind: "bachelier", credits: 180 };
    case "ma":
      return { kind: "master", credits: 120 };
    case "ma60":
      return { kind: "master", credits: 60 };
    // A master de spécialisation: a master, and its length is not in the code.
    case "ms":
      return { kind: "master", credits: null };
    case "m":
      return { kind: "master", credits: null };
    default:
      return { kind: null, credits: null };
  }
}

/** `2025-ba-tecn` in `https://www.ulb.be/fr/programme/2025-ba-tecn`. */
export function programmeCodeFrom(url: string): { year: number; code: string } | null {
  const m = /\/programme\/(\d{4})-([a-z0-9-]+)(?:[/?#]|$)/i.exec(url);
  if (!m) return null;
  return { year: Number(m[1]), code: m[2]!.toLowerCase() };
}

export function parseProgramme(
  html: string,
  code: string,
  known?: UlbFaculty[],
): UlbProgramme {
  const $ = cheerio.load(html);

  // "Faculté(s) et université(s) organisatrice(s)", then a list. Located by its
  // text because the surrounding markup carries no identifier of its own.
  const organisers: string[] = [];
  $("strong").each((_, el) => {
    const label = $(el).text().toLowerCase();
    if (!label.includes("organisatrice")) return;
    $(el)
      .nextAll("ul")
      .first()
      .find("li")
      .each((__, li) => {
        const name = $(li).text().replace(/\s+/g, " ").trim();
        if (name) organisers.push(name);
      });
  });

  const title = ($("title").first().text() || "").replace(/\s*-\s*ULB\s*$/i, "").trim();
  const faculties = known ?? parseFaculties(html);
  const { kind, credits } = kindFromCode(code);

  return {
    code,
    title,
    organisers,
    faculty: facultyOf(organisers, faculties),
    kind,
    credits,
    // The block the page's own script replaces with the course list. Absent on
    // roughly one programme page in nine, which is the same shape UCLouvain's
    // 247 programmes with no course list have: real, and to be recorded rather
    // than treated as a failure (design 12.12).
    // `js-formation__programme`, NOT the first `js-formation-ulb`. A programme
    // page carries two of those blocks: the course list and the admission
    // conditions. Taking the first fetched `/ksup/accesscond`, which answers
    // 200 with perfectly good JSON containing no courses, so all 286
    // programmes came back "empty" and nothing looked broken. A wrong endpoint
    // that succeeds is worse than one that fails.
    listingPath:
      $(".js-formation__programme[data-attribute-url]").first().attr("data-attribute-url") ??
      null,
  };
}
