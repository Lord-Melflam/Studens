/**
 * Print the project's countable state, from the repository and the database.
 *
 * WHY THIS EXISTS. `docs/TIMELINE.md` opened with a state table holding ten
 * cells, six of which were numbers that move on nearly every merge: commits,
 * requirements, open questions, tests, lines of code, reviews. It was corrected
 * on 2026-09-19 and was wrong again two merges later, which is not a
 * documentation failure but a design one. A number a person has to remember to
 * update is wrong from the first time somebody forgets, and it is wrong
 * silently: the document still reads fine.
 *
 * The same argument the interface already settled. `CatalogueFacts` fetches the
 * catalogue figures rather than storing a sentence containing them, because the
 * page said "546 cours" for weeks after the crawl widened to a second
 * university. The version that cannot rot is the one that is counted when
 * somebody asks.
 *
 * So the table keeps what does not rot, and this prints what does.
 *
 * IT RUNS THE TEST SUITE, which takes about twenty seconds. That is the only
 * honest way to state a test count: they are generated in loops in at least two
 * files, so anything read out of the source would be a guess that looks like a
 * fact. `--quick` skips it and says so rather than printing a stale number.
 *
 * THE DATABASE IS OPTIONAL. Catalogue and review figures need one, and there is
 * deliberately no fallback: a missing database prints a line saying so, because
 * a figure from the last time somebody ran this is the problem, not the answer.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const quick = process.argv.includes("--quick");

/** Runs a command and returns its output, or null if it failed. */
function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

function countUnique(text, pattern) {
  return new Set([...text.matchAll(pattern)].map((m) => m[0])).size;
}

function lines(dirs, filter) {
  let total = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist") continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (filter(p)) total += readFileSync(p, "utf8").split("\n").length;
    }
  };
  for (const d of dirs) walk(join(root, d));
  return total;
}

const requirements = readFileSync(join(root, "docs/requirements.md"), "utf8");

const fr = countUnique(requirements, /^\| FR-[A-Z]+\d+ /gm);
const nfr = countUnique(requirements, /^\| NFR-[A-Z]+\d+ /gm);
const con = countUnique(requirements, /^\| CON-\d+ /gm);
/**
 * An open question is one with a row of its own that is not struck through
 * anywhere. Counting unstruck rows alone gives 44, because section 7.1 writes
 * a resolved question out in full with its id intact: the strike in the table
 * above is what marks it closed.
 */
const ids = (pattern) => new Set([...requirements.matchAll(pattern)].map((m) => m[1]));
const asked = ids(/^\| (OPEN-\d+) \|/gm);
const closed = ids(/~~(OPEN-\d+)~~/g);
const open = [...asked].filter((id) => !closed.has(id)).length;
const resolved = closed.size;

const commits = (run("git", ["rev-list", "--count", "HEAD"]) ?? "?").trim();
const code = lines(["packages", "apps", "scripts"], (p) => /\.tsx?$/.test(p) && !p.endsWith(".d.ts"));
const tests = lines(["test"], (p) => p.endsWith(".ts"));

let suite = "not run (--quick)";
if (!quick) {
  const out = run("npx", ["vitest", "run", "--silent"]) ?? "";
  const m = /Tests\s+(\d+)\s+passed/.exec(out);
  suite = m ? `${m[1]} passing` : "could not be counted, run npm test";
}

/** Figures that live in the database. Absent is a state, not a fallback. */
async function fromDatabase() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    const out = {
      courses: await prisma.course.count(),
      programmes: await prisma.programme.count(),
      faculties: await prisma.faculty.count(),
      institutions: await prisma.institution.count(),
      offerings: await prisma.courseOffering.count(),
      named: await prisma.reviewAttributed.count(),
      anonymous: await prisma.reviewAnonymous.count(),
      suspended: await prisma.member.count({ where: { suspendedAt: { not: null } } }),
    };
    await prisma.$disconnect();
    return out;
  } catch {
    return null;
  }
}

const db = await fromDatabase();

const row = (label, value) => `  ${label.padEnd(22)} ${value}`;

console.log(`\nStudens, counted ${new Date().toISOString().slice(0, 10)}\n`);
console.log(row("Commits", commits));
console.log(row("Requirements", `${fr + nfr} (${fr} functional, ${nfr} non-functional, ${con} constraints)`));
console.log(row("Open questions", `${open} open, ${resolved} resolved`));
console.log(row("Tests", suite));
console.log(row("Lines", `${code.toLocaleString("en")} of TypeScript, ${tests.toLocaleString("en")} of tests`));

if (db) {
  console.log("");
  console.log(row("Catalogue", `${db.courses.toLocaleString("en")} courses, ${db.programmes.toLocaleString("en")} programmes`));
  console.log(row("", `${db.faculties} faculties, ${db.institutions} institutions, ${db.offerings.toLocaleString("en")} offerings`));
  console.log(row("Reviews", `${db.named + db.anonymous} (${db.named} named, ${db.anonymous} anonymous)`));
  console.log(row("Suspended accounts", `${db.suspended}`));
} else {
  console.log("");
  console.log("  No database reachable, so the catalogue and review figures are not shown.");
  console.log("  They are not cached anywhere: a number from the last run is the problem");
  console.log("  this command exists to remove.");
}
console.log("");
