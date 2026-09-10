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

export interface Snapshot {
  /** Schema version of this file format, so a reader can refuse an old one. */
  version: 1;
  /** When the crawl finished. */
  takenAt: string;
  /** The academic year crawled. */
  year: number;
  /** Faculty codes as DISCOVERED, never as configured. */
  faculties: string[];
  programmes: Array<{ code: string; faculty: string }>;
  offerings: ParsedOffering[];
  /** Which faculties each offering was reached through. Many-to-many on purpose. */
  reachedVia: Array<{ code: string; faculty: string }>;
}

export class SnapshotInvalid extends Error {}

/**
 * Refuse to promote a snapshot that would make the catalogue worse.
 * Every check here is a failure the crawl could plausibly produce.
 */
export function validate(s: Snapshot): void {
  if (s.version !== 1) throw new SnapshotInvalid(`unknown snapshot version ${s.version}`);
  if (s.faculties.length === 0) throw new SnapshotInvalid("no faculties discovered");
  if (s.programmes.length === 0) throw new SnapshotInvalid("no programmes discovered");
  if (s.offerings.length === 0) throw new SnapshotInvalid("no course offerings parsed");

  for (const o of s.offerings) {
    if (!Number.isFinite(o.ects) || o.ects <= 0) {
      throw new SnapshotInvalid(`${o.code}: ECTS is required in every era, got ${o.ects}`);
    }
    if (!/^[a-z]{3,6}\d{3,4}$/.test(o.code)) {
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
