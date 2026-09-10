/**
 * The crawl.
 *
 * Walks the chain in docs/design/catalogue-ingestion.md section 2:
 *
 *   faculty index  ->  faculties  ->  programmes  ->  courses  ->  offerings
 *
 * NOTHING about which faculties, programmes or courses exist appears in this
 * file. All of it is discovered by following links from one root URL. That is
 * the requirement (section 0) and it is what a test asserts behaviourally.
 */
import { PoliteFetcher } from "./http.js";
import {
  courseLinkPattern,
  courseUrl,
  facultyIndex,
  facultyLinkPattern,
  programmeLinkPattern,
  programmeListingUrls,
} from "./urls.js";
import { extractLinks } from "./parse/links.js";
import { parseOffering, type ParsedOffering } from "./parse/offering.js";
import { assertPlausibleYear, candidateYears } from "./year.js";
import { BASE } from "./urls.js";
import type { DiscoveredFaculty, Snapshot } from "./snapshot.js";

export interface CrawlOptions {
  year?: number;
  /** Restrict to these faculty codes. Empty means every faculty discovered. */
  onlyFaculties?: string[];
  /** Stop after this many offerings. For a scoped run, not for correctness. */
  maxOfferings?: number;
  fetcher?: PoliteFetcher;
  now?: Date;
  onProgress?: (msg: string) => void;
}

/**
 * Which academic year to crawl. Never assumed: the candidates are probed and
 * the first that answers wins. Section 3, and it is why `cours-2026-` being
 * published early costs no code change.
 */
export async function resolveYear(fetcher: PoliteFetcher, now: Date): Promise<number> {
  const tried: number[] = [];
  for (const year of candidateYears(now)) {
    assertPlausibleYear(year);
    tried.push(year);
    try {
      await fetcher.get(facultyIndex(year));
      return year;
    } catch {
      continue;
    }
  }
  throw new Error(`no catalogue year responded; tried ${tried.join(", ")}`);
}

export async function crawl(opts: CrawlOptions = {}): Promise<Snapshot> {
  const fetcher = opts.fetcher ?? new PoliteFetcher();
  const now = opts.now ?? new Date();
  const say = opts.onProgress ?? (() => undefined);

  const year = opts.year ?? (await resolveYear(fetcher, now));
  assertPlausibleYear(year);
  say(`year ${year}`);

  // 1. faculties, discovered from a single root
  const indexUrl = facultyIndex(year);
  const index = await fetcher.get(indexUrl);
  let faculties: DiscoveredFaculty[] = extractLinks(
    index.html,
    facultyLinkPattern(year),
    indexUrl,
    "faculty links",
  ).map((l) => ({ code: l.code, name: l.text || l.code.toUpperCase() }));
  if (opts.onlyFaculties?.length) {
    const want = new Set(opts.onlyFaculties.map((f) => f.toLowerCase()));
    faculties = faculties.filter((f) => want.has(f.code));
    if (faculties.length === 0) {
      throw new Error(
        `none of the requested faculties were found in the ${year} index: ` +
          `${opts.onlyFaculties.join(", ")}`,
      );
    }
  }
  say(`${faculties.length} faculties`);

  // 2. programmes per faculty
  const programmes: Array<{ code: string; faculty: string; title: string }> = [];
  for (const { code: faculty } of faculties) {
    const url = `${BASE}/fr/catalogue-formations/faculte-${year}-${faculty}`;
    const page = await fetcher.get(url);
    for (const link of extractLinks(page.html, programmeLinkPattern(year), url, "programme links")) {
      programmes.push({
        code: link.code,
        faculty,
        title: link.text || link.code.toUpperCase(),
      });
    }
  }
  say(`${programmes.length} programme links`);

  // 3. courses per programme. A course reached through several programmes is
  //    recorded once per faculty it was reached through: many-to-many on
  //    purpose, because reaching a course through EPL says nothing about who
  //    owns it (section 2).
  const reachedVia: Array<{ code: string; faculty: string; programme: string }> = [];
  const seen = new Set<string>();
  for (const programme of programmes) {
    // The landing page carries no course list; the listing lives on one of the
    // suffixes in PROGRAMME_LISTING_SUFFIXES, which differ between bachelor and
    // master programmes. Try each and take the first that yields courses.
    let links: ReturnType<typeof extractLinks> | undefined;
    for (const url of programmeListingUrls(year, programme.code)) {
      try {
        const page = await fetcher.get(url);
        links = extractLinks(page.html, courseLinkPattern(year), url, "course links");
        break;
      } catch {
        // Neither a missing variant nor an empty listing is fatal on its own:
        // some programmes are certificates or exchange tracks with no course
        // list. A global failure is caught by the snapshot validation instead.
        continue;
      }
    }
    if (!links) continue;
    for (const link of links) {
      // Keep the PROGRAMME, not only its faculty. Discarding it was what made
      // FR-D24 impossible, and the loss was invisible because the faculty was
      // still there.
      reachedVia.push({
        code: link.code,
        faculty: programme.faculty,
        programme: programme.code,
      });
      seen.add(link.code);
    }
  }
  say(`${seen.size} distinct courses`);

  // 4. the offerings themselves
  const offerings: ParsedOffering[] = [];
  const codes = [...seen].sort();
  // maxOfferings SAMPLES ACROSS the discovered list rather than taking its
  // head. Taking the head returns one alphabetical neighbourhood: on EPL that
  // is 60-odd ENANO courses, all of them externally hosted with three fields
  // each, which made a smoke test look like a parser failure. A spread sample
  // exercises the variety that actually exists.
  const limit = opts.maxOfferings ?? codes.length;
  const step = limit >= codes.length ? 1 : Math.floor(codes.length / limit);
  const sampled = step > 1 ? codes.filter((_, i) => i % step === 0).slice(0, limit) : codes.slice(0, limit);
  for (const code of sampled) {
    const url = courseUrl(year, code);
    const page = await fetcher.get(url);
    // Deliberately NOT caught: a parse failure fails the run. A catalogue with
    // wrong data is worse than one that refused to update (section 6).
    offerings.push(parseOffering(page.html, code, year, page.finalUrl));
  }
  say(`${offerings.length} offerings parsed`);

  return {
    version: 4,
    takenAt: new Date().toISOString(),
    year,
    faculties,
    programmes,
    offerings,
    reachedVia: reachedVia.filter((r) => offerings.some((o) => o.code === r.code)),
  };
}
