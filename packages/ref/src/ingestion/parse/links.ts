/**
 * Link extraction.
 *
 * One function serves all three levels of the chain (faculties, programmes,
 * courses) because they are the same operation: fetch a page, keep the hrefs
 * matching a pattern, and take the captured code. Nothing about which
 * faculties or courses exist is encoded here.
 */
import * as cheerio from "cheerio";
import { ParseError } from "../errors.js";

export interface Link {
  code: string;
  href: string;
  text: string;
}

/**
 * Every distinct code linked from `html` whose href matches `pattern`.
 *
 * `expect` names what we were looking for, so a failure says "no faculty links
 * on this page" rather than "empty array". An empty result is always an error:
 * a faculty index with no faculties means the layout changed, and returning
 * nothing would let the crawl continue and write an empty snapshot.
 */
export function extractLinks(
  html: string,
  pattern: RegExp,
  url: string,
  expect: string,
): Link[] {
  const $ = cheerio.load(html);
  const found = new Map<string, Link>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const m = pattern.exec(href);
    if (!m?.[1]) return;
    const code = m[1].toLowerCase();
    if (!found.has(code)) {
      found.set(code, { code, href, text: $(el).text().trim() });
    }
  });

  if (found.size === 0) {
    throw new ParseError(url, expect, "no matching links found on the page");
  }
  return [...found.values()];
}
