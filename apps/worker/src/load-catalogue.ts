/**
 * Load a snapshot into the database.
 *
 *   npm run db:load                       loads data/catalogue.json
 *   npm run db:load -- --in other.json
 *
 * Runs in the worker for the same reason the crawl does: it is long, it is not
 * a request, and it must never sit in a request path (requirements 1.7).
 */
import { PrismaClient } from "@prisma/client";
import { load, loadSnapshot, shrinkMessage, shrinkVerdict } from "@studens/ref";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let path = "data/catalogue.json";
  let role: string | null = "studens_ref";
  /** Say you meant it. See the note in packages/ref/src/ingestion/shrink.ts. */
  let shrinkOk = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--in") {
      path = argv[i + 1] ?? path;
      i += 1;
    } else if (argv[i] === "--shrink-ok") {
      shrinkOk = true;
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

  /**
   * THE GUARD, BEFORE ANYTHING IS WRITTEN.
   *
   * A sampled crawl is a valid snapshot of forty courses, and loading it is a
   * valid transaction that succeeds. Nothing downstream would have complained;
   * the catalogue would simply have been replaced by a fortieth of itself. So
   * the check is here, where the old and the new are both known, rather than
   * anywhere that could only see one of them.
   */
  const prisma = new PrismaClient();
  const institution = snapshot.institution ?? "uclouvain";
  const before = await prisma.courseOffering.count({
    where: { course: { institution: { code: institution } } },
  });
  const verdict = shrinkVerdict(before, snapshot.offerings.length);
  if (verdict.refuse && !shrinkOk) {
    await prisma.$disconnect();
    throw new Error(shrinkMessage(verdict, institution));
  }
  if (verdict.refuse) {
    console.log(
      `\n  !!  shrinking ${institution} from ${verdict.before} to ${verdict.after} ` +
        `offerings, because --shrink-ok was given\n`,
    );
  }
  await prisma.$disconnect();

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
