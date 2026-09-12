# Design note: getting the course catalogue

| | |
|---|---|
| Status | **Accepted** 2026-09-10 for the method. Not built. |
| Decision | **Scrape uclouvain.be**, with the whole structure discovered at runtime and nothing hardcoded. |
| Decided by | François, 2026-09-10 |
| Resolves | `requirements.md` OPEN-33 |
| Implements | FR-B9 (the catalogue is a reference module), supports FR-D1 to FR-D4 |
| Raises | OPEN-38, OPEN-45 |

## 0. Decision

There is no UCLouvain API, so the catalogue is built by scraping the public course pages.

The structure is **discovered, not configured**. One root URL yields the faculties, each
faculty yields its programmes, each programme yields its courses. No list of faculties,
programmes or course codes is written into the source. François's requirement, 2026-09-10:
"Things need to be automated as much as possible to avoid hardcoding stuffs. For evolution
purpose, it's a must."

That requirement is the whole design. Everything below serves it.

## 1. Why scraping

Checked on 2026-09-10:

- **No API.** UCLouvain publishes no course or programme endpoint, and no developer portal.
- **Their "Open Data" service is research data**, not the course catalogue. Different thing.
- **The pages are static server-rendered HTML.** No JavaScript application to drive, so a
  plain HTTP fetch and an HTML parse is enough.
- **The pages carry every field the module needs**, verified against
  `uclouvain.be/cours-2025-linfo2145`: ECTS (`5.00 crédits`), code, title, teacher, language
  of instruction, quarter, formal and recommended prerequisites, `Thèmes abordés`, `Contenu`.
- **They also carry the assessment method with weightings**, verified against
  `cours-2025-lepl1503`: "Examen écrit ... (35%), Evaluation du travail de groupe ... (55%),
  Participation ... (5%), Peer-review ... (5%)", including the conditional rule that shifts the
  group-work weight by written-exam score. Plus **official contact hours** (`30.0 h + 30.0 h`).
  This is why FR-D19 scrapes assessment structure instead of asking reviewers for it, which
  removed three fields from the submission form. Note that contact hours are **teaching hours,
  not student effort**: they are a different measurement from FR-D6 and must not be presented
  as the same thing.

PDF versions of programmes also exist (`prog-2025-dati2m.pdf`). Not used: HTML is easier to
parse and carries the same content.

## 2. The chain

Verified end to end on 2026-09-10.

```
  /fr/catalogue-formations/formations-par-faculte-<year>
        |
        |  20 faculty links
        v
  /fr/catalogue-formations/faculte-<year>-<faculty>
        |
        |  programme links
        v
  /prog-<year>-<programme>            (also -programme, -programme_annual_blocks)
        |
        |  course links
        v
  /cours-<year>-<code>                ECTS, title, teachers, language, quarter, prerequisites
```

Base is `https://uclouvain.be`. An `/en-` prefix appears on English variants of course URLs
and is stripped to normalise.

**The 20 faculties, as discovered rather than as a configuration list:** agro, drt, drtb,
educ, epl, espb, espo, fasb, fial, fsm, fsp, ieeb, loci, lsm, mede, phlb, psp, sc, teco,
timb.

Recorded here as an observation, not as input to the code. If UCLouvain adds, merges or
renames a faculty, the crawl finds it. If this list were in the source, it would be wrong
within a year, which is the failure the no-hardcoding rule exists to prevent.

**The chain is a discovery path, not an ownership tree.** **[VERIFIED]** 2026-09-10 from the
EPL reviews document, which is full of `LLSMS`, `MGEST`, `MLSMM`, `LCPME` and `LFSA` codes:
Louvain School of Management, CPME and FSA. EPL students take courses owned by other
faculties, through options and minors.

So **course to faculty is many-to-many**, and reaching a course through EPL's programmes says
nothing about who owns it. Two consequences. The schema must model that relationship as a
join rather than a foreign key. And the launch scoping in section 7 has to mean **courses
reachable from EPL programmes**, not courses owned by EPL, or it excludes exactly the elective
options students are agonising over at PAE time, which is the problem in 1.1.

Worth noting the students' own grouping: their document is organised by **option and minor**,
not by faculty. That is the mental model of someone building a PAE.

**Note on the Saint-Louis faculties.** Five of the twenty (drtb, espb, ieeb, phlb, timb) are
the former Université Saint-Louis Bruxelles. Different campus, different city, arguably a
different student population. Worth knowing before treating "UCLouvain" as one homogeneous
thing, and it interacts with tenancy (1.5 item 1) sooner than the multi-institution vision
does.

## 3. The year in the URL

**[VERIFIED]** François, 2026-09-10.

The URL carries **one** year, and it is the **first** year of the academic year: academic
year *x to y* appears as `x`. So 2025-2026 is `cours-2025-...`. The academic year starts in
mid-September, which means the calendar year and the academic year disagree for roughly three
and a half months every year.

Two rules follow:

1. **Derive the default from the date, not the calendar year.** Before mid-September, the
   current academic year is `x-1`. Using `now().year` naively produces a URL that does not
   exist for a third of the year, and the failure would look like "UCLouvain changed their
   site" rather than "our date arithmetic is wrong".
2. **Probe, do not assume.** Try `x-1`, `x` and `x+1` and use what answers. This also picks
   up next year's catalogue as soon as UCLouvain publishes it, with no code change.

The probe is a **discovery step that runs once and caches its answer**, not a cost paid on
every request or every course.

**This is also where OPEN-32 came from.** UCLouvain itself identifies a course as code plus
year. That was a derivation on 2026-09-10; the URL structure makes it an observation.

### 3.1 Historical years, verified

**[VERIFIED]** by direct request, 2026-09-10. François asked for historical scraping and
doubted it would work. It does.

**Current years are served directly. Older years redirect to an archive portal.**

```
  cours-2026-...  200   served directly
  cours-2025-...  200   served directly
  cours-2024-...  200   served directly
  cours-2023-...  302 -> sites.uclouvain.be/archives-portail/cdc2023/cours-2023-...
  cours-2019-...  301 -> sites.uclouvain.be/archives-portail/cdc2019/cours-2019-...
  cours-2012-...  301 -> sites.uclouvain.be/archives-portail/cdc2012/cours-2012-...
```

So **the ingestion must follow redirects**, and it crosses to a different host to do it.
Verified archive depth is **2012 or earlier**, which comfortably covers the decade of reviews
the EPL document contains.

An archived page still carries the fields we need. `cours-2012-lfsa2995` returns
`10.0 crédits`, `Enseignant`, `Thèmes abordés` and `Langue`.

**`cours-2026-...` already resolves**, which confirms the probe logic in section 3: next
year's catalogue is published before the academic year starts, so `x+1` is not hypothetical.

**Older pages use a different layout, and this is a real constraint.** The 2012 page has no
`Q1` or `Q2` field and is branded "UCL" rather than "UCLouvain", the rebrand having happened
in 2018. One parser will not fit every year. Section 6 requires failing loudly on an
unparsable field, so the reconciliation is that **ECTS is required in every era** (it is
present in 2012) while era-specific fields are permitted to be absent on archived years.
Absent because the era lacks the field is not the same as absent because the parse broke, and
the code has to distinguish the two.

### 3.2 Course codes are not stable across years

**[VERIFIED]** 2026-09-10. This is OPEN-38 with evidence rather than as a worry.

The 404s encountered while probing are **course-specific, not year-specific**:

| Code | Present | Gone by |
|---|---|---|
| `lfsa2995` | 2012 to 2024, continuous | still there |
| `lfsab1101` | 2012 to 2016 | 2019 |
| `lfsab1201` | 2012 to 2016 | 2019 |
| `lingi1113` | 2012 only | 2014 |
| `linfo2145` | 2024 onward | did not exist in 2019 |

The pattern is a visible rename history: `LINGI` became `LINFO`, `LFSAB` became `LEPL`. So a
course's identity across years is **not** its code, and a review of a 2016 `LFSAB1101` cannot
be joined to a 2024 course by code.

**Consequence for the model, and it corrects OPEN-32's first answer.** Two entities, not one:

- **`courses`**, the stable identity a review attaches to.
- **`course_offerings`**, one row per (course, year), holding the ECTS, title, teacher and
  quarter as they were that year.

A review references a course and states the year it concerns. If the offering exists we show
that year's context; if it does not, the review is still kept. This makes historical scraping
**useful but not load bearing**, which is the right shape for content on a third party's
archive host that we do not control.

## 4. Is this allowed

**robots.txt: yes.** Fetched 2026-09-10. A standard Drupal file. It disallows `/admin/`,
`/search/`, `/user/register`, `/user/password`, `/user/login`, `/user/logout`,
`/comment/reply/`, `/node/add/`, `/filter/tips`, `/core/`, `/profiles/`, `/media/oembed` and
various README files. **Neither `/cours-` nor `/prog-` nor `/fr/catalogue-formations/` is
disallowed.**

Note `/search/` **is** disallowed, so the catalogue search interface must not be used as an
entry point. The chain in section 2 avoids it, which is one more reason to prefer it.

There is **no `Crawl-delay`** and no `Sitemap` directive, so politeness is entirely on us.

**Unverified:** the site's terms of use have not been read. robots.txt is a technical signal,
not a licence. Worth reading before the first full crawl, and worth noting that we are
reading published academic information rather than extracting personal data, which is a
better position to be in than the reverse.

### Politeness rules, self-imposed

Because nothing forces them, and because a student project hammering the university's own
website is the fastest way to get blocked and to deserve it:

- One request at a time, with a delay between requests. No parallel fan-out.
- A `User-Agent` naming the project and a contact address, so an administrator who notices
  the traffic can ask us to stop instead of guessing.
- Full crawls run **rarely**: once per academic year is the natural cadence, since that is
  how often the catalogue changes, plus a manual trigger.
- **An on-disk page cache**, on by default (`data/page-cache`, gitignored). This was written
  down here as a politeness rule and then not implemented, and the cost showed up
  immediately: a full crawl of 546 courses was thrown away because the snapshot format
  changed mid-run, so the same pages were fetched twice for nothing. Developing an ingestion
  means re-running it, and without a cache every iteration is another few hundred requests at
  the university's expense. Course pages change roughly once a year, so the default maximum
  age is 30 days. `--no-cache` forces a fresh crawl.

  The cache must never be able to fail a run: a missing or unreadable entry is a miss, and a
  failure to write one is ignored. It is an optimisation, not a dependency.

  The CLI reports both numbers, so the cost of a run is visible: `N requests to uclouvain.be,
  M served from cache`.

## 5. Prior art, and why none of it is used

`github.com/tdaron/epl-opinions`, found via a Discord message from a peer on 2026-04-27,
which described it as a dead personal project whose parsing logic should still work. Read
2026-09-10.

It is the same product idea at the same faculty: "Website to share students opinions about
EPL courses". Created 2025-08-20, last pushed 2025-08-22, then abandoned. That is worth
recording as **evidence the problem in 1.1 is real and felt by other people**, independently
of anything technical.

**Its code cannot be used.** The repository has **no licence** (`license: null` on the GitHub
API), which means all rights are reserved by default. Publishing a link, in Discord or
anywhere else, is publication and not permission; GitHub's terms grant viewing and forking
within GitHub, not use or redistribution outside it. Since Studens is public and MIT,
incorporating unlicensed code would make our own licence statement false and would promise
downstream users rights we do not hold. Attribution does not cure that: a credit is a
courtesy, a licence is permission.

**Facts are not copyrightable**, so what section 2 and section 3 record, meaning which URLs
hold the data and which labels to look for, is legitimately learned from it and from direct
inspection of the site.

**Two things it does that this design deliberately does not.** Both are the reason the code
would be a poor starting point even with a licence.

It hardcodes its targets, six programmes in a literal list, which is exactly the
hardcoding the no-hardcoding rule forbids and would need editing every year and for every
new faculty. And its extraction swallows every error:

```python
def parse_info(self, soup, name):
    try:
        div = soup.find("div", string=lambda t: name in t)
        return div.find_next_sibling("div").text.strip()
    except:
        return None
```

A bare `except` returning `None`. Any layout change yields silent nulls rather than a
failure, so the catalogue would quietly fill with missing data and nobody would know. It also
extracts description, content and teachers but **not ECTS**, which is the field the deferred
workload index needs.

If his code ever becomes worth using, the fix is one message asking him to add a licence
file. Until then, ours is written from scratch, and a credit for the pointer is the honest
form of thanks.

## 6. How this one is built differently

Three properties, each answering a failure above.

**Fail loudly, never silently.** A field that cannot be parsed is an error that fails the
ingestion run for that course, not a `None` written to the database. A catalogue with wrong
data is worse than a catalogue that refused to update, because the first is invisible.

**Validate at the field level.** ECTS must parse as a number, a course code must match the
expected shape, a year must be plausible. Type-correct nonsense is the characteristic output
of a scraper against a changed page.

**Ingest into a snapshot, promote atomically.** A run writes a complete new snapshot and only
replaces the live catalogue if the whole run succeeded and passed validation. A partial or
broken crawl therefore cannot take the site down or empty a course page. This matters
disproportionately because the catalogue is a reference module (FR-B9) that every feature
module reads.

Concretely, the verification obligations:

| Claim | Test |
|---|---|
| Nothing is hardcoded | A test asserts no faculty code, programme code or course code appears as a literal in the ingestion source |
| The chain still works | An integration test runs the full chain against a small fixed subset and fails if any step yields zero results |
| Parse failures are loud | A test feeds deliberately malformed HTML and asserts the run fails rather than storing nulls |
| ECTS is present and numeric | A validation test over an ingested snapshot fails if any course has a missing or non-numeric ECTS |
| Year arithmetic is right | Unit tests at the September boundary, specifically a date before and after the mid-September rollover |
| A broken run cannot corrupt the live catalogue | A test aborts a run mid-way and asserts the live snapshot is unchanged |

## 7. Scrape everything, launch narrow

**[VERIFIED]** François, 2026-09-10, on the scope of the crawl. The launch scoping is a
recommendation, marked **[DERIVED]**, awaiting confirmation.

The crawl covers **all 20 faculties**, because with a discovered chain that costs nothing
extra in code and hardcoding EPL would breach the rule in section 0. UCLouvain has more than
35,000 students across those faculties.

But the **module** launches scoped to EPL. The reason is not technical: thousands of courses
with zero reviews each makes every page look abandoned, and it makes the small-cohort problem
in OPEN-19 worse everywhere at once instead of in one place we can watch. A complete
catalogue with a scoped module gives the honest version of both, and widening is a
configuration change rather than a migration.

## 8. What the first live runs taught

**[VERIFIED]** by running it, 2026-09-10. Four things the design did not anticipate, three
of which were bugs that only a live run could find.

**Href forms are not consistent, and this was a real bug.** The faculty index links
`/prog-2025-fsa1ba` with a leading slash. A programme listing links
`cours-2025-lepl1101` **without one**. A link pattern requiring the slash finds 43 programmes
and then zero courses, so the crawl walks the whole chain and fails at the last step with
nothing to show.

The lesson is about the test rather than the code: the fake site in `test/catalogue` used the
tidy form for everything, so the suite passed while reality failed. It now serves **both**
forms deliberately, and a test says why.

**A programme's landing page carries no course list.** `prog-2025-sinf1ba` yields zero course
links. The listing lives on a suffix, and which suffix depends on the level:

| Suffix | sinf1ba (bachelor) | info2m (master) |
|---|---|---|
| `-programme` | 46 courses | 85 courses |
| `-programme_annual_blocks` | 46 courses | **0** |

So `-programme` is tried first and `-programme_annual_blocks` is the bachelor-era fallback.
These are URL grammar rather than an entity list: see the note on the constant in `urls.ts`.

**The scale, measured.** EPL alone reaches **546 distinct courses** across 43 programmes. That
is the catalogue for one faculty of twenty, which puts the "scrape all, launch EPL" decision
in section 7 on a real number.

**Sampling has to spread, not take the head.** A `--max 60` run returned sixty `ENANO`
courses, one alphabetical neighbourhood, and every labelled field came back empty. That
looked exactly like a parser failure and was not. `maxOfferings` now samples across the
discovered list, and a spread sample of 40 gives 22 different code prefixes with 31 fully
populated.

#### 8.2 Browsing needed data the crawl was discarding

**[VERIFIED]** 2026-09-10, on adding FR-D24.

The crawl walks faculty, then programme, then course. To record how a course was reached it
kept `{code, faculty}` and **threw the programme away**, keeping only the faculty of the
programme it came from.

That made browsing by programme impossible from the snapshot, and the loss was invisible
precisely because the faculty was still there: nothing looked missing. The schema had the same
hole from the other end, holding `Programme` and `CourseOffering` with nothing joining them,
even though the crawl had walked exactly that relationship to find the courses.

Fixed in snapshot version 3, which also keeps programme titles from the faculty index link
text, and by a `ProgrammeOffering` join table. The general lesson: a crawl that discards a
relationship it traversed is the easiest kind of data loss to miss, because the result still
looks complete.

## 8.1 The catalogue contains courses taught at other institutions

The genuine discovery, and it is a modelling fact rather than a bug.

`cours-2025-enano2401` carries exactly three labelled fields: **Institution de référence**
(Université de Namur), the course's **code at that institution**, and the **UCLouvain faculty
in charge**. No teachers, no assessment, no content, because UCLouvain does not own the
course. Returning `null` for those is correct, and the "absent by era" machinery in
`errors.ts` turns out to serve a second purpose it was not designed for: absent because
another university owns it.

Two consequences. A review of such a course is a review of a course **at Namur**, which is not
what any requirement currently says. And it arrives before the multi-institution vision does,
inside what looked like a single-tenant v1. Recorded as **OPEN-45**.

A related confirmation from the same run: `LACTU2170` is reached through EPL programmes and
owned by **LSBA**. Section 2's many-to-many claim, verified with real data rather than
inferred from a students' document.

## 8.2 The long fields are lists, and were being stored as one line

Found 2026-09-10, on a course page François was reading.

`Modes d'évaluation`, `Thèmes abordés` and `Contenu` were scraped with
`.text()`, which threw away every list, line break and heading the source had.
A field of two thousand characters rendered as one unbroken paragraph. The
parser tests did not notice, because they assert that the weightings appear in
the assessment text, and they did.

**Measured before deciding anything**, across the 546 cached course pages and
the 1,390 values of those three fields:

| tag | count | | tag | count |
|---|---|---|---|---|
| `li` | 4040 | | `i` | 109 |
| `br` | 3988 | | `ol` | 81 |
| `ul` | 818 | | `u` | 57 |
| `strong` | 523 | | `code` | 45 |
| `div` | 262 | | `table` | 10 |

List nesting: 3,857 items at depth 1, 176 at depth 2, 7 at depth 3.

So the model needs lists ordered and unordered, nested three deep, line breaks,
inline emphasis, headings and tables, and nothing else. That is what
`parse/rich.ts` produces.

**Two bullet conventions are both in heavy use.** Some authors use
`<ul><li>`; others type `- ` at the start of a line and separate lines with
`<br />`. Real markup is honoured as markup. The typed convention is promoted
to a list only for a **run of two or more consecutive marked lines**, so a
single line opening with a hyphen stays a line: at a run of one, a dash and a
bullet are indistinguishable and the dash is more likely.

**Structure is preserved, never invented.** 106 of the fields are still a
single long line after this change, and that is correct: their authors wrote
one paragraph, with no break in the source. Adding breaks there would be
fabricating a structure nobody wrote.

**Stored as `jsonb`, not text** (`20260910230000_structured_course_prose`).
Nothing queries inside these columns, so jsonb costs nothing, and the old text
was discarded rather than converted: it is derived data, rebuilt from the page
cache in seconds, and a converted value would be the flattened text wrapped in
a block, which is the thing being fixed.

**No markup reaches the browser** (FR-D27). The parser converts the source's
HTML into a closed set of shapes and the client builds its own elements from
them, so there is no stored HTML, no sanitiser and no `dangerouslySetInnerHTML`
in the path. Link destinations are dropped and the link text kept: four `<a>`
tags in 1,390 fields do not justify carrying an outbound redirect we do not
control.

## 8.3 Proposed resolution of OPEN-45, and a heuristic that is wrong

Prepared 2026-09-12, for François's decision. Status: **Proposed**.

### The page says it; we were guessing

`external` is currently inferred:

```ts
external: o.teachers.length === 0 && o.assessment === null
```

That is the shape the catalogue note warns about elsewhere, in reverse: it
cannot tell "absent because another institution owns it" from "absent because
this page is sparse". **Measured across the 546 loaded offerings on 2026-09-12:
66 are flagged external, and 4 of them are not.**

| Code | Why it is flagged | What it actually is |
|---|---|---|
| `linfo1222` | no teachers, no assessment row | A UCLouvain course. It has themes, prerequisites, contact hours and a faculty. Its page simply carries no assessment row |
| `lsinc1241` | same | A UCLouvain course, with themes and content |
| `lbnen2003`, `lbnen2011` | same | UCLouvain courses taught **at the Mol nuclear research centre**, which is a third category again |

A 6% false positive rate would not matter if nothing depended on the flag. It
matters the moment behaviour hangs off it, which is what OPEN-45 is about.

The pages carry the answer explicitly. From `cours-2025-enano2401`:

```
Institution de référence            > Université de Namur
Code de l'UE dans l'institution     > NANOM306
Faculté ou entité en charge (UCLouvain) > EPL
```

Two labelled fields we do not parse: the owning institution, and the course's
code **at that institution**. The ENANO pages also lack the `Enseignants`
template marker entirely, so they are a different template rather than a sparse
instance of the same one.

### Proposed

1. **Parse the two fields instead of inferring.** `external` becomes "the page
   names a reference institution", which is a fact the page states, not an
   inference from absence. The four false positives disappear by construction.
2. **Keep them in the catalogue.** They are genuinely reachable from a UCLouvain
   programme and a student choosing one needs to see it. Dropping them would
   hide part of their own programme.
3. **Show them, link out, and refuse contributions on them for now.** With the
   reason stated: the institution is not supported yet.
4. **Do not stamp them with UCLouvain's tenant.** FR-C19 derives an anonymous
   contribution's tenant from the target, never the author. A Namur course
   belongs to Namur, and forcing UCLouvain on it because the reader arrived
   through an EPL programme is deriving tenancy from the author by the back
   door. Refusing the contribution avoids having to answer a question the
   tenancy model cannot answer yet.

### Costs, stated

A student who really did take ENANO2401 cannot share what they know, and that is
62 courses' worth of silence. Accepted because the alternative is writing rows
whose tenant is wrong, and an anonymous row cannot be corrected afterwards
(FR-C9). This is the same trade as everywhere else in FR-C: a permanent record
demands getting it right before writing, not after.

`lbnen2003` and `lbnen2011` also show that "taught elsewhere" and "owned
elsewhere" are different things. Under the proposal they are UCLouvain courses
and fully reviewable, which is right: UCLouvain owns them, the teaching happens
at Mol.

### What would change it

The second institution's catalogue being ingested. Then those 62 courses flip
from read-only to reviewable, with the correct tenant, and nothing else in the
design changes. That is the test of whether this resolution is the right shape:
it should cost one migration and no rethinking.

## 9. Open questions raised here

- **[OPEN-38]** How are courses reconciled **across years** when the code or title changes?
  A renamed course, a merged course, or a code change breaks the year-over-year link that
  FR-D4 and the deferred trendline depend on. This is fuzzy matching rather than parsing, and
  it is the one place in this document where a model would genuinely earn its place. Not
  needed until there are two years of data.
