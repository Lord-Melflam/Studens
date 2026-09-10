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

export interface Snapshot {
  /**
   * Schema version of this FILE format, so a reader can refuse an old one.
   * 2: faculties gained their names, because ref.Faculty requires one and the
   *    faculty index already carries it in the link text.
   * 3: programmes gained their titles, and reachedVia gained the PROGRAMME a
   *    course was reached through. Browsing by programme (FR-D24) is
   *    impossible without it, and the crawl was discarding it: it recorded the
   *    faculty of the programme it came from and threw the programme away.
   *
   * The version field exists to be used, so an older snapshot is refused
   * rather than silently loaded with a field missing.
   */
  version: 3;
  /** When the crawl finished. */
  takenAt: string;
  /** The academic year crawled. */
  year: number;
  /** Faculties as DISCOVERED, never as configured. */
  faculties: DiscoveredFaculty[];
  programmes: Array<{ code: string; faculty: string; title: string }>;
  offerings: ParsedOffering[];
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
  if (s.version !== 3) {
    throw new SnapshotInvalid(
      `snapshot version ${s.version} is not readable; re-run the ingestion (expected 3)`,
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
