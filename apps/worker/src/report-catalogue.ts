/**
 * Is the catalogue complete, and what did the crawl lose?
 *
 *   npm run catalogue:report
 *
 * WHY THIS EXISTS. A full crawl is nine thousand requests over about two hours,
 * and the things that go wrong in it are individually small: a course page the
 * university would not serve, a programme whose course list never loaded, a
 * field that came back empty. Each one is one student who cannot find their
 * course, and the terminal output that mentioned it scrolled past an hour ago.
 *
 * So this reads the snapshot and the database, compares them, and answers one
 * question in one line at the end: is anything missing. It writes the same
 * thing to a file, because "we noticed in September" is not a plan.
 *
 * IT CHANGES NOTHING. Read-only against both, so it is safe to run at any time,
 * including while somebody is using the app.
 */
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { load, type Snapshot } from "@studens/ref";
import { loadDotEnv } from "./env.js";

loadDotEnv();

interface Args {
  snapshot: string;
  out: string;
  year?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { snapshot: "data/catalogue.json", out: "data/catalogue-report.txt" };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case "--snapshot":
        if (value) args.snapshot = value;
        i += 1;
        break;
      case "--out":
        if (value) args.out = value;
        i += 1;
        break;
      case "--year":
        args.year = Number(value);
        i += 1;
        break;
      default:
        throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

/** A section of the report. `codes` is the evidence, never a summary of itself. */
interface Finding {
  severity: "gap" | "note";
  title: string;
  codes: string[];
  explain: string;
}

function line(label: string, value: string | number): string {
  return `  ${label.padEnd(42, ".")} ${value}`;
}

async function report(snapshot: Snapshot, prisma: PrismaClient, year: number): Promise<string> {
  const out: string[] = [];
  const findings: Finding[] = [];

  out.push(`Catalogue report, ${new Date().toISOString()}`);
  out.push(`snapshot taken ${snapshot.takenAt}, academic year ${snapshot.year}-${snapshot.year + 1}`);
  out.push("");

  // --- what the crawl found -------------------------------------------------
  const listed = snapshot.programmes.filter((p) => p.listing === "listed");
  const empty = snapshot.programmes.filter((p) => p.listing === "empty");
  const unreachable = snapshot.programmes.filter((p) => p.listing === "unreachable");

  out.push("WHAT THE CRAWL FOUND");
  out.push(line("faculties", snapshot.faculties.length));
  out.push(line("programmes", snapshot.programmes.length));
  out.push(line("  with a course list", listed.length));
  out.push(line("  with an empty course list", empty.length));
  out.push(line("  whose course list never loaded", unreachable.length));
  out.push(line("distinct courses reached", new Set(snapshot.reachedVia.map((r) => r.code)).size));
  out.push(line("course pages parsed", snapshot.offerings.length));
  out.push(line("course pages the server would not give", snapshot.unavailable.length));
  out.push(line("courses published with no credits", snapshot.withoutEcts.length));
  out.push("");

  if (unreachable.length > 0) {
    findings.push({
      severity: "gap",
      title: `${unreachable.length} programmes whose course list never loaded`,
      codes: unreachable.map((p) => p.code),
      explain:
        "Every course in these is missing from Studens, and the programme still\n" +
        "  appears with zero courses. Re-run the ingestion for them before deciding\n" +
        "  anything: it is usually transient.",
    });
  }
  if (snapshot.unavailable.length > 0) {
    findings.push({
      severity: "gap",
      title: `${snapshot.unavailable.length} course pages the university would not serve`,
      codes: snapshot.unavailable,
      explain:
        "Reached from a programme and then not served, after the retries. Some are\n" +
        "  broken upstream for days; check one by hand before re-running.",
    });
  }
  if (snapshot.withoutEcts.length > 0) {
    findings.push({
      severity: "gap",
      title: `${snapshot.withoutEcts.length} courses the catalogue publishes with no credits`,
      codes: snapshot.withoutEcts,
      explain:
        "Real courses whose page states no ECTS at all, so they are not stored: RYC\n" +
        "  measures workload against credits and they cannot carry it. Nobody will find\n" +
        "  these by searching. Storing an invented zero would be worse, so the decision\n" +
        "  to make is whether credits should be optional, not whether to guess them.",
    });
  }
  if (empty.length > 0) {
    findings.push({
      severity: "note",
      title: `${empty.length} programmes list no courses at all`,
      codes: empty.map((p) => p.code),
      explain:
        "Normal for a joint programme, whose courses are hosted by the partner\n" +
        "  institution, and for some certificates. `prog-2025-cyse2m` is one.",
    });
  }

  // --- what reached the database -------------------------------------------
  const [dbOfferings, dbProgrammes, dbCourses] = await Promise.all([
    prisma.courseOffering.count({ where: { year } }),
    prisma.programme.count({ where: { year } }),
    prisma.course.count(),
  ]);
  out.push("WHAT REACHED THE DATABASE");
  out.push(line("programmes", dbProgrammes));
  out.push(line("course offerings this year", dbOfferings));
  out.push(line("courses, all years", dbCourses));
  out.push("");

  // The comparison that matters: everything parsed should have been stored.
  const stored = new Set(
    (
      await prisma.courseOffering.findMany({
        where: { year },
        select: { course: { select: { code: true } } },
      })
    ).map((o) => o.course.code),
  );
  const notStored = snapshot.offerings.map((o) => o.code).filter((c) => !stored.has(c));
  if (notStored.length > 0) {
    findings.push({
      severity: "gap",
      title: `${notStored.length} courses are in the snapshot and not in the database`,
      codes: notStored,
      explain: "The load did not finish, or it ran against a different snapshot. Re-run `npm run db:load`.",
    });
  }

  // The other direction, which is how a stale year survives a shrinking crawl.
  const parsed = new Set(snapshot.offerings.map((o) => o.code));
  const onlyInDb = [...stored].filter((c) => !parsed.has(c));
  if (onlyInDb.length > 0) {
    findings.push({
      severity: "note",
      title: `${onlyInDb.length} courses are in the database and not in this snapshot`,
      codes: onlyInDb,
      explain:
        "Left over from a wider crawl than this one. Harmless, and expected when\n" +
        "  the snapshot was scoped with --faculty. It is a gap only if this run was\n" +
        "  meant to cover everything.",
    });
  }

  if (snapshot.conflicts.length > 0) {
    findings.push({
      severity: "note",
      title: `${snapshot.conflicts.length} programmes where the two sources disagree on the site`,
      codes: snapshot.conflicts.map((c) => `${c.code}: index says ${c.fromIndex}, search says ${c.fromSearch}`),
      explain: "The search application won. Both values are kept so somebody can judge.",
    });
  }

  // --- findings -------------------------------------------------------------
  const gaps = findings.filter((f) => f.severity === "gap");
  out.push(gaps.length === 0 ? "NOTHING IS MISSING" : "GAPS");
  for (const f of findings) {
    out.push("");
    out.push(`${f.severity === "gap" ? "  [GAP] " : "  [note] "}${f.title}`);
    out.push(`  ${f.explain}`);
    out.push(`  ${f.codes.slice(0, 40).join(", ")}${f.codes.length > 40 ? ", ..." : ""}`);
  }
  out.push("");
  out.push(
    gaps.length === 0
      ? "VERDICT: fully served. Everything reached from a programme is in the database."
      : `VERDICT: ${gaps.length} kind(s) of gap above. Somebody will not find their course.`,
  );
  return out.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = await load(args.snapshot);
  const prisma = new PrismaClient();
  try {
    const text = await report(snapshot, prisma, args.year ?? snapshot.year);
    console.log(text);
    await writeFile(args.out, `${text}\n`, "utf8");
    console.log(`\nwritten to ${args.out}`);
    // A non-zero exit when something is missing, so this can gate a deployment
    // later without anybody having to read it.
    if (text.includes("VERDICT: fully served")) return;
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
