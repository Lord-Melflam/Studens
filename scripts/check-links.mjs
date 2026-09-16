/**
 * Every path a tracked file mentions must exist, and must be tracked.
 *
 * TWO FAILURES THIS CATCHES, both of which had happened by 2026-09-16.
 *
 * A moved file leaving dangling references. `docs/design/` held fourteen files
 * and 103 references pointed into it; splitting it without a check would have
 * left some of them aimed at nothing, and `npm run gates` does not read prose.
 *
 * A tracked document citing an UNTRACKED one. Nine references to the local
 * working notes had accumulated in the specification, the design notes and one
 * source file. They resolve for whoever wrote them and send a public reader to
 * a file that is not there. That is the worse of the two, because it looks fine
 * from inside the repository.
 *
 * THE FIRST VERSION OF THIS CHECK PROVED NOTHING. It only matched paths
 * beginning with a known top-level directory, so every relative link in
 * `docs/README.md` went unexamined, and two deliberate violations fed to it
 * passed. That is the same false green `scripts/verify-isolation.sql` shipped
 * with once, recorded in LESSONS section 4. A check that cannot fail is not a
 * check, so it now tests itself against known-bad input before it runs.
 *
 * Deliberately not a general link checker. It does not fetch URLs: the network
 * is not available in CI by design, an external link rotting is not this
 * project's bug, and a check that is sometimes offline is one people learn to
 * ignore.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const tracked = new Set(
  execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n"),
);

/** Only text worth scanning. A lockfile mentions thousands of paths it does not own. */
const SCANNED = /\.(md|tex|ts|tsx|css|sql|sh|yml|js|mjs)$/;
/**
 * `scripts/check-links.mjs` excludes itself: its self-test holds strings that
 * are deliberately shaped like broken references, and they are the fixtures
 * that prove this works. Scanning them would report the proof as the problem.
 */
const SKIP = /^(package-lock\.json|scripts\/check-links\.mjs|.*\.min\..*)$/;

/** Extensions treated as naming a file in this repository. */
const EXT = "md|tex|tsx|ts|css|sql|sh|yml|json|prisma|mjs";

/**
 * A markdown link target: the thing inside `](...)`. These are what a reader
 * actually clicks, and they are usually written relative to the document.
 */
const MD_LINK = new RegExp(`\\]\\(([^)\\s#]+?\\.(?:${EXT}))(?:#[^)]*)?\\)`, "g");

/**
 * A path in prose or code: contains a slash, ends in a known extension.
 * Requiring the slash keeps ordinary words out.
 *
 * ALTERNATION ORDER MATTERS: `tsx` before `ts`, or every `Component.tsx` reads
 * as a missing `Component.ts`. The first run reported eleven of those.
 */
const BARE_PATH = new RegExp(`(?<![\\w./-])((?:\\.\\.?/)?[\\w.-]+(?:/[\\w.-]+)+\\.(?:${EXT}))`, "g");

/**
 * Paths that are GENERATED and therefore legitimately not in git.
 *
 * `data/catalogue.json` is what `npm run ingest` writes: derived from a third
 * party's website, stale within a year, and ignored on purpose. Documenting the
 * command that produces it means naming it, so naming it must be allowed.
 * Listed rather than inferred from `.gitignore`, because most of what that file
 * ignores is local context nothing should reference.
 */
const GENERATED = [/^data\//, /^docs\/typeset\/.*\.(pdf|aux|log|out|toc)$/];

/** Mentioned as something that does not exist yet, rather than as a reference. */
const FORWARD_LOOKING = /\b(will|would|planned|future|once|when)\b/i;

/**
 * Named precisely because it must NOT be there.
 *
 * `test/architecture/frontend-shell.test.ts` asserts that `apps/web/src/App.tsx`
 * does not exist: that file was RYC's screen living in the shell, and the test
 * is what stops it coming back. A check that called such a line broken would
 * force deleting the assertion that keeps the boundary.
 */
const ASSERTED_ABSENT = /toBe\(false\)|\bnot\.|must not|no longer|was removed|does not exist/i;

/**
 * What is wrong with one mention, or null.
 *
 * Tries it as written from the root and as written relative to the mentioning
 * file, because both spellings appear and both are correct in their place.
 *
 * TAKES ITS WORLD AS AN ARGUMENT. The set of tracked files and the existence
 * check are passed in, so the self-test below can hand it a synthetic
 * repository instead of depending on what happens to be on this disk. The
 * first version probed the real filesystem, passed here, and failed in CI: a
 * fresh clone has no local notes file, so the probe that was meant to prove
 * "exists but untracked" proved "missing" instead. A self-test that only works
 * on the author's machine is the thing it exists to prevent.
 */
function verdict(file, ref, world) {
  const { isTracked, exists } = world;
  const candidates = [normalize(ref), normalize(relative(root, join(root, dirname(file), ref)))];
  for (const c of candidates) if (GENERATED.some((g) => g.test(c))) return null;
  for (const c of candidates) if (isTracked(c)) return null;
  // Exists but is not tracked: the dangerous case, since it resolves here and
  // not for anybody reading the published repository.
  for (const c of candidates) if (exists(c)) return `UNTRACKED ${c}`;
  return `MISSING ${normalize(ref)}`;
}

/** The real repository. */
const REAL = {
  isTracked: (p) => tracked.has(p),
  exists: (p) => existsSync(join(root, p)),
};

function scan(files) {
  const problems = [];
  for (const file of files) {
    if (!SCANNED.test(file) || SKIP.test(file)) continue;
    const lines = readFileSync(join(root, file), "utf8").split("\n");

    lines.forEach((line, i) => {
      // A glob or a wildcard is a pattern, not a reference.
      if (/[*?]/.test(line)) return;
      // A multi-line assertion puts the path, the message and the expectation on
      // separate lines, so the verdict is read over a small window.
      const context = lines.slice(Math.max(0, i - 1), i + 3).join(" ");

      const refs = new Set();
      for (const m of line.matchAll(MD_LINK)) refs.add(m[1]);
      for (const m of line.matchAll(BARE_PATH)) refs.add(m[1]);

      for (const ref of refs) {
        const bad = verdict(file, ref, REAL);
        if (!bad) continue;
        const excused = FORWARD_LOOKING.test(context) || ASSERTED_ABSENT.test(context);
        if (bad.startsWith("MISSING") && excused) continue;
        problems.push(`${file}:${i + 1}  references ${bad}`);
      }
    });
  }
  return problems;
}

/**
 * The check has to be able to fail, on any machine.
 *
 * A synthetic repository with exactly one tracked file and one untracked file
 * on disk, so the three verdicts are exercised without touching the real one.
 * If any of them stops being reached, this says so and exits non-zero rather
 * than going quiet.
 */
function selfTest() {
  const world = {
    isTracked: (p) => p === "docs/design/real.md",
    exists: (p) => p === "docs/design/real.md" || p === "local-notes.md",
  };
  const cases = [
    ["design/real.md", null, "a tracked sibling resolves"],
    ["design/gone.md", "MISSING", "a path that is nowhere"],
    ["../local-notes.md", "UNTRACKED", "a file on disk that git does not have"],
    ["../data/catalogue.json", null, "a generated file is allowed"],
  ];
  const failures = [];
  for (const [ref, want, what] of cases) {
    const got = verdict("docs/README.md", ref, world);
    const ok = want === null ? got === null : got !== null && got.startsWith(want);
    if (!ok) failures.push(`${what}: expected ${want ?? "no problem"} for ${ref}, got ${got ?? "no problem"}`);
  }
  return failures;
}

const blind = selfTest();
if (blind.length > 0) {
  console.error("\nthe link check can no longer detect a broken link:\n");
  for (const b of blind) console.error(`  ${b}`);
  console.error("\nFix the matcher. A check that cannot fail proves nothing.\n");
  process.exit(1);
}

const problems = scan(tracked);
if (problems.length > 0) {
  console.error(`\n${problems.length} broken reference(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nA tracked file may only point at another tracked file. Moving something\n" +
      "means updating what points at it, in the same change (CONTRIBUTING.md).\n",
  );
  process.exit(1);
}

console.log(
  `links: ${tracked.size} tracked files scanned, every path resolves, ` +
    `and the check still detects a broken one`,
);
