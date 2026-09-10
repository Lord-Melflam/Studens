/**
 * The polite fetcher.
 *
 * docs/design/catalogue-ingestion.md section 4: robots.txt permits the paths we
 * use and sets NO Crawl-delay, so politeness is entirely on us. A student
 * project hammering the university's own website is the fastest way to get
 * blocked and to deserve it.
 *
 * Four rules, all enforced here rather than left to callers:
 *   - one request at a time, never parallel
 *   - a delay between requests
 *   - a User-Agent naming the project with a contact route, so an administrator
 *     who notices the traffic can ask us to stop instead of guessing
 *   - redirects followed, because years before 2024 redirect to
 *     sites.uclouvain.be/archives-portail and cross hosts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FetchError } from "./errors.js";

/**
 * Identifies the project and gives a way to reach us. The repository URL rather
 * than a personal address on purpose: this is a public string.
 */
export const USER_AGENT =
  "StudensCatalogueBot/0.1 (+https://github.com/Lord-Melflam/Studens)";

export interface FetcherOptions {
  /** Milliseconds between the end of one request and the start of the next. */
  delayMs?: number;
  timeoutMs?: number;
  /** Injected in tests so no test ever touches the network. */
  fetchImpl?: typeof fetch;
  /**
   * On-disk page cache. The politeness rules in
   * docs/design/catalogue-ingestion.md section 4 include "conditional requests
   * and caching wherever the server supports them", which was written down and
   * then skipped. It matters more than it looks: developing the ingestion means
   * re-running it, and without a cache every iteration is another 546 requests
   * at the university's expense. A cached run costs nothing.
   *
   * Course pages change roughly once a year, so a long default is right.
   * Set maxAgeMs to 0 to force a fresh fetch.
   */
  cacheDir?: string | undefined;
  cacheMaxAgeMs?: number;
}

export interface Fetched {
  url: string;
  finalUrl: string;
  html: string;
}

interface CachedPage {
  finalUrl: string;
  html: string;
  fetchedAt: number;
}

export class PoliteFetcher {
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cacheDir: string | undefined;
  private readonly cacheMaxAgeMs: number;
  private hits = 0;
  /** The queue tail. Every request chains onto it, so requests are serial. */
  private chain: Promise<unknown> = Promise.resolve();
  private requests = 0;

  constructor(opts: FetcherOptions = {}) {
    this.delayMs = opts.delayMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.cacheDir = opts.cacheDir;
    this.cacheMaxAgeMs = opts.cacheMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
  }

  /** Requests actually made to the network. */
  get requestCount(): number {
    return this.requests;
  }

  /** Requests served from the cache, so the university never saw them. */
  get cacheHits(): number {
    return this.hits;
  }

  /** Serial by construction: callers cannot accidentally fan out. */
  async get(url: string): Promise<Fetched> {
    const cached = await this.fromCache(url);
    if (cached) {
      this.hits += 1;
      return { url, finalUrl: cached.finalUrl, html: cached.html };
    }
    const run = this.chain.then(() => this.fetchOnce(url));
    this.chain = run.catch(() => undefined);
    const fetched = await run;
    await this.toCache(url, fetched);
    return fetched;
  }

  private cachePath(url: string): string | null {
    if (!this.cacheDir) return null;
    return join(this.cacheDir, `${createHash("sha256").update(url).digest("hex")}.json`);
  }

  private async fromCache(url: string): Promise<CachedPage | null> {
    const path = this.cachePath(url);
    if (!path || this.cacheMaxAgeMs <= 0) return null;
    try {
      const page = JSON.parse(await readFile(path, "utf8")) as CachedPage;
      if (Date.now() - page.fetchedAt > this.cacheMaxAgeMs) return null;
      return page;
    } catch {
      // A missing or unreadable cache entry is a miss, never an error: the
      // cache is an optimisation and must not be able to fail a run.
      return null;
    }
  }

  private async toCache(url: string, page: Fetched): Promise<void> {
    const path = this.cachePath(url);
    if (!path) return;
    try {
      await mkdir(this.cacheDir!, { recursive: true });
      const entry: CachedPage = {
        finalUrl: page.finalUrl,
        html: page.html,
        fetchedAt: Date.now(),
      };
      await writeFile(path, JSON.stringify(entry), "utf8");
    } catch {
      // Same reasoning: failing to cache is not failing to ingest.
    }
  }

  private async fetchOnce(url: string): Promise<Fetched> {
    if (this.requests > 0 && this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    this.requests += 1;

    const res = await this.fetchImpl(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) throw new FetchError(url, res.status);
    return { url, finalUrl: res.url || url, html: await res.text() };
  }
}
