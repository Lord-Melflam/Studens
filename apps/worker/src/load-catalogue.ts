/**
 * Load a snapshot into the database.
 *
 *   npm run db:load                       loads data/catalogue.json
 *   npm run db:load -- --in other.json
 *
 * Runs in the worker for the same reason the crawl does: it is long, it is not
 * a request, and it must never sit in a request path (requirements 1.7).
 */
import { load, loadSnapshot } from "@studens/ref";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let path = "data/catalogue.json";
  let role: string | null = "studens_ref";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--in") {
      path = argv[i + 1] ?? path;
      i += 1;
    } else if (argv[i] === "--no-role") {
      // Escape hatch for an environment where the module roles do not exist.
      role = null;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }

  const snapshot = await load(path);
  console.log(
    `loading ${path}: year ${snapshot.year}, ` +
      `${snapshot.faculties.length} faculties, ${snapshot.offerings.length} offerings`,
  );

  const started = Date.now();
  const r = await loadSnapshot(snapshot, { assumeRole: role });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `\ndone in ${seconds}s as ${role ?? "the connecting user"}\n` +
      `  faculties        ${r.faculties}\n` +
      `  programmes       ${r.programmes}\n` +
      `  courses created  ${r.coursesCreated}\n` +
      `  courses reused   ${r.coursesReused}   (ids kept, so reviews stay attached)\n` +
      `  offerings        ${r.offerings}\n` +
      `  teacher rows     ${r.teachers}\n` +
      `  faculty links    ${r.facultyLinks}\n` +
      `  programme links  ${r.programmeLinks}`,
  );
}

main().catch((err: unknown) => {
  // One transaction, so a failure leaves the previous catalogue in place.
  console.error(`\nload FAILED, the catalogue was not changed\n`);
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exitCode = 1;
});
