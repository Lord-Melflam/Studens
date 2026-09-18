/**
 * The institution's own page for a course or a programme.
 *
 * WHY THIS MOVED. `read.ts` built every `officialUrl` with UCLouvain's URL
 * grammar, for every course, whatever institution it came from. That was
 * correct while there was one catalogue and would have been wrong the hour ULB
 * data was loaded: a ULB course would have carried a link to a UCLouvain page
 * that does not exist, on the one row whose whole job is to send a reader to
 * the source.
 *
 * Derived, never stored, which is the rule it was already following: storing it
 * would put a copy of an institution's URL grammar in every row, so a change
 * upstream would leave every row stale instead of one function wrong.
 *
 * An institution nobody has a source for gets null rather than a guess. There
 * is no sensible URL to invent, and a dead link presented as official is worse
 * than no link: the interface already knows how to show a course with no
 * official page, because 247 programmes publish no course list.
 */
import { uclouvain } from "./uclouvain.js";
import { ulb } from "./ulb/index.js";
import type { CatalogueSource } from "./index.js";

const BY_CODE: Record<string, CatalogueSource> = {
  [uclouvain.institution]: uclouvain,
  [ulb.institution]: ulb,
};

export function officialCourseUrl(institution: string, year: number, code: string): string | null {
  return BY_CODE[institution]?.courseUrl(year, code) ?? null;
}

export function officialProgrammeUrl(
  institution: string,
  year: number,
  code: string,
): string | null {
  return BY_CODE[institution]?.programmeUrl(year, code) ?? null;
}
