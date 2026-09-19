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

### A suite that reported success and had quietly emptied itself

`test/kernel/kernel.db.test.ts` holds the 23 tests that cover the thing this
whole architecture was chosen for: the quota race, the role boundary that stops
a feature module writing an anonymous row, and the FR-D15 and FR-C16 filtering
that happens server side. They skip when no database is reachable, so that
`npm run gates` stays infrastructure free.

The skip was silent, and nothing ever ran them. The `gates` CI job has no
database service. The `database` job ran the migrations and the isolation script
and **never invoked vitest at all**. So every run since the tests were written
printed `Tests 163 passed | 23 skipped` in green, and the 23 most important
tests in the repository had never executed in CI once.

The file's own docstring said "Run by `npm run gates:db` and by the CI database
job". It was not, and had never been. A comment asserting coverage is the
easiest place for coverage to go missing, because it answers the question
without anyone checking.

Found on 2026-09-11 while deciding which checks should gate a merge. Making
those jobs required would have been worse than leaving them optional: a required
check that skips the tests it exists for converts an absence into an assurance.

**Rule now in force.** `npm run gates:db` ends with `test:db`, which sets
`STUDENS_REQUIRE_DB=1`; where these tests are supposed to run, an unreachable
database is a hard failure with a named reason, not a skip. Verified by running
it with the database down and watching it exit 1.

**Generalised.** A conditional skip is a silent branch, and a green run tells
you nothing about which branch it took. Anywhere a test can decide not to run,
something has to assert that it did: the count, an environment flag, or both.
This is the same shape as the isolation script that could not confirm which role
it was running as. That one proved nothing while claiming to prove fourteen
things; this one proved nothing while claiming to prove twenty-three.

### A screen with no address is a screen nothing can reach

RYC held its entire position in component state: which tab, which course, and
whether the review form was open. It looked like navigation and was not. The
consequences were all the same bug:

- the browser Back button left the app instead of stepping back a screen;
- a course page could not be sent to anyone, because it had no URL;
- a refresh lost your place and dropped you at the module root;
- and the review form, five screens deep, vanished if you touched reload.

The app zone had the mirror image: the brand went to the app home, so once
inside there was **no route out** to what Studens is, who runs it, or what
anonymity does not protect. François reported that half; the other half turned
up while looking for its cause, which is the usual way round.

**What made it invisible.** None of it is an error. Every page returns 200,
because a single page application serves the same document whatever the path,
and every unit test passed because each component was correct about its own
state. Nothing in the system had an opinion about whether a screen was
reachable.

**The fix, and the interface it needed.** A module now owns the path below
`/app/<id>`: the shell slices its own prefix off and hands the rest over
without parsing it, so RYC gets real routes while the shell still does not know
what a course is (FR-B16). Parsing lives in one exported function, so the map
from URL to screen is a thing tests can hold.

**Generalised.** State that decides what is on screen belongs in the URL. If it
does not have an address, it cannot be linked, bookmarked, refreshed, reached
with Back, or sent to somebody who is stuck, and none of those failures will
ever show up as an error.

### Sign-in worked, and the product said nothing

The first real Google sign-in succeeded on the first try: the member was
created, the session was issued, the cookie was set. François saw the public
home page, still offering "Se connecter" and "Créer un compte", and reasonably
concluded it had failed.

Two gaps, one symptom, and neither was in the part that was hard.

**The callback redirected to `/`.** That is the marketing page. Nothing carried
a member who had just joined into the thing they joined.

**The public header was session blind.** The account control lived only in the
app shell, because the public zone was built before authentication existed and
nobody went back. So the header could offer to sign you in and could never say
you already were.

**What makes this the expensive kind of bug.** Every automated check passed.
The OIDC tests passed, the route tests passed, the public zone tests passed, CI
was green, and the flow was verified end to end at the level of HTTP: 302 to
Google, code exchanged, member row written. All of that was true, and the
product was still unusable, because **no test and no gate asks "and then what
does the person see".**

**Generalised.** A feature is not finished when its mechanism works. It is
finished when the path through it ends somewhere the person wanted to be. The
seams between two correct pieces are where this hides, and they are exactly the
places no unit test looks: the callback belongs to the API, the header belongs
to the web app, and each was right about its own half.

The cheapest guard is not another unit test. It is walking the path once, as a
person, which is what found it.

### A prefix added everywhere, except where it was read

The locale went into the URL path, `/fr/app/ryc`. `main.tsx` strips it and
matches on the rest, which is right. `Shell` did not: it kept passing
`window.location.pathname` straight to `moduleIdFrom`, which tested
`startsWith("/app")`. With a language in front, that is false. So clicking a
module changed the URL and left the screen on the module list.

**A dead button is not an error.** Nothing threw, nothing logged, CI was green,
and the page returned 200 because the SPA shell loads whatever the path. It was
found by François clicking it.

The tests did not catch it because every one of them called `isAppPath` and
`moduleIdFrom` with paths that had **already been stripped**, which is the form
the router produces internally and not the form a browser hands you. The test
data was drawn from the wrong side of the transformation.

**Fixed structurally rather than at the call site.** Both functions now strip
the language themselves, so no caller can pass the wrong form. Stripping twice
is a no-op, so the callers that were already correct lose nothing. Verified by
restoring the bug and watching the new test fail.

**Also extracted the Shell's one-line decision** into `activeModuleFor(path)`,
because a decision inside a component is a decision nothing can test. That is
the same move as `flow.ts` for the review path.

**Generalised.** When a value gains a prefix, a suffix or a wrapper, the risk is
not the places that were changed: it is the places that read the old shape and
still typecheck. Both forms are strings. The type system had nothing to say, and
neither did any test written from the internal form.

### A narrow fix applied globally

Course page labels carry `<br />` inside them, and cheerio joins text across a
break with nothing, so `Faculté ou entité<br />en charge` read as
`entitéen charge` and every label lookup spanning a break failed. The fix was
one line, `$("br").replaceWith(" ")`, run once before anything read the
document.

It fixed the labels. It also replaced **3,988 line breaks inside the values**,
which is where the structure of the long fields lived. Every list, every
paragraph break and every heading in the evaluation, themes and content fields
became a space, and those fields shipped as one unbroken blob of up to two
thousand characters. Nothing failed. The parser tests passed, because they
assert that `35%` and `55%` appear in the assessment text, and they did.

Caught by François reading a course page, not by any gate.

**The fix**: the substitution now runs on a clone of the one node being read,
so it applies where it is wanted and nowhere else.

**Generalised.** The bug was not the substitution, it was its *scope*. A
document-wide mutation to solve a problem in one kind of node will hit every
other kind, and the ones it damages are exactly the ones nobody is asserting
on. When reaching for a global transform, the question is not "does this fix
my case" but "what else does it touch, and would I notice".

---

### Copy taken from a design document describes a product that does not exist

The fork screen's two cards were written from `docs/typeset/frontend-design.tex`,
which draws the **target** product. So the named card offered three reasons to
choose it: the review stays editable, it appears in "Mes avis", and its
deletion can be requested.

None of the three is built. FR-C14 and FR-D12 are specified and have no code.

That is worse than an ordinary inaccuracy, because of *which* screen it was on.
The fork is where somebody makes a permanent, unprovable choice by reading two
lists side by side, so a false claim on one list does not merely mislead: it
pushes the decision toward the branch making it, and here that was the branch
that is **not** anonymous. Copy on that screen is not decoration, it is part of
the mechanism FR-C exists to protect.

Caught by François asking for polish, not by any gate.

**Rule now in force.** FR-D28 and `test/ui/path-claims.test.ts`: the two cards
may not name a capability that is not built, and the planned edit is mentioned
once, below both cards, in the quietest type on the screen. The test is to be
updated in the same change that ships FR-C14 and FR-D12, never before. The
promise was put back and the test failed, naming the requirement.

**Generalised.** A design document is a description of the destination, written
in the present tense. Lifting its words into a build that has not arrived there
ships a claim rather than a plan. When copy comes from a design note, each
sentence needs checking against what runs, and the check is sharpest on any
screen where the reader is about to decide something they cannot undo.

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
| Duplicate `@prisma/client` | `^7.10.0` was installed nested in three packages while the CLI and the generated client were 5.22. Types checked, gates passed, and it would have failed at runtime | Pin the client to the exact version of the generator, in every package that declares it, then `rm -rf node_modules package-lock.json && npm install`. A nested duplicate is invisible to `tsc` |
| `sudo npm` in this project | `sudo` resets `PATH` to `secure_path`, so it ran `/usr/bin/node` v12 instead of the nvm v22, and TypeScript died on its own `??` with `SyntaxError: Unexpected token '?'`. It would then have failed again on the database, because peer authentication makes the socket user `root` | Nothing here needs root: port 3001 is above 1024 and the grants are on your own user. `sudo` is for `service postgresql start` and nothing else. The error names a file nobody wrote, which is why it reads as a broken dependency rather than a wrong shell |
| A comment is not a violation | The frontend boundary test failed on a CSS comment that *explained* the rule it was checking | Strip comments before scanning source for forbidden words |
| Two dev servers, and stale CSS | An edit to `ryc.css` did not reach the browser. The page still had rules deleted a PR earlier, so the screenshot showed unstyled buttons and the change looked broken. Two `vite` processes were running at once, started hours apart | If a change seems not to apply, check the number of dev servers before re-reading the code. `node_modules/.vite` cleared and one server started fixed it. Half an hour went into reasoning about CSS that the browser never saw |
| A screenshot is not a measurement | `--window-size=420` is clamped to the host's minimum window width, so the page lays out wider than the image and every element looks cut off at the right edge. I recorded a phone-overflow defect in `TIMELINE.md` from those images. The app zone had no overflow at all; the public zone had a real one, 910px inside 375px, in a different element entirely. Two rounds of fixes went to the wrong place | Measure the DOM, not the picture: a throwaway page under `apps/web/` with an iframe at the target width, reading `documentElement.scrollWidth` and `getBoundingClientRect().right` per element. It found it in one run, named the element, and gave a pass/fail over 72 page-width combinations |
| A Windows browser cannot be driven from WSL | Headless Edge screenshots work from WSL, but its devtools port binds on the Windows side and the firewall blocks it, so no cookie can be set and no signed-in page can be captured. `pkill` also cannot see Windows processes; `taskkill.exe /F /IM` can | Screenshot what a signed-out visitor sees, and cover the signed-in screens with render tests instead. Do not spend an hour on the transport |

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
- **The local notes file was edited three times** when the instruction was to
  exclude it in `.gitignore`. The mechanism asked for was not the mechanism
  attempted.
- **A private repository was created** after "I'm following your suggestion",
  which referred to tracking and not to visibility. Agreement on one axis is not
  a decision on another.

**Rule now in force.** Never assume, always check. Where a
plausible reading and a stated one differ, the stated one wins, and where the
statement is ambiguous across two axes, ask which one.

---

## 8. Style rules need a mechanical check

Em dashes appeared in fourteen places in memory files and fourteen more in the
local notes **after** the rule forbidding them was set. Three more survived a
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

There are enough entries now to see that most of them are a handful of
mistakes wearing different clothes. This section is the useful part of the document.

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

### The obvious fix for a boundary error is to remove the boundary

The first attributed review submission failed with a permission error:
`studens_platform` holds no INSERT on `ryc.ReviewAttributed`. The immediate
instinct was to add the grant, which takes ten seconds and would have deleted
the third property of the grant matrix, the one saying the platform holds no
rights over a feature module's own data. Nothing would have failed afterwards.
`verify-isolation.sql` asserted that the platform cannot *read* that table and
said nothing about writing it, so the fourteen checks would all still have
passed. An absence is only covered if someone writes the check for it.

The error was not an obstacle, it was the boundary reporting that the design had
a gap: the attributed path spans two roles and the kernel had only one. The fix
was a second role inside the same transaction, not a wider first one.

**The habit that follows**: when a permission error blocks progress, the first
question is what that permission exists to prevent, and the answer belongs in
the commit message. The assertion that the platform cannot write
`ryc.ReviewAttributed` was added at the same time, so the tempting fix now fails
a gate rather than passing quietly. Widening is sometimes right; widening *without saying what
was given up* is how a matrix rots into decoration.

### Standards point outward more easily than inward

Reusing `tdaron`'s unlicensed code was refused, importing the EPL document
without permission was refused, and then whole UCLouvain pages were nearly
committed with a lecturer's name in them. A section was written about that
inconsistency, and the first draft of it leaked two real email addresses.

The pattern is not hypocrisy, it is attention: the standard is loaded when
judging someone else's material and unloaded when handling one's own.
**Consistency needs a checklist rather than good intentions**, which is what the
rule 6 scan is, and it has now caught this twice.

---

## 10. The helper that was right next to the wrong one

`GET /me/institutions` called `identify`, which issues a session when the
development identity is on. `identifyIfAny`, four lines below it in the same
file and documented "for read paths: who is this, or nobody, without starting
anything", is the one it wanted.

The consequence was not an error. Every signed-out page load of the browse
screen created a member, set a cookie, and answered a visitor with somebody
else's stored preference, so the catalogue scoped itself to UCLouvain and
showed 690 programmes of 976 to a person who had never chosen anything. It was
found by reading a screenshot of the signed-out page and asking why it named a
university, not by any test.

Two things this repeats. **A wrong function that succeeds is worse than one
that fails** (`design/catalogue-ingestion.md` 13, on the endpoint that answered
200 with the wrong JSON). And **a route's auth helper is part of its contract**:
the route below it, `/profile`, had the right one, so the two answered the same
question differently and nothing pointed at the disagreement.

What changed: the read paths were checked by hand against a signed-out session,
which is now worth doing after any change to a route that reads member state.
`dev:api:anon` exists for exactly this and had not been used.

---

## 11. A gate that matched the literal and missed the built name

`test/architecture/test-isolation.test.ts` exists because Vitest runs test
files in parallel against one database, and two files seeding the same row both
insert and one fails. It checked literal fixture ids: a zero-filled uuid, a
`ztst` code in quotes.

Three kernel test files generated usernames as `` `ztst.${subject}` ``. Not a
literal, so the gate never saw them, and all three spent months creating
accounts in one shared namespace on a column that is globally unique. Two used
the subject `author` and two used `reporter`. Their cleanup is scoped by
`provider`, so each file tidied its own rows and neither noticed the other.

It stayed invisible until an unrelated change added a test file, which altered
which files overlap, and CI went red on `account.db.test.ts` in a pull request
that did not touch it. That is the exact failure mode the gate was written to
stop, landing on the wrong person, one shape away from the shape it knew.

Two rules were added. A template prefix is a namespace with one owner. And no
generated name may be able to produce another file's literal one, which
`ztst.` plus the subject `one` could have done to `profile.db.test.ts` at any
time. Both were confirmed to fail before being satisfied.

**The pattern.** A gate is written against the form the problem took the first
time. The second form is not caught by more vigilance; it is caught by asking
what else produces the same row, which is a different question from what else
looks like the thing already banned. Compare section 1, "A gate that does not
cover the files it is meant to cover".

---

## 12. The cascade is one document, and the later rule wins

A tab bar in the moderation console marked the current section with a class,
`.console-tab`, and the project's settled "you are here" pill is `.here`. Both
are one class, so they have equal specificity, and `.console-tab` is declared
eight hundred lines further down `shell.css`. Its plain `color` and
`background` therefore beat `.here`, and the current tab rendered exactly like
the other three. The mark was not wrong, it was absent.

This is the second time: `.chips` in a module stylesheet lost its `margin: 0`
to the shell's rule for the same reason, which is why the class was renamed to
`chipset` and why `test/architecture/css-collisions.test.ts` freezes the names
the two stylesheets share.

The collision gate did not apply here, because nothing collided: one file, two
rules, one of them later. The fix is not higher specificity, which starts an
arms race inside one file. It is to stop the base rule competing:
`.console-tab:not(.here)` carries the colours, so the state rule is the only
one declaring them.

**What made it visible** was a screenshot, not reading. The first one showed
the wrong mark, the second showed no mark at all. Reasoning about which rule
wins across eight hundred lines is exactly the thing a picture answers in a
second, and this repeats section 6's rule from the other direction: measure the
document when the question is layout, look at the render when the question is
which rule applied.
