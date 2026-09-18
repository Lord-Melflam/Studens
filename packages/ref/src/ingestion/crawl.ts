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
  searchUrl,
} from "./urls.js";
import { extractLinks } from "./parse/links.js";
import { parseOffering, type ParsedOffering } from "./parse/offering.js";
import { parseSearchRows } from "./parse/search.js";
import { BudgetExceeded, TooManyUnavailable } from "./errors.js";
import { programmeShape } from "./parse/programme.js";
import { assertPlausibleYear, candidateYears } from "./year.js";
import { BASE } from "./urls.js";
import type {
  DiscoveredFaculty,
  Snapshot,
  SnapshotConflict,
  SnapshotProgramme,
} from "./snapshot.js";

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

  // 2b. THE SECOND SOURCE. One request returns every programme of the year with
  //     its site, its field of study and its organising faculty, none of which
  //     a programme page states (section 10). It is one request and not one per
  //     faculty because the whole year fits in a single response.
  //
  //     A FAILURE HERE IS NOT FATAL. The search covers 605 of the 692
  //     programmes the index lists and is a separate application that can be
  //     down on its own; losing it costs the field of study and falls back to
  //     the title for the site, which is what the crawl did before it existed.
  //     Losing the whole catalogue over it would be the wrong trade.
  const dimensions = new Map<string, { site: string | null; domain: string | null }>();
  try {
    const url = searchUrl(year, "Training");
    const page = await fetcher.get(url);
    for (const row of parseSearchRows(page.html, "programme", year)) {
      dimensions.set(row.code, { site: row.site, domain: row.domain });
    }
    say(`${dimensions.size} programmes described by the search`);
  } catch (err) {
    say(`the search application could not be read (${String(err)}); falling back to titles`);
  }

  // 2c. Reconcile. The index decides WHICH programmes exist, because it lists
  //     the 62 minors the search does not, and a minor is exactly what somebody
  //     is choosing at PAE time. The search decides WHAT they are, because it
  //     states as fields what the index only implies in a title.
  const conflicts: SnapshotConflict[] = [];
  const described: SnapshotProgramme[] = programmes.map((p) => {
    const shape = programmeShape(p.title);
    const found = dimensions.get(p.code);

    // The search wins on the site: it publishes a field, while the title is a
    // trailing parenthesis that survives only while they keep writing it. Both
    // are kept when they disagree, because both are UCLouvain stating the same
    // fact and picking one silently would throw away the evidence that they do.
    if (found?.site && shape.site && found.site !== shape.site) {
      conflicts.push({
        code: p.code,
        field: "site",
        fromIndex: shape.site,
        fromSearch: found.site,
      });
    }
    const site = found?.site ?? shape.site;
    return {
      ...p,
      kind: shape.kind,
      credits: shape.credits,
      site,
      domain: found?.domain ?? null,
      siteSource: site === null ? null : found?.site ? "search" : "title",
      // Filled in below, once the course lists have been read.
      listing: "unreachable" as const,
      courses: 0,
    };
  });
  const missing = described.filter((p) => !dimensions.has(p.code)).length;
  say(`${described.length - missing} programmes matched the search, ${missing} not covered`);
  if (conflicts.length > 0) say(`${conflicts.length} site disagreements recorded`);

  // 3. courses per programme. A course reached through several programmes is
  //    recorded once per faculty it was reached through: many-to-many on
  //    purpose, because reaching a course through EPL says nothing about who
  //    owns it (section 2).
  const reachedVia: Array<{ code: string; faculty: string; programme: string }> = [];
  const seen = new Set<string>();
  // What happened to each programme's course list, kept rather than inferred
  // from an absence later. "No courses" used to mean either "a joint programme
  // with none to list" or "every page failed to load", and telling them apart
  // meant opening the site by hand.
  const listing = new Map<string, { listing: "listed" | "empty" | "unreachable"; courses: number }>();
  for (const programme of programmes) {
    // The landing page carries no course list; the listing lives on one of the
    // suffixes in PROGRAMME_LISTING_SUFFIXES, which differ between bachelor and
    // master programmes. Try each and take the first that yields courses.
    let links: ReturnType<typeof extractLinks> | undefined;
    let reached = false;
    for (const url of programmeListingUrls(year, programme.code)) {
      let page;
      try {
        page = await fetcher.get(url);
      } catch {
        // A missing variant is ordinary: the two suffixes are alternatives, and
        // a bachelor has one while a master has the other.
        continue;
      }
      // The page loaded, so the programme is reachable whatever is on it. That
      // distinction is the whole point: a page with no courses is an answer, a
      // page that never loaded is a gap.
      reached = true;
      try {
        links = extractLinks(page.html, courseLinkPattern(year), url, "course links");
        break;
      } catch {
        continue;
      }
    }
    listing.set(programme.code, {
      listing: links ? "listed" : reached ? "empty" : "unreachable",
      courses: links?.length ?? 0,
    });
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
  const unreachable = [...listing.entries()].filter(([, l]) => l.listing === "unreachable");
  if (unreachable.length > 0) {
    say(
      `${unreachable.length} programmes whose course list could not be read: ` +
        unreachable.map(([code]) => code).join(", "),
    );
  }

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
  // WHAT THE REST OF THE RUN WILL COST, said before it is spent rather than
  // discovered an hour into it. One faculty is about 600 requests and all 21
  // are roughly 9,000, so somebody who forgot `--faculty` needs to find that
  // out here and not from a two-hour silence. Cache hits are excluded, because
  // they cost the university nothing.
  say(
    `about to read ${sampled.length} course pages` +
      (fetcher.plannedDelayMs > 0
        ? `, roughly ${Math.ceil((sampled.length * fetcher.plannedDelayMs) / 60000)} minutes` +
          ` at ${fetcher.plannedDelayMs} ms apart if none are cached`
        : ""),
  );

  // A page we could not GET is tolerated; a page we could not UNDERSTAND is not.
  // The line is the difference between a course missing and a course wrong:
  // `cours-2025-mlsmm2219` answers 503 on every attempt while its 2024 edition
  // is served fine, so a crawl of nine thousand pages will meet several, and
  // ending the run over one means the catalogue can never be updated again.
  const unavailable: string[] = [];
  for (const [i, code] of sampled.entries()) {
    const url = courseUrl(year, code);
    let page;
    try {
      page = await fetcher.get(url);
    } catch (err) {
      if (err instanceof BudgetExceeded) throw err;
      unavailable.push(code);
      continue;
    }
    // A parse failure is still fatal. A catalogue with wrong data is worse than
    // one that refused to update (section 6), and a page we could not
    // understand is exactly that. A page missing a FIELD is a different thing
    // and is not a failure: the parser returns null for it and the course is
    // kept, because the other thirty fields are what a student came to read.
    offerings.push(parseOffering(page.html, code, year, page.finalUrl));
    // A long run has to say it is alive. At one faculty this prints twice; at
    // twenty-one it is the difference between a crawl and a hang.
    if (sampled.length > 200 && (i + 1) % 250 === 0) {
      say(`  ${i + 1} of ${sampled.length} course pages`);
    }
  }
  say(`${offerings.length} offerings parsed`);

  // A handful of broken pages is the catalogue; a wave of them is us. Being
  // blocked or rate limited fails everything at once, and that must stop the
  // run rather than quietly produce a catalogue with a tenth of its courses
  // missing. One per cent, with a floor so a small sample is not judged by a
  // percentage of itself.
  if (unavailable.length > 0) {
    say(`${unavailable.length} courses the university would not serve: ${unavailable.join(", ")}`);
  }
  const tolerated = Math.max(5, Math.floor(sampled.length * 0.01));
  if (unavailable.length > tolerated) {
    throw new TooManyUnavailable(unavailable, tolerated);
  }

  for (const p of described) {
    const outcome = listing.get(p.code);
    if (outcome) {
      p.listing = outcome.listing;
      p.courses = outcome.courses;
    }
  }

  return {
    // 9 since 2026-09-18, when a programme's faculty became nullable and the
    // file started naming the institution it is a crawl of. UCLouvain needs
    // neither: every one of its programmes has a faculty, and this crawler
    // only ever crawls UCLouvain. The number and the name below are the only
    // lines this file has given to there being a second institution.
    version: 9,
    institution: "uclouvain",
    takenAt: new Date().toISOString(),
    year,
    faculties,
    programmes: described,
    offerings,
    conflicts,
    unavailable,
    reachedVia: reachedVia.filter((r) => offerings.some((o) => o.code === r.code)),
  };
}
