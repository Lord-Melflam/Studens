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
import { crawl, promote, PoliteFetcher } from "@studens/ref";

interface Args {
  year?: number;
  faculties: string[];
  max?: number;
  out: string;
  delayMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { faculties: [], out: "data/catalogue.json", delayMs: 700 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
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
        if (value) args.out = value;
        i += 1;
        break;
      case "--delay":
        args.delayMs = Number(value);
        i += 1;
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
  const started = Date.now();

  const snapshot = await crawl({
    ...(args.year !== undefined ? { year: args.year } : {}),
    ...(args.faculties.length ? { onlyFaculties: args.faculties } : {}),
    ...(args.max !== undefined ? { maxOfferings: args.max } : {}),
    fetcher: new PoliteFetcher({ delayMs: args.delayMs }),
    onProgress: (m) => console.log(`  ${m}`),
  });

  await promote(snapshot, args.out);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nwrote ${args.out}: year ${snapshot.year}, ` +
      `${snapshot.faculties.length} faculties, ${snapshot.offerings.length} offerings, ${seconds}s`,
  );
}

main().catch((err: unknown) => {
  // Fail loudly. A catalogue with wrong data is worse than one that refused to
  // update, because the first is invisible.
  console.error(`\ningestion FAILED, the live snapshot was not replaced\n`);
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exitCode = 1;
});
