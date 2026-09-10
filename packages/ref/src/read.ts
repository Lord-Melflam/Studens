/**
 * The reference module's READ interface.
 *
 * FR-B11: feature modules and apps ask this module questions; they do not
 * reach into its storage. Everything a consumer needs is here, and nothing
 * here exposes how the catalogue is stored.
 *
 * Backed by a snapshot file today. When the catalogue moves into Postgres the
 * implementation changes and this signature does not, which is the point of
 * having it (CC-2, FR-B10).
 */
import type { ParsedOffering, Snapshot } from "./index.js";
import { load } from "./ingestion/snapshot.js";

export interface CourseSummary {
  code: string;
  title: string;
  year: number;
  ects: number;
  quarter: string | null;
  /** Present only when UCLouvain owns the course. See OPEN-45. */
  teachers: string[];
  /** True when the course is taught at another institution (OPEN-45). */
  external: boolean;
}

export interface CourseDetail extends CourseSummary {
  language: string | null;
  contactHours: string | null;
  /** FR-D19: scraped, never asked of reviewers. */
  assessment: string | null;
  themes: string | null;
  content: string | null;
  owningFaculty: string | null;
  /** Faculties this course was reached through. Many-to-many on purpose. */
  reachedVia: string[];
}

function summarise(o: ParsedOffering): CourseSummary {
  return {
    code: o.code,
    title: o.title,
    year: o.year,
    ects: o.ects,
    quarter: o.quarter,
    teachers: o.teachers,
    // A course with no teachers and no assessment on its UCLouvain page is
    // hosted elsewhere: verified on the ENANO courses, which carry only a
    // reference institution. See OPEN-45.
    external: o.teachers.length === 0 && o.assessment === null,
  };
}

export class Catalogue {
  private constructor(private readonly snapshot: Snapshot) {}

  static async open(path: string): Promise<Catalogue> {
    return new Catalogue(await load(path));
  }

  get year(): number {
    return this.snapshot.year;
  }

  get size(): number {
    return this.snapshot.offerings.length;
  }

  /**
   * FR-D1 and FR-D2: match on code, then on words in the title. Exact and
   * prefix matching only; semantic matching is deferred (1.4).
   */
  search(query: string, limit = 25): CourseSummary[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const byCode: ParsedOffering[] = [];
    const byTitle: ParsedOffering[] = [];
    for (const o of this.snapshot.offerings) {
      if (o.code.startsWith(q)) byCode.push(o);
      else if (o.title.toLowerCase().includes(q)) byTitle.push(o);
    }
    // Code matches first: someone typing LEPL1503 wants that course, not a
    // course whose description mentions it.
    return [...byCode, ...byTitle].slice(0, limit).map(summarise);
  }

  get(code: string): CourseDetail | null {
    const o = this.snapshot.offerings.find((x) => x.code === code.toLowerCase());
    if (!o) return null;
    return {
      ...summarise(o),
      language: o.language,
      contactHours: o.contactHours,
      assessment: o.assessment,
      themes: o.themes,
      content: o.content,
      owningFaculty: o.owningFaculty,
      reachedVia: this.snapshot.reachedVia
        .filter((r) => r.code === o.code)
        .map((r) => r.faculty),
    };
  }
}
