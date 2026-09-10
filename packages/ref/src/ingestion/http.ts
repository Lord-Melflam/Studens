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
}

export interface Fetched {
  url: string;
  finalUrl: string;
  html: string;
}

export class PoliteFetcher {
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  /** The queue tail. Every request chains onto it, so requests are serial. */
  private chain: Promise<unknown> = Promise.resolve();
  private requests = 0;

  constructor(opts: FetcherOptions = {}) {
    this.delayMs = opts.delayMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get requestCount(): number {
    return this.requests;
  }

  /** Serial by construction: callers cannot accidentally fan out. */
  async get(url: string): Promise<Fetched> {
    const run = this.chain.then(() => this.fetchOnce(url));
    this.chain = run.catch(() => undefined);
    return run;
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
