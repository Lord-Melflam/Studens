/**
 * The catalogue SEARCH application, which is a different source from the pages
 * the rest of this crawl walks.
 *
 * `catalogue-formations.uclouvain.be` is server-rendered HTML driven by GET
 * parameters, and its result rows carry, in one place, what the programme pages
 * never state: the site a programme is taught at, its field of study as the
 * decree names it, and the faculty that organises it. See
 * design/catalogue-ingestion.md 10.
 *
 * WHY THIS IS NOT THE ONLY SOURCE. The search returns 605 programmes for
 * 2025-2026 and drops minors and doctorates; the per-faculty index returns 692
 * and includes 62 minors, which is exactly the thing somebody is choosing at PAE
 * time. So neither replaces the other, and `crawl.ts` reconciles them.
 *
 * ROWS ARE READ BY THEIR ICON, which looks fragile and is the only handle the
 * markup offers: the list items carry no class, no label and no order that can
 * be relied on, only a leading `<i class="bi bi-...">`. A row whose icons change
 * therefore yields nulls rather than wrong values, and `crawl.ts` treats a field
 * it could not read as not stated. That is the same rule the offering parser
 * follows: absent because the source lacks it must stay distinguishable from
 * absent because the parse broke.
 */
import * as cheerio from "cheerio";

export interface SearchRow {
  /** The programme or course code, lowercased. */
  code: string;
  title: string;
  /** As published, for instance "Louvain-la-Neuve" or "Autre site". */
  site: string | null;
  /** The decree's field of study, for instance "Sciences juridiques". */
  domain: string | null;
  /** The teaching language as a two-letter code, for instance "FR". */
  language: string | null;
  /** Q1, Q2 and so on for a course; the schedule for a programme. */
  period: string | null;
  /** The short code of the organising faculty, for instance "EPL". */
  faculty: string | null;
}

/** The icon that precedes each field. The markup gives nothing else to go on. */
const ICON = {
  period: "bi-clock-fill",
  site: "bi-signpost-split-fill",
  domain: "bi-mortarboard",
  language: "bi-mic-fill",
} as const;

/**
 * A stable identifier for a published label.
 *
 * Deterministic and derived, never invented: "Bruxelles Saint-Louis" is always
 * `bruxelles-saint-louis`, so a re-crawl matches the row it wrote last time.
 * Accents are folded because the same site is spelled with and without them
 * across UCLouvain's own pages.
 */
export function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Every result row on a search page.
 *
 * `kind` picks which links count, because one page holds one document type and
 * the two carry different URL shapes. An empty result is NOT an error here,
 * unlike `extractLinks`: a search legitimately returns nothing for a faculty
 * that offers no programme of that type, and the caller knows which it asked
 * for.
 */
export function parseSearchRows(
  html: string,
  kind: "programme" | "course",
  year: number,
): SearchRow[] {
  const $ = cheerio.load(html);
  const segment = kind === "programme" ? "prog" : "cours";
  // The English pages use `en-cours-...`; the year is pinned so a link to
  // another year's page, which the chrome does carry, cannot be read as a result.
  const href = new RegExp(`/(?:en-)?${segment}-${year}-([a-z0-9]+)(?:[/?#]|$)`, "i");

  const rows: SearchRow[] = [];
  const seen = new Set<string>();

  $(".formation-item").each((_, el) => {
    const item = $(el);
    const link = item.find(".formation-item__title a[href]").first();
    const m = href.exec(link.attr("href") ?? "");
    if (!m?.[1]) return;
    const code = m[1].toLowerCase();
    if (seen.has(code)) return;
    seen.add(code);

    const fields: Record<string, string | null> = {
      period: null,
      site: null,
      domain: null,
      language: null,
    };
    item.find(".formation-item__list li").each((__, li) => {
      const cell = $(li);
      const icon = cell.find("i").first().attr("class") ?? "";
      const value = cell.text().replace(/\u00a0/g, " ").trim();
      if (value === "") return;
      for (const [field, marker] of Object.entries(ICON)) {
        if (icon.includes(marker)) fields[field] = value;
      }
    });

    const faculty = item.find(".formation-item__school strong").first().text().trim();

    rows.push({
      code,
      title: link.text().replace(/\u00a0/g, " ").trim(),
      site: fields["site"] ?? null,
      domain: fields["domain"] ?? null,
      language: fields["language"] ?? null,
      period: fields["period"] ?? null,
      faculty: faculty === "" ? null : faculty,
    });
  });

  return rows;
}
