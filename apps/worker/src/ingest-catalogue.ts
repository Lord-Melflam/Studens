/**
 * Run the catalogue ingestion.
 *
 * Lives in the worker because a full crawl is long, network bound and must
 * never sit in a request path (requirements 1.7).
 *
 *   npm run ingest -- --faculty epl --max 25
 *   npm run ingest -- --year 2025 --out data/catalogue.json
 *
 * Politeness is not optional and not configurable downward: see
 * docs/design/catalogue-ingestion.md section 4.
 */
import { promote, PoliteFetcher, uclouvain, ulb, type CatalogueSource } from "@studens/ref";

/**
 * Which catalogues can be crawled, by the code they are filed under.
 *
 * A map rather than a switch so that adding a third is a line here and nothing
 * else, which is the same rule the module registry follows (FR-B4).
 */
const SOURCES: Record<string, CatalogueSource> = {
  [uclouvain.institution]: uclouvain,
  [ulb.institution]: ulb,
};

interface Args {
  /** Which institution's catalogue. Defaults to UCLouvain, which is what every
      existing command line means. */
  source: string;
  /** Also fetch what a source keeps only on its per-course pages. See --prose. */
  prose: boolean;
  year?: number;
  faculties: string[];
  max?: number;
  out: string;
  /** Whether `--out` was given, which makes any destination deliberate. */
  explicitOut: boolean;
  delayMs: number;
  maxRequests?: number;
  /**
   * On-disk page cache. On by default, because developing the ingestion means
   * re-running it and every re-run without a cache is another few hundred
   * requests at the university's expense. Learned the hard way: a full crawl
   * was thrown away because the snapshot format changed mid-run.
   */
  cacheDir: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    source: uclouvain.institution,
    prose: false,
    faculties: [],
    out: "data/catalogue.json",
    explicitOut: false,
    delayMs: 700,
    cacheDir: "data/page-cache",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--prose":
        args.prose = true;
        break;
      case "--source":
        if (value) args.source = value.trim().toLowerCase();
        i += 1;
        break;
      case "--year":
        args.year = Number(value);
        i += 1;
        break;
      case "--faculty":
        if (value) args.faculties.push(...value.split(",").map((f) => f.trim()));
        i += 1;
        break;
      case "--max":
        // Samples across the discovered list, not the first N. See crawl.ts.
        args.max = Number(value);
        i += 1;
        break;
      case "--out":
        if (value) {
          args.out = value;
          args.explicitOut = true;
        }
        i += 1;
        break;
      case "--delay":
        args.delayMs = Number(value);
        i += 1;
        break;
      case "--max-requests":
        args.maxRequests = Number(value);
        i += 1;
        break;
      case "--no-cache":
        args.cacheDir = undefined;
        break;
      default:
        throw new Error(`unknown argument: ${flag}`);
    }
  }
  if (args.delayMs < 200) {
    // Refuse to be impolite. robots.txt sets no crawl delay, so this is on us.
    throw new Error("--delay below 200 ms is not permitted against uclouvain.be");
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const source = SOURCES[args.source];
  if (!source) {
    throw new Error(
      `no source for "${args.source}"; known: ${Object.keys(SOURCES).sort().join(", ")}`,
    );
  }
  // A snapshot holds ONE institution's crawl, so two sources must not write to
  // one file. Defaulted rather than required, so every command written before
  // there was a second source still means what it meant.
  if (args.out === "data/catalogue.json" && source.institution !== uclouvain.institution) {
    args.out = `data/catalogue-${source.institution}.json`;
  }

  /**
   * A PARTIAL CRAWL DOES NOT GET THE LIVE FILENAME.
   *
   * `--max 40` used to write `data/catalogue.json`, the file a full crawl
   * writes and the file `db:load` reads by default. A sample would therefore
   * become the live snapshot by sitting still, and the next load would replace
   * the real catalogue with a fortieth of itself, succeeding at every step.
   *
   * The guard in `db:load` catches the damage. This stops the hazard existing:
   * two different artefacts stop sharing a name, so nobody has to notice.
   * Naming `--out data/catalogue.json` explicitly still works, because that is
   * somebody being deliberate rather than somebody forgetting.
   */
  const partial = args.max !== undefined || args.faculties.length > 0;
  if (partial && !args.explicitOut) {
    const base = args.out.replace(/\.json$/, "");
    args.out = `${base}-partial.json`;
    console.log(
      `partial crawl (${args.max !== undefined ? `--max ${args.max}` : "--faculty"}), ` +
        `writing ${args.out} rather than the live snapshot`,
    );
  }
  const started = Date.now();
  const fetcher = new PoliteFetcher({
    delayMs: args.delayMs,
    maxRequests: args.maxRequests,
    cacheDir: args.cacheDir,
  });

  console.log(`crawling ${source.label} into ${args.out}`);
  const snapshot = await source.crawl({
    ...(args.year !== undefined ? { year: args.year } : {}),
    ...(args.faculties.length ? { onlyFaculties: args.faculties } : {}),
    ...(args.max !== undefined ? { maxOfferings: args.max } : {}),
    ...(args.prose ? { prose: true } : {}),
    fetcher: fetcher,
    onProgress: (m) => console.log(`  ${m}`),
  });

  await promote(snapshot, args.out);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nwrote ${args.out}: year ${snapshot.year}, ` +
      `${snapshot.faculties.length} faculties, ${snapshot.programmes.length} programmes, ` +
      `${snapshot.offerings.length} offerings, ${seconds}s\n` +
      `  ${fetcher.requestCount} requests to ${source.label}, ${fetcher.cacheHits} served from cache`,
  );
}

main().catch((err: unknown) => {
  // Fail loudly. A catalogue with wrong data is worse than one that refused to
  // update, because the first is invisible.
  console.error(`\ningestion FAILED, the live snapshot was not replaced\n`);
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exitCode = 1;
});
