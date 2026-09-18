/**
 * Discovering ULB's faculties, from ULB.
 *
 * Every page on www.ulb.be carries a footer column headed "Facultés, instituts
 * et écoles", listing each one linked to its own subdomain. That subdomain is
 * the code: `phisoc`, `ltc`, `droit`, `sbsem`, `psycho`, `archi`, `sciences`,
 * `polytech`, `medecine`, `esp`, `fsm`, `pharmacie`. Twelve on 2026-09-18.
 *
 * ULB's own list, read at runtime, and it costs no request: the crawl is
 * fetching programme pages anyway and every one of them carries it.
 *
 * WHY IT IS NEEDED AT ALL. A programme page names its organisers, and that list
 * mixes ULB's faculties with partner universities and hautes écoles. On
 * `ba-tecn` it reads: Faculté de Lettres, then Université Catholique de
 * Louvain, then two hautes écoles. Nothing on the page marks which is which,
 * and their pages are indistinguishable, so the only way to tell is to know
 * what ULB's faculties are.
 */
import * as cheerio from "cheerio";

export interface UlbFaculty {
  /** From the subdomain: `ltc` for `https://ltc.ulb.be/`. ULB's own handle. */
  code: string;
  name: string;
}

/**
 * A name reduced to what two spellings of it have in common.
 *
 * NOT TIDINESS. Matching organiser names against the footer list failed for two
 * whole faculties, silently, because the two places ULB writes them disagree:
 *
 *   footer    "Faculté de Psychologie, des Sciences de l’Éducation et de ..."
 *   programme "Faculté de Psychologie, des Sciences de l'Education et de ..."
 *
 *   footer    "Faculté des Sciences de la Motricité humaine"
 *   programme "Faculté des Sciences de la motricité humaine"
 *
 * A curly apostrophe against a straight one, an accented capital against a
 * plain one, a capital against a lowercase. Twelve programmes of eighty would
 * have been filed under no faculty, plausibly and wrongly.
 */
export function normaliseName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `ltc` from `https://ltc.ulb.be/`. Empty when the href is not a subdomain. */
function subdomain(href: string): string {
  const host = /^https?:\/\/([^/]+)/.exec(href)?.[1] ?? "";
  const parts = host.split(".");
  return parts.length >= 3 && parts.slice(-2).join(".") === "ulb.be" ? parts[0]!.toLowerCase() : "";
}

export function parseFaculties(html: string): UlbFaculty[] {
  const $ = cheerio.load(html);
  const out: UlbFaculty[] = [];
  const seen = new Set<string>();

  // The column is found by its heading rather than by its class, because
  // `footer_ligne2__col3` is a position and positions move.
  $("button.footer_col__titre").each((_, el) => {
    const heading = normaliseName($(el).text());
    if (!heading.includes("facultes")) return;
    const list = $(el).parent().find("ul.footer_col__liste-puce").first();
    list.find("li a[href]").each((__, a) => {
      const code = subdomain($(a).attr("href") ?? "");
      const name = $(a).find("span").last().text().replace(/\s+/g, " ").trim();
      if (!code || !name || seen.has(code)) return;
      seen.add(code);
      out.push({ code, name });
    });
  });

  return out;
}

/** Which of a programme's organisers is an ULB faculty, or null for none. */
export function facultyOf(organisers: string[], faculties: UlbFaculty[]): string | null {
  const byName = new Map(faculties.map((f) => [normaliseName(f.name), f.code]));
  for (const o of organisers) {
    const code = byName.get(normaliseName(o));
    if (code) return code;
  }
  return null;
}
