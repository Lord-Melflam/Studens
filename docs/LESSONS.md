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

### Output that was never looked at

The frontend design draft was presented with text overlapping in many places:
codes running into titles, three figures in an aggregate ribbon colliding,
button labels wrapping out of their buttons, captions sitting on top of frames.

Two failures, and the second is worse than the first.

**The cause was hand-computed layout.** Every box had a `minimum width`, and its
text was then placed at coordinates worked out by hand with the text's width
guessed. Any string longer than the guess spilled out. The fix was structural:
styles that derive `text width` from the box width, so text wraps inside a box
and cannot overflow it, plus fitted containers instead of hand-sized ones and
explicit column widths inside every wireframe.

**But the real failure was not rendering all of it.** Four pages of thirteen
were rendered and inspected; the rest were presented unseen. A document is
output, and output that has not been looked at has not been checked. The rule
that now applies: render **every** page and inspect it before presenting a
visual artefact, exactly as a test suite is run in full rather than sampled.

### A gate improving copy nobody asked it to review

The independence line added to the shell's footer first read "the institutions
whose *courses* it lists". The FR-B16 gate rejected it: "courses" is RYC's
domain, and the shell may not know what a module draws.

It was right for a reason beyond the rule. That sentence would have become
*wrong* the day MPA ships, because MPA is not about courses. A boundary
check written to protect the architecture caught a factual error in product
copy.

**Worth remembering** when a gate objects to something that looks harmless: ask
what the gate is actually protecting before reaching for the exemption.

### Patching a systemic failure one instance at a time

The same overlaps were then fixed three times in a row, individually: a button
here, a column there, a caption after that. Each fix was correct and none
addressed the cause, so the next render produced new overlaps in new places.

The cause was only fixed after being told the problem was in **many** places,
which was the clue that it was one problem rather than several.

**Rule now in force.** Two instances of the same class of defect is the signal
to stop fixing instances and go looking for the mechanism producing them.

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

### Three versions of a format in one day

The catalogue snapshot went from version 1 to 2 to 3 within hours. Version 2
added faculty names, because the table they load into requires one. Version 3
added programme titles and the programme a course was reached through, because
browsing needs them.

Neither addition was a change of mind. Both were data the crawl already had in
its hands and discarded, and each was noticed only when something downstream
finally asked for it.

**Rule now in force.** Before designing a serialisation format, list what the
consumers will need, including the ones not built yet. Where the traversal
already knows something, keep it: the cost of an unused field is a few bytes,
and the cost of a missing one is a re-crawl and a version bump.

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
| `pkill -f` / `pgrep -f` | The pattern matched the shell **running the command**, which contains the string, so the shell killed itself. **Three times**, exit 144 and 143. The third time was after this row already existed | Kill by port (`ss -lntp`), or split the pattern (`"ingest-catalo""gue"`) so it cannot match your own command line. A trap written down is not a trap avoided: this one needed a habit, not a note |
| `Prisma.raw(x).toString()` | Does not return SQL text, so `SET LOCAL ROLE` became a syntax error | A role name is an **identifier** and cannot be a bound parameter. Validate against a strict pattern, then interpolate |
| npm type resolution | `@types/react` resolved to **19** while the stack chose React 18, and later nested under `apps/web` where a sibling package could not see it | Pin types to the runtime version exactly. A package that uses a library declares the types it needs rather than borrowing another package's |
| Shell quoting in `psql -c` | Escaped pipes mangled the SQL and produced a comparison of two empty strings, which then reported a false verdict | Put non-trivial SQL in a file or a heredoc, never inline with escapes |
| New toolchain, old `.gitignore` | Adding LaTeX meant `.aux`, `.out` and `.toc` files, which were staged for commit. Caught by the rule 6 review of staged files, not by foresight | A new build tool brings new generated files. Add them to `.gitignore` in the same change that introduces the tool |
| A comment is not a violation | The frontend boundary test failed on a CSS comment that *explained* the rule it was checking | Strip comments before scanning source for forbidden words |

---

## 7. Following instructions, not inferring them

Early failures, all of the same shape: acting on a plausible reading instead of
the stated one.

- **A git identity was proposed rather than asked for.** A plausible work
  address was inferred from context; the intended identity was a different one
  entirely. The permission prompt caught it before the first commit, which is
  the only reason it is a footnote rather than a rewritten history.
  (The addresses are not reproduced here, and the reason is its own small
  lesson. The first draft of this entry quoted both of them, and the rule 6
  pre-commit scan caught them **in this file**: a document about applying
  standards consistently, about to leak personal data into a public repository.
  One of the two was not public anywhere. Section 3 is about exactly that kind
  of inconsistency, and it turns out to be easy to commit while writing about
  it.)
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

---

## 9. The patterns underneath

Twelve entries is enough to see that most of them are four mistakes wearing
different clothes. This section is the useful part of the document.

### The thing is verified; the thing that verifies it is not

The isolation script checked grants and not its own ability to assume a role.
The lint config was read and believed rather than shown a violation. The fixture
proved a parser worked against markup tidier than the site it models. Four pages
of thirteen were rendered and the rest presented unseen.

In every case the artefact under test was examined carefully and **the
instrument was taken on trust**. The instrument is the thing to distrust: it is
the part whose failure is silent.

The habit that follows: after building any check, break the thing it checks and
watch it fail. Every gate in this repository has now been through that, and two
of them were found to be worthless by it.

### An absence is invisible

The crawl discarded the programme it had traversed and nothing looked missing,
because the faculty was still there. The schema lacked columns for fields the
parser was already extracting, and the pages simply showed less. Every `.tsx`
file was outside the lint gate, and the gate reported success. The join between
the quota and the anonymous table does not exist, and that is the single most
important property in the design.

Present things announce themselves. **Absent things have to be looked for on
purpose**, which is why the seam is now drawn with a red cross in the design
document, and why several tests assert that a field is *not* there.

### A rule written is not a rule applied

The page cache was specified as a politeness rule in a design note and then not
implemented, which cost a wasted crawl of 546 requests. The `pkill` trap was
written into this file and then walked into again. Style rules produced em
dashes until a grep enforced them.

Writing a rule down feels like adopting it and is not the same act. **A rule
needs a mechanism**: a test, a grep, a script, a gate. Where no mechanism is
possible, expect the rule to be broken and check by hand at a fixed point, which
for this project is the rule 6 review before every commit.

### Standards point outward more easily than inward

Reusing `tdaron`'s unlicensed code was refused, importing the EPL document
without permission was refused, and then whole UCLouvain pages were nearly
committed with a lecturer's name in them. A section was written about that
inconsistency, and the first draft of it leaked two real email addresses.

The pattern is not hypocrisy, it is attention: the standard is loaded when
judging someone else's material and unloaded when handling one's own.
**Consistency needs a checklist rather than good intentions**, which is what the
rule 6 scan is, and it has now caught this twice.
