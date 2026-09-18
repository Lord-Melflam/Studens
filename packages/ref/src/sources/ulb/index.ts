/**
 * ULB, as a source.
 *
 * THE SHAPE, and it has nothing in common with UCLouvain's. There is no faculty
 * index to walk. There is a sitemap listing every programme, a programme page
 * carrying the organisers and the title, and a listing endpoint carrying the
 * courses. Three steps, and the third is where almost everything comes from.
 *
 * WHAT THIS PASS COLLECTS, and what it does not. The listing gives the code,
 * title, language, quadrimester, lecturers, credits and teaching hours for
 * every course, which is one request per programme rather than one per course:
 * about 580 requests for the whole catalogue against the 6,000 a per-course
 * crawl would take. The three long prose fields, content, objectives and the
 * assessment method, live only on the course pages and are NOT fetched here.
 * They are null, which the interface already means as "the source does not
 * state it", and a second pass can fill them.
 *
 * That is a deliberate order, not an oversight. A catalogue with every fact and
 * no long text is worth loading while the rest is still being fetched; the
 * reverse is not true. It is stated on screen rather than implied: a ULB course
 * simply has no assessment section until the second pass exists.
 */
import { PoliteFetcher } from "../../ingestion/http.js";
import type { Snapshot, SnapshotProgramme } from "../../ingestion/snapshot.js";
import type { ParsedOffering } from "../../ingestion/parse/offering.js";
import type { CatalogueSource, SourceCrawlOptions } from "../index.js";
import { parseFaculties, type UlbFaculty } from "./faculties.js";
import { parseProgramme, programmeCodeFrom } from "./programme.js";
import { parseListing } from "./listing.js";

const BASE = "https://www.ulb.be";

/** Where ULB lists every page it publishes. One request, and it is permitted:
    robots.txt disallows only /adminsite/, /fcktoolbox/, /extensions/,
    /META_INF/, /WEB_INF/ and /action/*, and names this file itself. */
export const SITEMAP = `${BASE}/sitemap.xml`;

export function courseUrl(year: number, code: string): string {
  return `${BASE}/fr/programme/${year}-${code}`;
}

/** The same namespace as a course, which is ULB's doing and not a mistake here. */
export function programmeUrl(year: number, code: string): string {
  return `${BASE}/fr/programme/${year}-${code}`;
}

/**
 * The listing endpoint, given the path the programme page itself published.
 *
 * The `path` parameter is a second URL, so it is encoded as one value.
 *
 * The path is taken from the page rather than built from the programme code.
 * Building it assumed `2025-ba-biolb` means `anet=BA-BIOLB`, which is true of
 * almost every programme and was false for two in a trial crawl: both answered
 * 404 and lost their course lists. The page says what to ask for.
 */
export function listingUrl(path: string): string {
  return `${BASE}/api/formation?path=${encodeURIComponent(path)}`;
}

/** French programme URLs for one year, from the sitemap. */
export function programmeUrlsFrom(sitemapXml: string, year: number): string[] {
  const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const want = new RegExp(`/fr/programme/${year}-`);
  return [...new Set(urls.filter((u) => want.test(u)))].sort();
}

/**
 * The most recent year the sitemap actually carries.
 *
 * Probed rather than assumed, the same rule UCLouvain's `resolveYear` follows:
 * ULB publishes next year's programmes before the year starts, exactly as
 * UCLouvain does, so a date is not an answer.
 */
export function latestYearIn(sitemapXml: string): number | null {
  const years = [...sitemapXml.matchAll(/\/fr\/programme\/(\d{4})-/g)].map((m) => Number(m[1]));
  return years.length ? Math.max(...years) : null;
}

async function crawlUlb(opts: SourceCrawlOptions = {}): Promise<Snapshot> {
  const fetcher = opts.fetcher ?? new PoliteFetcher();
  const say = opts.onProgress ?? ((): void => undefined);

  const sitemap = (await fetcher.get(SITEMAP)).html;
  const year = opts.year ?? latestYearIn(sitemap);
  if (year === null) throw new Error("the ULB sitemap lists no programme for any year");
  const urls = programmeUrlsFrom(sitemap, year);
  if (urls.length === 0) throw new Error(`the ULB sitemap lists no programme for ${year}`);
  say(`ulb: ${urls.length} programmes listed for ${year}-${year + 1}`);

  const programmes: SnapshotProgramme[] = [];
  const offerings: ParsedOffering[] = [];
  const reachedVia: Array<{ code: string; faculty: string; programme: string }> = [];
  const unavailable: string[] = [];
  const seenCourse = new Set<string>();
  let faculties: UlbFaculty[] = [];

  for (const [i, url] of urls.entries()) {
    if (opts.maxOfferings !== undefined && offerings.length >= opts.maxOfferings) break;
    const parsed = programmeCodeFrom(url);
    if (!parsed) continue;

    let page: string;
    try {
      page = (await fetcher.get(url)).html;
    } catch (err) {
      // A page the university would not serve is tolerated and recorded; a
      // page we could not UNDERSTAND is not. Phase 30's rule, and it is the
      // same rule whichever university is refusing.
      void err;
      unavailable.push(parsed.code);
      continue;
    }

    // Every page carries the footer, so the faculty list costs no request. Read
    // from the first page that has one rather than from a fixed page, so a
    // single page changing shape cannot take the whole list with it.
    if (faculties.length === 0) faculties = parseFaculties(page);

    const p = parseProgramme(page, parsed.code, faculties);
    if (opts.onlyFaculties?.length && (p.faculty === null || !opts.onlyFaculties.includes(p.faculty))) {
      continue;
    }

    let courses: ReturnType<typeof parseListing> = [];
    let listing: SnapshotProgramme["listing"] = "empty";
    if (p.listingPath === null) {
      // The page carries no block to fetch a list with. Real and ordinary: on
      // 80 sampled, 9 are like this, which is UCLouvain's 247 programmes with
      // no course list in another shape.
      listing = "empty";
    } else {
      try {
        // `accept` matters here and nowhere else in the crawl. The endpoint
        // serves application/json and answers 404, not 406, when the Accept
        // header does not allow it. A trial run recorded 269 listings as
        // "unreachable" before this line existed, and the cause was a header.
        const body = (await fetcher.get(listingUrl(p.listingPath), { accept: "application/json" }))
          .html;
        const payload = JSON.parse(body) as { html?: string };
        courses = parseListing(payload.html ?? "");
        listing = courses.length > 0 ? "listed" : "empty";
      } catch (err) {
        listing = "unreachable";
        // Recorded with a reason. A crawl that says a page was unreachable and
        // not why is a crawl somebody has to repeat to find out.
        say(
          `ulb: listing unreachable for ${parsed.code}: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }

    programmes.push({
      code: p.code,
      faculty: p.faculty,
      title: p.title,
      kind: p.kind,
      credits: p.credits,
      // ULB publishes the campus per course, not per programme, so a
      // programme's site is genuinely not stated here.
      site: null,
      siteSource: null,
      domain: null,
      listing,
      courses: courses.length,
    });

    for (const c of courses) {
      if (p.faculty) reachedVia.push({ code: c.code, faculty: p.faculty, programme: p.code });
      if (seenCourse.has(c.code)) continue;
      seenCourse.add(c.code);
      offerings.push({
        code: c.code,
        year,
        era: "modern",
        title: c.title,
        ects: c.ects,
        contactHours: c.contactHours,
        quarter: c.quarter,
        language: c.language,
        teachers: c.teachers,
        // Only on the course pages, which this pass does not fetch. Null means
        // the source does not state it HERE, and a second pass fills them.
        assessment: null,
        themes: null,
        content: null,
        owningFaculty: null,
      });
    }

    if ((i + 1) % 25 === 0) {
      say(`ulb: ${i + 1}/${urls.length} programmes, ${offerings.length} courses`);
    }
  }

  say(`ulb: done, ${programmes.length} programmes and ${offerings.length} courses`);

  return {
    version: 9,
    institution: "ulb",
    takenAt: new Date().toISOString(),
    year,
    // ULB's faculties, as ULB lists them. Only those that actually organise a
    // programme in this crawl: a faculty with nothing in it would be a row the
    // browse screen offers and that answers with an empty list.
    faculties: faculties
      .filter((f) => programmes.some((p) => p.faculty === f.code))
      .map((f) => ({ code: f.code, name: f.name })),
    programmes,
    offerings,
    conflicts: [],
    unavailable,
    reachedVia: reachedVia.filter((r) => seenCourse.has(r.code)),
  };
}

export const ulb: CatalogueSource = {
  institution: "ulb",
  label: "ULB",
  crawl: crawlUlb,
  courseUrl,
  programmeUrl,
};
