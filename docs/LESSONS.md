# Mistakes, and the rules they produced

A running record of what has gone wrong on this project and what each failure
changed. Kept because the rule is worth more than the memory of the bug, and
because a new contributor learns faster from a list of real failures than from a
list of good intentions.

Written impersonally on purpose. These are project events, not blame.

Grouped by kind rather than by date, because the groups are where the pattern
is. `TIMELINE.md` has the chronology.

---

## 1. Verification that verified nothing

The most dangerous category by a distance, because the result looks like a pass.

### A security check that cannot confirm its own identity proves nothing

`scripts/verify-isolation.sql`, first version. Fourteen checks of the database
grants, all apparently correct: each "must fail" case printed an `ERROR`.

Every one of those errors was `permission denied to set role`. PostgreSQL 14
requires role membership to `SET ROLE`, and the table owner did not have it. So
all fourteen checks ran **as the owner, with full access**, and every "must
fail" case quietly succeeded: `INSERT 0 1`, `DELETE 1`. The `ERROR` lines made
it look like the denials were working.

**Rule now in force.** Every check in that script asserts `current_user` matches
the role it meant to assume, and raises if it does not. Verified by mutation:
granting `studens_ryc` an INSERT it should not have makes the script fail with a
`SECURITY:` message and exit 3.

**Generalised.** A test that cannot fail is worse than no test, because it also
removes the suspicion that would have led someone to look.

### A gate that does not cover the files it is meant to cover

`eslint.config.js` matched `**/*.ts`. The entire frontend is `.tsx`, so **every
React file was unlinted** and outside FR-B6's boundary rule from the moment it
was written.

**Rule now in force.** After adding a file type, prove the gate sees it. Done
here by planting a deliberate deep import in a `.tsx` and watching
`no-restricted-imports` reject it, rather than by reading the config and
believing it.

### A gate whose fixture was tidier than reality

`test/catalogue/crawl.test.ts` served every link as `/cours-2025-x`. The live
site serves `cours-2025-x` **without the leading slash** on programme listings,
and with it on the faculty index. The link pattern required the slash, so the
crawl found 43 programmes and then zero courses. 62 unit tests passed while the
real run failed at the last step.

**Rule now in force.** Fixtures preserve the ugly parts of reality on purpose:
entity encoding, `<br />` inside labels, nested parentheses, inconsistent
hrefs. The fake site now serves both href forms and a test says why.

### A sample that is not a sample

`--max 60` took the head of a sorted list, which on EPL is sixty `ENANO`
courses: one alphabetical neighbourhood, all externally hosted, all with three
fields. Every labelled field came back empty and it looked exactly like a
parser failure.

**Rule now in force.** `maxOfferings` samples **across** the discovered list. A
smoke test that only exercises one neighbourhood tests one neighbourhood.

---

## 2. Requirements that were wrong, and only showed it when made concrete

### An over-broad rule is violated on day one and then ignored forever

FR-B9 required a reference module to hold **"no personal data in any column"**.
The first reference module we build is the course catalogue, which carries
lecturer names. So the rule was broken by the very thing it was written for.

**Rule now in force.** FR-B9 says no data about **Members**. Third-party data
from a public source is permitted; anything identifying a platform user is not.

**Generalised.** A rule that cannot survive its first real case teaches everyone
to route around rules.

### A promise that holds for one snapshot and not for two

FR-C3 promised that an administrator holding **"a dump, a backup, or query
access to the live tables"** cannot link an anonymous contribution to a Member.

True of one backup. Diff **two**, taken a day apart, and `MemberQuota.used`
moved for one Member while the anonymous table gained a handful of rows dated
that day: authorship narrows to roughly one in five on the measured numbers.
The rate-limiting note had treated this as a *live adversary* problem and
OPEN-27 put live adversaries out of scope, but a backup is stored data, which
FR-C3 explicitly named.

**Rule now in force.** FR-C3 states what it delivers: no linkage from any single
snapshot, and a bounded correlation across snapshots within one quota window.
The design did not change; the claim did. Backup cadence became a **privacy**
parameter (OPEN-41), not an operational one.

### A validator stricter than the data it validates

The course code pattern was `^[a-z]{3,6}\d{3,4}$`. It rejected a **complete,
successful 546-course crawl** over `lbio1237b`.

Measured afterwards across 555 real codes: four shapes, and six carry a single
trailing letter. They are real courses, since the EPL reviews document discusses
LEPL2214 whose catalogue entry is `lepl2214a`.

**Rule now in force.** Measure the data before writing the pattern that guards
it, and record the measurement beside the pattern. Kept strict rather than
widened to `.+`, because it is the only guard against a parser reading something
that is not a course code at all.

---

## 3. Applying a standard to others and not to ourselves

The repository refuses to reuse `tdaron/epl-opinions` because it has no licence,
and refuses to import the EPL reviews document without permission.

Then it was about to commit **two complete copies of UCLouvain course pages**,
including a named lecturer and their profile URL, as test fixtures.

**Rule now in force.** Fixtures are structural **excerpts** with invented names,
derived programmatically from real captures so the quirks survive. Verified no
real names remain.

**Generalised.** Every rule about other people's material applies to our own use
of it. Consistency is cheaper to keep than to explain.

---

## 4. Process failures around long-running work

### Changing the format under a running job

A full 546-course crawl was started, and then the snapshot format was changed
while it ran. The output was unreadable by the new code, so **546 requests to
the university were spent for nothing**.

**Rule now in force.** An on-disk page cache, on by default. It had been written
into `catalogue-ingestion.md` section 4 as a politeness rule and then skipped,
which is the second failure here: a rule you write and do not implement is a
rule you have decided to break. With it, the re-run took **6.6 seconds and made
zero requests**, 601 pages from cache.

Do not start a long external job and then change what consumes its output. If
the format must change, kill the job first.

### A crawl that discards a relationship it traversed

The crawl walked faculty, then programme, then course, and recorded
`{code, faculty}` while **throwing the programme away**. Browsing by programme
was therefore impossible from the snapshot, and the schema had the mirror hole:
`Programme` and `CourseOffering` with nothing joining them.

The loss was invisible **because the faculty was still there**. Nothing looked
missing.

**Rule now in force.** If a traversal knows something, record it. A crawl that
drops a relationship it walked is the easiest kind of data loss to notice too
late, because the result still looks complete.

---

## 5. A boundary that existed on one side only

The backend had `platform`, `ref` and `ryc` as separate packages with
dependency direction enforced by the build. The frontend was one app in which
RYC's course search **was** `apps/web/src/App.tsx`. Adding a second module would
have meant editing the first one's files, which FR-B4 forbids and which 1.5 item
3 calls the load-bearing decision of the project.

Caught by François asking whether a user would drop straight into RYC, not by
any gate.

**Rule now in force.** FR-B16 to FR-B18, plus
`test/architecture/frontend-shell.test.ts`: the shell may not mention course,
ECTS, review, programme, faculty, teacher or workload, and only the registry may
import a module package. Both violations were planted and both failed.

**Generalised.** When a structure is enforced on one side of a system, check the
other side has it too. The gates only look where they are pointed.

---

## 6. Tooling traps worth remembering

Small, and each cost real time.

| Trap | What happened | Avoid by |
|---|---|---|
| `pkill -f` / `pgrep -f` | The pattern matched the shell **running the command**, which contains the string, so the shell killed itself. Twice, exit 144 | Kill by port (`ss -lntp`), or split the pattern (`"ingest-catalo""gue"`) so it cannot match your own command line |
| `Prisma.raw(x).toString()` | Does not return SQL text, so `SET LOCAL ROLE` became a syntax error | A role name is an **identifier** and cannot be a bound parameter. Validate against a strict pattern, then interpolate |
| npm type resolution | `@types/react` resolved to **19** while the stack chose React 18, and later nested under `apps/web` where a sibling package could not see it | Pin types to the runtime version exactly. A package that uses a library declares the types it needs rather than borrowing another package's |
| Shell quoting in `psql -c` | Escaped pipes mangled the SQL and produced a comparison of two empty strings, which then reported a false verdict | Put non-trivial SQL in a file or a heredoc, never inline with escapes |
| A comment is not a violation | The frontend boundary test failed on a CSS comment that *explained* the rule it was checking | Strip comments before scanning source for forbidden words |

---

## 7. Following instructions, not inferring them

Early failures, all of the same shape: acting on a plausible reading instead of
the stated one.

- **A git identity was proposed rather than asked for.** A plausible work
  address was inferred from context; the intended identity was a different one
  entirely. The permission prompt caught it before the first commit, which is
  the only reason it is a footnote rather than a rewritten history.
  (The addresses are not reproduced here: this is a public repository, and the
  pre-commit scan in rule 6 flagged them in this very file. Section 3 of this
  document is about exactly that kind of inconsistency.)
- **`CLAUDE.md` content was edited three times** when the instruction was to
  exclude the file in `.gitignore`. The mechanism asked for was not the mechanism
  attempted.
- **A private repository was created** after "I'm following your suggestion",
  which referred to tracking and not to visibility. Agreement on one axis is not
  a decision on another.

**Rule now in force.** Rule 3 of `CLAUDE.md`: never assume, always check. Where a
plausible reading and a stated one differ, the stated one wins, and where the
statement is ambiguous across two axes, ask which one.

---

## 8. Style rules need a mechanical check

Em dashes appeared in fourteen places in memory files and fourteen in
`CLAUDE.md` **after** the rule forbidding them was set. Three more survived a
first cleanup: two had wrapped to the start of a line, and one was an en dash
rather than an em dash, sitting inside a numeric range where it looked
typographically reasonable.

**Rule now in force.** Grep every touched file for both characters before every
commit, alongside the banned-vocabulary grep. A style rule without a grep is a
preference, and the en dash is the one that survives, because it is the one
nobody is looking for.

(This file necessarily discusses those characters, so it is the one place the
check is expected to report a hit. Anywhere else is a real violation.)
