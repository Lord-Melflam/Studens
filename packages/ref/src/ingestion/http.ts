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
import { FetchError, BudgetExceeded } from "./errors.js";

/**
 * Identifies the project and gives a way to reach us. The repository URL rather
 * than a personal address on purpose: this is a public string.
 */
/**
 * Statuses worth asking about again. Everything else is an answer, not a
 * hiccup: a 404 says the page is not there and a 403 says do not ask.
 */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

/**
 * Whether asking again could plausibly give a different answer.
 *
 * A transient STATUS is only half of it, and the missing half cost a
 * twelve-minute crawl: `AbortSignal.timeout` throws a `TimeoutError`, which
 * carries no status at all, so a single slow page ended a run of 969 after 750
 * of them had been read. A failure with no status is a failure of the
 * connection rather than an answer from the server, and a connection is the
 * most obviously retryable thing there is.
 *
 * Anything this function is unsure about is retried, because `fetchOnce` only
 * ever does network work: it cannot throw a parse error or a programming
 * mistake that retrying would paper over.
 */
function isTransient(err: unknown): boolean {
  if (err instanceof FetchError) return TRANSIENT.has(err.status);
  return err instanceof Error;
}

/** `Retry-After`, in milliseconds, as seconds or as an HTTP date. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(raw);
  return Number.isNaN(when) ? null : Math.max(0, when - Date.now());
}

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
  /**
   * The most requests this fetcher may make of the university. Cache hits do
   * not count, because they cost it nothing.
   *
   * A ceiling, not a target. One faculty is about 600 requests and all 21 are
   * roughly 9,000, so the difference between a scoped run and a full one is a
   * factor of fifteen, and the way to find that out should not be a two-hour
   * crawl somebody started by forgetting a flag.
   */
  maxRequests?: number | undefined;
  /**
   * How many times a TRANSIENT failure is retried before the run gives up.
   *
   * `cours-2025-lcems2341` answered 503 three times in a row and then 200,
   * with the first attempt taking ten seconds. Nothing was wrong with the page
   * and nothing was wrong with us: a server that size has a bad minute. Without
   * this, one bad minute anywhere in nine thousand requests ends the crawl.
   */
  retries?: number;
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
  private readonly maxRequests: number;
  private readonly retries: number;
  private retried = 0;
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
    this.maxRequests = opts.maxRequests ?? Number.POSITIVE_INFINITY;
    this.retries = opts.retries ?? 3;
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

  /** How many requests had to be asked again after a transient failure. */
  get retryCount(): number {
    return this.retried;
  }

  /** The delay between requests, so a caller can say what a run will cost. */
  get plannedDelayMs(): number {
    return this.delayMs;
  }

  /** Serial by construction: callers cannot accidentally fan out. */
  async get(url: string): Promise<Fetched> {
    const cached = await this.fromCache(url);
    if (cached) {
      this.hits += 1;
      return { url, finalUrl: cached.finalUrl, html: cached.html };
    }
    const run = this.chain.then(() => this.fetchWithRetries(url));
    this.chain = run.catch(() => undefined);
    const fetched = await run;
    await this.toCache(url, fetched);
    return fetched;
  }

  /**
   * Retry a transient answer, and only a transient one.
   *
   * A 404 means the page is not there and asking again is noise. A 503 means
   * the server is briefly unwell, and the polite answer is to wait longer than
   * usual and ask once more. Every attempt counts against the request budget,
   * because every attempt is work the university did.
   *
   * The wait grows, and `Retry-After` wins when the server sends one: it is the
   * server saying how long it wants to be left alone, which is not a number to
   * second-guess.
   */
  private async fetchWithRetries(url: string): Promise<Fetched> {
    let last: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await this.fetchOnce(url);
      } catch (err) {
        last = err;
        if (!isTransient(err) || attempt === this.retries) break;
        const wait = err instanceof FetchError && err.retryAfterMs !== null
          ? err.retryAfterMs
          : this.delayMs * 2 ** (attempt + 2);
        this.retried += 1;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw last;
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
    // Checked before the delay, so hitting the ceiling stops immediately rather
    // than waiting first. The run fails and the snapshot is not promoted: a
    // crawl that stopped early has an incomplete catalogue, and promoting it
    // would empty course pages that exist (section 6).
    if (this.requests >= this.maxRequests) throw new BudgetExceeded(this.maxRequests, url);
    if (this.requests > 0 && this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    this.requests += 1;

    const res = await this.fetchImpl(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) throw new FetchError(url, res.status, retryAfterMs(res));
    return { url, finalUrl: res.url || url, html: await res.text() };
  }
}
