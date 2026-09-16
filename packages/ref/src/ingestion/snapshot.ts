/**
 * Snapshots.
 *
 * docs/design/catalogue-ingestion.md section 6: a run writes a COMPLETE new
 * snapshot and only replaces the live one if the whole run succeeded and passed
 * validation. A partial or broken crawl therefore cannot empty a course page.
 *
 * This matters disproportionately because the catalogue is a reference module
 * (FR-B9) that every feature module reads.
 */
import { mkdtemp, mkdir, rename, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { ParsedOffering } from "./parse/offering.js";

export interface DiscoveredFaculty {
  code: string;
  /** The link text from the faculty index, for instance "Ecole polytechnique de Louvain". */
  name: string;
}

export interface SnapshotProgramme {
  code: string;
  faculty: string;
  title: string;
  /** From the title, by `programmeShape`. Null when it matches no known kind. */
  kind: string | null;
  /** 120 or 60 for a master that states it. */
  credits: number | null;
  /** As published. "Autre site" is a value UCLouvain states, not a missing one. */
  site: string | null;
  /** The decree's field of study. Only the search application publishes it. */
  domain: string | null;
  /**
   * Which source the site came from, because the two are not equally good.
   *
   * `search` is a field the application publishes. `title` is the trailing
   * parenthesis of a name, which is a parse and survives only while UCLouvain
   * keeps writing it that way. Recorded so a later reader can tell how much of
   * the catalogue rests on the weaker one.
   */
  siteSource: "search" | "title" | null;
}

export interface SnapshotConflict {
  code: string;
  field: "site";
  /** What the per-faculty index said, in the title. */
  fromIndex: string | null;
  /** What the search application said, as a field. */
  fromSearch: string | null;
}

export interface Snapshot {
  /**
   * Schema version of this FILE format, so a reader can refuse an old one.
   * 2: faculties gained their names, because ref.Faculty requires one and the
   *    faculty index already carries it in the link text.
   * 3: programmes gained their titles, and reachedVia gained the PROGRAMME a
   *    course was reached through. Browsing by programme (FR-D24) is
   *    impossible without it, and the crawl was discarding it: it recorded the
   *    faculty of the programme it came from and threw the programme away.
   * 4: assessment, themes and content became STRUCTURED BLOCKS instead of flat
   *    strings. They are lists, and they were being stored with every list,
   *    line break and heading removed. See parse/rich.ts.
   * 5: programmes gained their DIMENSIONS, and the crawl gained a second
   *    source to get them from. Site, field of study and kind were being
   *    re-derived from the title on every read, which meant the database could
   *    not be asked for the masters in Charleroi and the field of study was
   *    nowhere at all.
   * 6: courses the university could not serve are listed instead of ending the
   *    run. `cours-2025-mlsmm2219` answers 503 every time while its 2024
   *    edition is fine, and a crawl of nine thousand pages meets several of
   *    those. Recorded rather than silently dropped.
   *
   * The version field exists to be used, so an older snapshot is refused
   * rather than silently loaded with a field missing.
   */
  version: 6;
  /** When the crawl finished. */
  takenAt: string;
  /** The academic year crawled. */
  year: number;
  /** Faculties as DISCOVERED, never as configured. */
  faculties: DiscoveredFaculty[];
  programmes: SnapshotProgramme[];
  offerings: ParsedOffering[];
  /**
   * Where the two sources disagreed, kept rather than resolved silently.
   *
   * The index and the search application are both UCLouvain publishing the same
   * fact, so a disagreement is a fact about the catalogue and not noise to
   * average away. Same rule as an archived year missing a field: the crawl
   * records what it saw and a person decides.
   */
  conflicts: SnapshotConflict[];
  /**
   * Courses the university would not serve, after the retries were spent.
   *
   * Listed rather than dropped, and listed rather than fatal. A page that
   * answers 503 every time is not a catalogue with wrong data in it, it is a
   * catalogue with a course missing, and refusing to update over one course
   * means never updating at all once there are thousands. What would be wrong
   * is losing it quietly, so it is written down and printed.
   */
  unavailable: string[];
  /**
   * How each offering was reached. Many-to-many on BOTH axes on purpose: a
   * course appears in several programmes, and those programmes can belong to
   * different faculties (FR-D25).
   */
  reachedVia: Array<{ code: string; faculty: string; programme: string }>;
}

export class SnapshotInvalid extends Error {}

/**
 * A plausible UCLouvain course code.
 *
 * Measured across 555 codes discovered from EPL on 2026-09-10, which produced
 * exactly four shapes:
 *
 *   AAAAA9999    480   enano2401
 *   AAAA9999      69   lbir1111
 *   AAAA9999A      4   lbio1237b
 *   AAAAA9999A     2   lbira2110b
 *
 * The trailing letter is the part that matters: an earlier version of this
 * pattern forbade it and rejected a complete 546-course crawl over
 * `lbio1237b`. Six of 555 carry one, and they are real courses students take:
 * the EPL reviews document discusses LEPL2214, whose catalogue entry is
 * `lepl2214a`.
 *
 * Kept strict rather than permissive on purpose. This is the check that stops
 * a parser reading something that is not a course code at all, so widening it
 * to `.+` would remove the only guard against that.
 */
const COURSE_CODE = /^[a-z]{3,6}\d{3,4}[a-z]?$/;

/**
 * Refuse to promote a snapshot that would make the catalogue worse.
 * Every check here is a failure the crawl could plausibly produce.
 */
export function validate(s: Snapshot): void {
  if (s.version !== 6) {
    throw new SnapshotInvalid(
      `snapshot version ${s.version} is not readable; re-run the ingestion (expected 6)`,
    );
  }
  if (s.faculties.length === 0) throw new SnapshotInvalid("no faculties discovered");
  if (s.programmes.length === 0) throw new SnapshotInvalid("no programmes discovered");
  if (s.offerings.length === 0) throw new SnapshotInvalid("no course offerings parsed");

  for (const o of s.offerings) {
    if (!Number.isFinite(o.ects) || o.ects <= 0) {
      throw new SnapshotInvalid(`${o.code}: ECTS is required in every era, got ${o.ects}`);
    }
    if (!COURSE_CODE.test(o.code)) {
      throw new SnapshotInvalid(`${o.code}: not a plausible course code`);
    }
    if (!o.title) throw new SnapshotInvalid(`${o.code}: empty title`);
    if (o.year !== s.year) {
      throw new SnapshotInvalid(`${o.code}: year ${o.year} does not match the snapshot year ${s.year}`);
    }
  }

  const codes = new Set(s.offerings.map((o) => o.code));
  if (codes.size !== s.offerings.length) {
    throw new SnapshotInvalid("duplicate course codes in the snapshot");
  }

  assertNothingWentBlank(s);
}

/**
 * A field that is empty on EVERY offering, which means the layout changed.
 *
 * This is the guard the offering parser used to carry per page, moved to where
 * the evidence actually is. A selector that stops matching does not blank one
 * course, it blanks the same field on all of them, and that is a fact about the
 * run. Per page it was wrong in both directions: it failed a whole crawl over
 * one course UCLouvain publishes with an empty evaluation field, and it could
 * say nothing at all about a field that had quietly vanished everywhere.
 *
 * THE THRESHOLD IS MEASURED, not chosen. In a real 546-course crawl of EPL the
 * least populated of these fields is filled on 84%, and none is below it, so
 * zero across a substantial run is not something a genuine catalogue produces.
 * Below 25 offerings the check stays quiet, because a `--max` sample is allowed
 * to miss anything.
 */
const NEVER_ALL_EMPTY = [
  "assessment",
  "content",
  "themes",
  "teachers",
  "language",
  "quarter",
  "contactHours",
] as const;

const SAMPLE_FLOOR = 25;

function assertNothingWentBlank(s: Snapshot): void {
  if (s.offerings.length < SAMPLE_FLOOR) return;
  for (const field of NEVER_ALL_EMPTY) {
    const filled = s.offerings.filter((o) => {
      const v = (o as unknown as Record<string, unknown>)[field];
      return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "";
    }).length;
    if (filled === 0) {
      throw new SnapshotInvalid(
        `every one of the ${s.offerings.length} offerings is missing "${field}". ` +
          `A field empty everywhere is a layout change, not a catalogue.`,
      );
    }
  }
}

/**
 * Write, validate, then move into place. The move is the only step that touches
 * the live path, and rename(2) within a filesystem is atomic, so a reader sees
 * either the old snapshot or the new one and never a half-written file.
 */
export async function promote(snapshot: Snapshot, livePath: string): Promise<void> {
  validate(snapshot);
  const staging = await mkdtemp(join(tmpdir(), "studens-snapshot-"));
  const staged = join(staging, "snapshot.json");
  try {
    await writeFile(staged, JSON.stringify(snapshot, null, 2), "utf8");
    // Read it back and revalidate: a snapshot that cannot be re-parsed must
    // never reach the live path.
    validate(JSON.parse(await readFile(staged, "utf8")) as Snapshot);
    await mkdir(dirname(livePath), { recursive: true });
    await rename(staged, livePath);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function load(livePath: string): Promise<Snapshot> {
  const s = JSON.parse(await readFile(livePath, "utf8")) as Snapshot;
  validate(s);
  return s;
}
