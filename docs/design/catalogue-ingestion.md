# Design note: getting the course catalogue

| | |
|---|---|
| Status | **Accepted** 2026-09-10 for the method. Built for one faculty; see section 10 for what the catalogue actually contains. |
| Decision | **Scrape uclouvain.be**, with the whole structure discovered at runtime and nothing hardcoded. |
| Decided by | François, 2026-09-10 |
| Resolves | `requirements.md` OPEN-33 |
| Implements | FR-B9 (the catalogue is a reference module), supports FR-D1 to FR-D4 |
| Raises | OPEN-38, OPEN-45 |
| Explored | 2026-09-16, section 10: the search application, the eight sites, and the taxonomy. |
| Extended | 2026-09-16, section 11: the second source is read, reconciled and stored. Snapshot format 5. |

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
file. Until then, ours is written from scratch, and a credit for the pointer is the correct
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
catalogue with a scoped module gives the true version of both, and widening is a
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
`packages/ref/src/ingestion/parse/rich.ts` produces.

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

## 8.3 OPEN-45 resolved, and a heuristic that was wrong

**Decided 2026-09-13 by François**, and not as recommended. The mechanics below
were accepted in full; the policy was not, and the difference is recorded in the
section that follows rather than quietly edited away.

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

### Decided

1. **Parse the two fields instead of inferring.** Accepted. `external` becomes "the page
   names a reference institution", which is a fact the page states, not an
   inference from absence. The four false positives disappear by construction.
2. **Keep them in the catalogue.** They are genuinely reachable from a UCLouvain
   programme and a student choosing one needs to see it. Dropping them would
   hide part of their own programme.
3. **They are contributable**, which is where the decision differs from the
   recommendation. I proposed showing them read-only until the owning
   institution's catalogue was ingested.
4. **The tenant is the owning institution**, seeded for the purpose. That is
   FR-C19 applied rather than excepted: a Namur course belongs to Namur.
   Stamping UCLouvain on it because the reader arrived through an EPL programme
   would derive tenancy from the author's route, which is the thing FR-C19
   forbids, and that option was rejected by everyone.

**Why the recommendation lost, recorded because it should be.** Section 1.5 of
the requirements lists tenancy among the few decisions that are cheap now and
expensive later. Exercising it while there are 62 courses and no live users is
cheaper than exercising it when there are two institutions and traffic. Deferring
would have meant building the same thing later against a live database.

### Costs of the decision taken, stated

**v1 was scoped to UCLouvain** (OPEN-14) and this makes the tenant model live
earlier than that implies. Not a contradiction, since the members are still
UCLouvain students, but the scope sentence now needs reading carefully.

**The course record behind such a contribution is thin.** UCLouvain publishes
only the reference: no assessment, no teachers, no themes. So FR-D19's promise,
that the catalogue answers everything a reviewer is not asked, holds much more
weakly on these 62 than on the other 484, and the page should say so rather than
look merely empty.

**The official link points at the wrong place.** Every course page links to the
record that governs it, and for these that is Namur's, whose URL grammar we do
not know: we hold the foreign course code and nothing else. Until that is
solved, the link goes to UCLouvain's stub, which is the reference and not the
record. That is a smaller problem than it sounds and a real one to fix.

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

## 10. A second source: the catalogue search application

Explored 2026-09-16, after François pointed out that the product was calling UCLouvain a
Louvain-la-Neuve institution. Everything in this section was fetched and counted on that
date, against the 2025-2026 year. **Section 11 is what was then built from it.**

### 10.1 UCLouvain is eight campuses, and the numbers are not marginal

Their own catalogue page opens with it: *"L'UCLouvain est une université multisite !
Louvain-la-Neuve, Bruxelles Saint-Louis, Bruxelles Woluwe, Bruxelles Saint-Gilles, Mons,
Tournai, Namur et Charleroi : huit campus"*.

Counted from `/en/study-programme/programmes-per-faculty-in-2025`, 692 programmes:

| Site | Programmes |
|---|---|
| Louvain-la-Neuve | 424 |
| Bruxelles Woluwe | 108 |
| Autre site | 59 |
| Bruxelles Saint-Louis | 46 |
| Mons | 37 |
| Charleroi | 12 |
| Tournai | 4 |
| Bruxelles Saint-Gilles | 2 |

**268 of 692, or 39%, are taught outside Louvain-la-Neuve.** The site is not a detail about
where a building is, it distinguishes two programmes that are otherwise the same thing:
`sinc1ba` and `sinf1ba` are both "Bachelier en sciences informatiques", one in Charleroi and
one in Louvain-la-Neuve. Today the only thing separating them in our data is a parenthesis
inside a title string.

Note the discrepancy, which is not resolved: the prose names **Namur** among the eight, the
search application's site filter does not list it, and there is no `formations-namur-<year>`
page beside the seven that exist. Do not assume it is an oversight in either direction.

### 10.2 There is a second catalogue application, and it holds the taxonomy

`catalogue-formations.uclouvain.be` is a separate application from the `uclouvain.be` pages
section 2 walks. It is server-rendered HTML driven by GET parameters, and a plain GET needs
no CSRF token even though the form carries one for POST.

```
https://catalogue-formations.uclouvain.be/fr/search
  ?form[document_type]=Training        # or LearningUnit
  &form[academic_year]=2025
  &form[faculty]=18
  &form[submit]=
```

Its form fields are UCLouvain's own vocabulary, which is the reason this matters. Sizes as
listed on 2026-09-16:

| Field | Values | What it is |
|---|---|---|
| `document_type` | 2 | `Training` (programme) or `LearningUnit` (course) |
| `academic_year` | 6 | 2021 to 2026, and **2026/2027 is already live** |
| `teaching_campus` / `campus` | 9 | the 8 sites plus "Autre site" |
| `faculty` | 21 programmes, 22 courses | full names, Saint-Louis faculties included |
| `decreeDomain` | 24 | the field of study, by decree |
| `educationGroup` | 7 | bachelier, master, master en enseignement, master de spécialisation, agrégation, certificats |
| `language` | 3 programmes, 11 courses | the teaching language |
| `quadrimester` | 6 | Q1, Q2, Q1 and Q2, Q1 or Q2, Q3 |
| `schedule_type` | 4 | horaire de jour, décalé, adapté |

Each result row carries, in one place, the link to the `prog-<year>-<code>` or
`cours-<year>-<code>` page we already parse, the title, the site, the domain, the language,
the quadrimester or schedule, and the organising faculty with its short code.

**This is the only place the site appears as data.** The programme page itself does not state
it: `prog-2025-cyse2m` carries the faculty's postal address in Louvain-la-Neuve while the
programme's site is "Autre site". The per-faculty index appends the site to the title in
parentheses, in French and in English alike, 692 of 692 rows, which is what
`packages/ryc-ui/src/filters.ts` parses today. The search application does the opposite: it
strips the parenthesis from the title and gives the site as a field.

### 10.3 Two limits, both measured

**The unfiltered course search fails.** `document_type=LearningUnit` with no faculty returned
**HTTP 504 after 50 seconds**. It was not retried. Any ingestion has to partition the course
query, by faculty or by site. Per faculty it is comfortable: EPL returns 411 courses on one
page, with the count printed in the markup.

**Neither source is complete.** The search returns **605** programmes for 2025 and excludes
minors and doctorates. The per-faculty index returns **692**, including **62 minors**, 203
certificates, 46 attestations, 12 additional-year programmes and 6 microcertifications.
A minor is exactly the kind of thing a student is choosing at PAE time, so the index cannot
be dropped in favour of the tidier source.

The two therefore have to be reconciled rather than one chosen, and where they disagree the
disagreement is information: the same rule section 8 already applies to fields that are
absent because an archived year lacks them rather than because a parse broke.

### 10.4 What this means for the model

The catalogue currently holds `Institution` and `Faculty`, and a programme with a code, a
year and a title. Site, field of study and level exist only as substrings of that title, or
not at all. Three dimensions UCLouvain publishes as data, we store as prose and re-derive
with a regular expression.

That is the change this section argues for and does not make: a **site** belongs to an
institution and a programme is taught at one; a **level** and a **domain** are fields on a
programme. All three are catalogue facts, so they live in `ref` with the rest of them.

It is cheap now and expensive later, which is the test `requirements.md` 1.5 sets for
deciding early. It also removes the one genuinely fragile thing in the browse screen: the
site filter shipped in phase 26 works by reading the last parenthesised group of a title,
and it is one upstream rewording away from silently filtering nothing.

### 10.5 Scale, stated before anybody starts

Today: 1 faculty, 43 programmes, 550 courses. The catalogue: 21 faculties, 692 programmes,
411 courses in EPL alone. Widening beyond EPL is not the same crawl with a bigger number, it
is roughly an order of magnitude more requests, so section 4's politeness rules and the page
cache stop being a courtesy and become the thing that makes the run possible at all.

## 11. Two sources, reconciled

Built 2026-09-16, from section 10. Snapshot format **5**.

### 11.1 Which source decides what

**The index decides which programmes exist.** It lists the 62 minors and the doctorates the
search drops, and a minor is exactly the thing somebody is choosing at PAE time.

**The search decides what they are.** It publishes as fields what the index only implies
inside a title: the site, and the field of study that appears nowhere else at all.

One request covers a whole year, so the search is fetched once per crawl and not once per
faculty. The COURSE search would have to be split by faculty, because unfiltered it answers
HTTP 504; that is not built, since courses are still reached through programmes.

`crawl.ts` carries the budget in a test: 1 index + 1 search + one page per faculty + the
programme listings + the courses. The number is asserted so that growth is deliberate.

### 11.2 What happens when they disagree

The site is taken from the search, because a published field beats a parse of a name. The
losing value is **kept, not discarded**: every disagreement is recorded in the snapshot with
both values, the same rule this document already applies to a field missing from an archived
year. Averaging them away would destroy the evidence that UCLouvain states one fact in two
places.

Measured on EPL 2025-2026: **27 of 43 programmes matched the search, 16 were not covered,
and zero disagreed**. So the title heuristic and the published field agree everywhere both
exist, today. `siteSource` records which one each programme's site came from, so a later
reader can see how much of the catalogue rests on the weaker source rather than guessing.

The 16 are the minors, the tracks and the specialisation paths. They keep a site from their
title and have **no field of study at all**, because the only source that publishes one does
not cover them. That is a null meaning "not stated", never "none".

### 11.3 Stored, not re-derived

Site, kind and credits used to be parsed out of the title on every read. They are columns
now, written once at ingestion, and `read.ts` no longer derives them. Two places computing
one fact is how the two come to disagree, and the database could not be asked for "the
masters taught in Charleroi" while the answer lived inside a string.

`ref.Site` belongs to an institution. `ref.Domain` does not: the French Community's decree
defines the vocabulary, so the same 24 appear across its universities, and a copy per
institution would make "every law programme in Belgium" a join across duplicated rows. Both
are upserted on a slug of the published name, so a re-crawl lands on the same row.

### 11.4 The cache can hold a page from before the catalogue was published

Found by running the ingestion, not by reasoning about it.

A run with no `--year` resolved to 2026 and failed with "no matching links found" on the EPL
faculty page. The live page had 42 programme links at that moment. The cached copy, fetched
at 16:07 the same day, had none: UCLouvain published the 2026-2027 programmes during the
day, and the cache was correctly serving what it had fetched that morning.

So a cache entry is only as fresh as the moment the catalogue was published, and the 30-day
default is far longer than the window in which a year goes live. Dropping the four stale
entries was enough; `--no-cache` is the general answer. Confirmed afterwards: 2026-2027 is
live, with 42 EPL programmes and 597 across the year.

This is worth knowing every September, which is exactly when somebody will run this.

## 12. Widening beyond one faculty

Built 2026-09-16. Snapshot format **6**. Everything below was measured, and the
three failures were found by running the crawl rather than by reading it.

### 12.1 What a full crawl costs

| | Requests | Wall clock at 700 ms |
|---|---|---|
| One faculty (EPL) | about 600 | 7 minutes |
| Two (EPL and LSM), 969 courses | about 1,050 | 12 minutes |
| All 21, about 692 programmes | **about 9,000** | **close to two hours** |

Once per academic year, and cheap after that: the second run of the same two
faculties made **42 requests and served 1,032 from cache**.

Two guards make the difference deliberate rather than accidental.
`--max-requests` is a ceiling that stops the run, because the way to find out a
crawl is fifteen times larger than intended should not be a two-hour silence.
And the run now says what the rest of it will cost, before spending it, and
prints progress every 250 course pages.

**The full 21-faculty crawl has not been run.** It is a real cost to somebody
else's server, and it is a decision rather than a step.

### 12.2 Three ways a crawl of one faculty lies about a crawl of twenty

**A field UCLouvain publishes empty.** `cours-2025-lcems2066` carries the
evaluation label with a literal `<div></div>` under it. The parser treated a
label with an empty value as proof the layout had changed and failed the run, so
the second faculty ever crawled could not be ingested at all. Published and
empty is a third state, and it is an absence. What the rule was guarding, a
selector that silently stops matching, is now checked where the evidence is: a
field empty on EVERY offering fails the snapshot, and the threshold is measured,
since the least populated field in a real 546-course crawl is filled on 84%.

**A server having a bad minute.** `cours-2025-lcems2341` answered 503 three
times and then 200, the first attempt taking ten seconds. Transient answers are
retried now, with a growing wait and `Retry-After` honoured when sent, and every
attempt counts against the budget because every attempt is work the university
did. The first version of that retry looked only at HTTP statuses and let a
`TimeoutError` straight through, which ended a run of 969 after 750 had been
read: a timeout carries no status, and a failure with no status is a failure of
the connection, which is the most retryable thing there is.

**A page the university cannot serve at all.** `cours-2025-mlsmm2219` answered
503 on every attempt for several minutes while its 2024 edition was served
normally. A crawl of nine thousand pages meets several, so ending the run over
one means the catalogue can never be updated again.

The line drawn, and it is the important sentence in this section: **a page we
could not GET is tolerated, a page we could not UNDERSTAND is not.** One is a
course missing, the other is a course wrong, and section 6 refuses the second.
Unavailable courses are listed in the snapshot and printed. Above 1% of the run,
with a floor of 5, the run fails instead: a handful of broken pages is the
catalogue, a wave of them is us being blocked.

### 12.3 The faculty stops being a gate

Browsing asked for a faculty before showing anything. That works with one and
fails with twenty-one: somebody looking for a minor does not know which faculty
owns it, and not knowing yet is what browsing is for. UCLouvain's own catalogue
does not ask either.

Every programme of the year is listed, and the faculty joins the kind, the site
and the field of study as something to narrow by. A programme row states its
site as a fact rather than leaving it inside its name, and the published title
is de-duplicated against it: "Bachelier en sciences de gestion (Mons)" beside a
Mons chip says the same word twice, so the exact match is dropped and nothing
else ever is.

Filters appear only when there is more than one value to choose between, so a
single-faculty catalogue looks exactly as it did.

### 12.4 Knowing whether the catalogue is complete

A full crawl loses things one at a time, and each loss is small enough to scroll
past: one course page the server would not serve, one programme whose course
list never loaded. Each one is a student who looks for their course and does not
find it, months later, with nothing to point at.

`npm run catalogue:report` reads the snapshot and the database, compares them,
and ends with one line. It changes nothing and exits 1 when something is
missing, so it can gate a deployment without being read.

**"No courses" used to mean two different things and said neither.** In the
first two-faculty crawl, 22 of 79 programmes had no courses. That is either a
joint programme whose courses are hosted by the partner institution, which is
ordinary, or a page that failed to load, which means every one of its courses is
absent from Studens. Telling them apart meant opening the site by hand, and it
does not scale to 692. A programme now records which it was:

| | Meaning | Severity |
|---|---|---|
| `listed` | the course list was read | |
| `empty` | a page loaded and had nothing on it | note |
| `unreachable` | no listing page loaded at all | **gap** |

Checked on the real two-faculty crawl: all 22 are `empty`, none `unreachable`,
and `prog-2025-cyse2m` is one of them, with three pages that are genuinely
blank. The report also compares both directions against the database, because a
course parsed into the snapshot and missing from `ref.CourseOffering` is the
same invisible loss arriving one step later.

### 12.5 The search application's own count is not a target

Measured 2026-09-16, on `document_type=Training&academic_year=2026`:

| Query | "Nombre de résultats" | Rows on the page |
|---|---|---|
| Every site | 939 | 597 |
| Louvain-la-Neuve only | 565 | 337 |
| Louvain-la-Neuve, bacheliers only | 34 | 34 |
| Louvain-la-Neuve, certificats only | 147 | 147 |

Filtered to one education group the two agree exactly. Asked for "toutes les
formations" they do not, and the gap is not a rounding error: the rendered page
holds five sections (bacheliers, masters, masters en enseignement, masters de
spécialisation, certificats) which sum to exactly the rows shown, while the
counter also counts documents that have no section to render into. Doctorates
and continuing education have their own catalogues and their own pages.

There is no pagination and no "show more": every row the page has is in the
response, and every code on it is unique.

**So the counter is not a coverage target.** Anybody comparing our programme
count against the number printed on that screen will conclude a third of the
catalogue is missing, and be wrong. Coverage comes from the per-faculty index,
which is the source that lists minors too; the search supplies dimensions for
the programmes it does cover and nothing else. Section 11.1.

### 12.6 A course can be worth zero credits

Found on the first full crawl, 2026-09-16, which stopped after 250 of 6,654
course pages.

`cours-2026-bmeta1000` publishes **"0.00 crédits"** beside "18.0 h" and "Q2". It
is a taught course whose credits are counted somewhere other than on it, and the
parser refused the value as implausible, which ended the run.

Zero is now accepted. **What still fails is a page with no credits cell at all**,
which is the check that catches a layout change, so allowing zero cannot let a
missing value through disguised as one. The upper bound stays: 120 credits is a
master's year, not a course. And the snapshot refuses a run where EVERY offering
is zero, on the same reasoning as a field empty everywhere: one is a course, all
of them is a parser that stopped reading the header.

This is the third time the same mistake has been made in this file, and it is
worth naming as a pattern rather than as three bugs. A field published empty, a
page the university cannot serve, and now a value that looks wrong and is not:
each time the parser treated something UCLouvain actually publishes as proof
that the parser was broken. **The place to notice a broken parser is across the
whole run, never on one page**, because a real catalogue is full of individually
surprising entries and a broken parser is uniform.

### 12.7 One real find, and one false alarm of my own making

Both came from checking all 6,654 discovered course codes out of the page cache
on 2026-09-16, before the crawl reached them.

**Real: ten course codes have five digits.** The validator allowed three or
four, so the snapshot would have been refused at promote time, after the entire
run. Measured across the whole year:

| Shape | Count | | Shape | Count |
|---|---|---|---|---|
| `AAAAA9999` | 5408 | | `AAAAA9999A` | 164 |
| `AAAA9999` | 978 | | `AAAA9999A` | 85 |
| `AAAAA99999` | **10** | | `AAA9999` | 8 |

The ten are the `wbcmm21021` family of clinical biology seminars. The pattern
now allows five digits and stays strict otherwise, because it is the only guard
against reading something that is not a course code at all.

**False: "ten courses publish no credits".** They publish credits like every
other course. `cours-2026-wbcmm21021` is worth 2 ECTS, and the parser had always
read it correctly. The mistake was in the check, not the catalogue: I searched
the RAW HTML for the word "crédit", and the page writes it `cr&eacute;dits`, so
the search found nothing on a page that says it plainly. The parser uses
cheerio, which decodes entities, and never had the problem.

**The rule that follows, and it is worth more than the bug.** Verify against the
representation the code actually sees. A raw-HTML grep answers a different
question from the parser's own view of the page, and the two disagree on
entities, on whitespace, on attribute order and on anything a browser normalises.
Every claim in this document that came from a grep over stored HTML should be
read with that in mind, and the measurements above were re-taken through the
parser.

Checked that way across 1,800 cached course pages: **none lacks credits**, and
five state `0.00`, which is the `bmeta` family from 12.6.

### 12.8 A missing field must never cost the course

No course currently lacks credits, and the column is nullable anyway. That is a
decision about what the catalogue is, taken by François after the first answer
to 12.7 was to skip such courses:

> "instead of suppressing those course or not considering them, we should accept
> them and just find a way to state that those field are not mentionned in the
> official course page. Losing all the infos just for some fields? ... We know we
> don't have access to administration data directly, so we accept the gap and
> manage ourselves accordingly."

**The requirement it serves:** the catalogue is scraped from a source nobody here
controls, so a field the source omits is an ordinary state to record, and a
course carries thirty or so fields that a student came to read. Dropping all of
them over one absent field inverts the value of the exercise.

**Alternatives rejected:** skipping the course, which loses everything else and
makes the student's search fail; storing zero, which states as fact something the
university did not say, and collides with the `bmeta` courses where zero is real.

**The cost accepted:** `ects` is nullable through the whole stack, so every
reader handles the null, and a course with no credits cannot be filtered by
credits. The interface says "credits not stated" rather than showing a number.

**What would change it:** nothing observed so far, since no course has needed it.
It is there because the next unfetched page might, and because three crawls have
already been stopped by the parser calling something real impossible.

The guard that used to justify refusing such a page now lives in the snapshot,
where the evidence is: a run in which NOT ONE offering states its credits is a
parser that stopped reading the header, and that is only visible across a whole
run.

### 12.9 The course namespace also holds bundles

Found on the fourth attempt at the full crawl, which stopped at 5,000 pages of
6,654.

`cours-2026-mcomu1000` is titled **"Cours du bachelier en technologies
numériques pour l'information et la communication"** and is worth **180
credits**. It is not a course, it is a whole three year bachelor published as one
entry in the course namespace, organised by SESP.

The ceiling was 120, on the reasoning that a master's year is 120 credits and a
course cannot be more. Measured instead of reasoned, over 6,028 cached pages of
2026-2027:

| Credits | Entries |
|---|---|
| 0 to 15 | 5,885 |
| 16 to 30 | 142 |
| 31 to 120 | **0** |
| 180 | 1 |

So the old ceiling protected nothing in the range it covered. It is 360 now, the
size of a six year medicine programme, which is the largest a bundle could
plausibly stand for. The real guard against reading the wrong number was never
the ceiling: the pattern requires `cr` immediately after the digits, so a year
or a room number cannot be read as credits.

**What this means for the product, and it is not a parsing question.** A bundle
entry will appear in RYC as a course worth 180 credits that somebody could
review. It is harmless today and it is not what a student is looking for when
they browse a programme. Whether such entries should be hidden, labelled, or
left alone is a decision for when somebody sees one on screen.

**Four stops, one cause.** Every one of the four failures of the full crawl was
the parser calling something real impossible: an evaluation field published
empty, a course worth zero credits, a page the university could not serve, and
now an entry too large to be a course. A catalogue of 6,654 entries maintained
by hundreds of people contains more shapes than anybody designing a parser
imagines, and the cost of each discovery was roughly twelve minutes of crawl.
The bounds that survived are the ones measured against the whole set rather than
argued from what a course ought to be.

### 12.10 The load failed on the same entry, one layer down

The crawl finished: 20 faculties, 692 programme rows, 6,654 courses, nothing
unavailable, no disagreement between the sources. Then `db:load` refused all of
it with `numeric field overflow`.

`ects` was `numeric(4, 2)`, which holds at most 99.99, and
`cours-2026-mcomu1000` is the 180 credit bundle from 12.9. The column accepted
6,653 courses and rejected one, and a load is a single transaction, so 78
minutes of crawling landed nowhere.

The column is `numeric(5, 2)` now, sized to the parser's own ceiling of 360.
**The lesson is that a bound has to be widened everywhere it exists**, and this
one existed in two places written months apart: a regular expression in the
parser and a column type in a migration. Fixing the first left the second to be
discovered by the only thing that exercises it, which is a real load of real
data.

### 12.11 One programme belongs to three faculties

The report printed "692 programmes found" above "690 in the database" and said
nothing about the difference, which is precisely the silent gap it exists to
refuse.

Nothing was lost. `baba1ba`, the bachelor in biology, anthropology and
archaeology, is listed under **espo, fial and sc**. The snapshot holds one row
per faculty a programme was discovered under, and the database keys programmes
by code, so three rows become one.

The report now says so, and names the programme. It also flags the real version
of that difference as a gap: a programme in the snapshot and absent from the
database means every course reachable only through it cannot be browsed to.

**What is left undecided, and deliberately.** `Programme.facultyId` is singular,
so the stored faculty for `baba1ba` is whichever was written last, which is
arbitrary. Section 2 of this document already says faculty is a discovery path
rather than ownership, and that course to faculty is many to many; the same is
evidently true of programmes, and the schema does not model it. One programme in
692 is not a reason to change a foreign key today, and it is a reason to write
down that the value is arbitrary rather than let somebody trust it.

### 12.12 A programme with no course list is still a programme

The full crawl put 690 programmes in the database and the screen showed 443.
`read.ts` dropped every programme with no courses, on both the snapshot and the
database path, and had done since browsing was built.

That is 247 programmes, 218 of them continuing education certificates, the rest
joint programmes whose courses are hosted by a partner institution. A student
searching for one concluded it did not exist, and the catalogue was quietly
smaller than the one it copies.

**They are listed now**, marked "no course list", and opening one says what the
institution publishes and does not, and links to its official page. The filter
that was hiding them is gone; the `kind` facet is what keeps 218 certificates
out of view for somebody browsing for a bachelor, and that is a choice the
reader makes rather than one made for them.

The reason is NOT guessed per programme. We know the course list is absent and
we do not know which of the two causes applies to a given one, so the text names
both and claims neither.

**Why the filter existed, and what replaced it.** Clicking such a programme used
to give an empty list, which is a dead end. The answer to a dead end is to say
where the information is, not to hide the door.
### 12.13 A course the institution stopped offering

The reader looked for an offering in the CURRENT year only. After the 2026-2027
crawl that left **61 courses unreachable**: they exist, they carry the
description UCLouvain last published, and neither the page nor search would open
them.

FR-D16 says a review states its own year and survives a missing offering. It
cannot, if the page it lives on has gone: the review sits in the database and
nobody can read it. Course identity outliving a yearly offering is the whole
reason those are two tables, and `LINGI` becoming `LINFO` is the case the
project instructions already warn about.

A course now falls back to its most recent offering, carries `offeredThisYear`,
and says so on screen before any of the facts below it, because all of them are
last year's. Search includes such courses, collapsed to one row each so a course
offered for ten years does not fill the results with itself.

No review is orphaned today: all 11 in the database are on courses still offered
in 2026-2027. That is luck. Next September's crawl will retire another set.

### 12.14 What the browser crash under 12.13 was really about

Chasing 12.13 on screen, the search box crashed the whole page with
`ReferenceError: process is not defined`.

`packages/i18n` warned about a missing translation key by reading
`process.env["NODE_ENV"]`. **`process` does not exist in a browser**, so the one
code path meant to soften a missing string was the path that threw, and the
error boundary replaced everything. A missing word became a blank page.

Vite does substitute `process.env.NODE_ENV` at build time, in that exact
spelling; the bracket form used here survived into the bundle untouched. A
`typeof` guard needs no bundler cooperation and is correct in Node too, where
the same strings are rendered by tests.

Worth keeping for two reasons beyond the fix. **A fallback path is the one least
likely to be exercised and the most expensive when it breaks**, which argues for
testing it deliberately rather than waiting to meet it. And the crash that
exposed it came from a dev server holding a stale catalogue, not from a real
missing key: the bug was real, the trigger was not, and telling those apart took
restarting the server rather than reading the code.

### 12.15 The catalogue is in French, and the interface is not

The crawl fetches `uclouvain.be/cours-<year>-<code>`. That is the French edition
of a course page, so every block stored in `ref.CourseOffering` is French. The
interface is in three languages, so a visitor with `en` or `nl` selected reads
English or Dutch labels around a French record, and until 2026-09-17 nothing on
the screen said so.

The visible cost was on the public home page, whose mock is built from a real
course record: the English home page carried a paragraph of French with no
explanation, and read as a product that had been translated halfway. The same
thing is true 6,654 times over on the course pages themselves.

**What was done now.** The language is stated once, above the fields that are in
it, in the visitor's language (`CatalogueLanguageNote`), and the blocks carry
`lang="fr"` so a screen reader does not read French with English phonemes. That
is an explanation, not a fix: the record is still French.

**What a fix would cost, measured 2026-09-17.** UCLouvain publishes an English
edition at `en-cours-<year>-<code>`. There is no Dutch one: `nl-cours-2025-lepl1503`
answers 404, so a Dutch course record is not obtainable from this source at all.

On a random sample of 80 courses from the loaded catalogue:

| | French page | English page |
|---|---|---|
| publishes an assessment section | 53 | 38 |

Eighteen of the 80 publish it in French and not in English, three the other way
round. So an English crawl **replacing** the French one would lose the assessment
text for roughly a fifth of courses. The English edition is a genuine translation
where it exists (spot-checked on a dozen courses), but it is also allowed to
defer: `en-cours-2025-lepl1503`, the course this repository uses as its example
everywhere, answers "See French document" under Evaluation methods.

So the shape of the work is not "crawl English instead". It is:

1. crawl both editions, which doubles a run that already takes 78 minutes,
2. store a language per field rather than per course, since the two editions
   disagree about which fields exist,
3. fall back to French per field, and say on screen which language each field
   ended up in,
4. accept that Dutch has no source and will fall back to French always.

**Deferred, on François's call, 2026-09-17.** The cost is a second full crawl and
a second snapshot per year for a partial gain, and the note now on screen is
what makes the current state honest rather than broken. Recorded as OPEN-47.

## 13. A second institution: ULB

Decided 2026-09-18. François: "For now I want to fetch also ULB stuffs. These
are the 2 univs I want to start with (they are potential tester candidates with
huge added values)."

### 13.1 What ULB publishes, measured

All of this was read off the live site on 2026-09-17, not inferred.

- **`robots.txt` permits a crawl.** It disallows `/adminsite/`, `/fcktoolbox/`,
  `/extensions/`, `/META_INF/`, `/WEB_INF/` and `/action/*`, and publishes a
  sitemap. Nothing needed is under those paths.
- **The sitemap lists the programmes.** 4,166 URLs, of which 572 match
  `/{fr,en}/programme/2025-…`, so roughly 286 per language. The kinds in the
  codes are `ba`, `ma`, `ma60`, `ms`, `m`, `poli4` and `capaes`.
- **The programme page carries no course list.** It is a marketing page. The
  list is fetched by the page's own JavaScript from
  `GET /api/formation?path=/ksup/programme?gen=prod&anet=<CODE>&lang=fr&`,
  which returns JSON wrapping rendered HTML. For `BA-TECN` that yielded 34
  course codes with links.
- **Course pages need no JavaScript.** `/fr/programme/2025-comm-b1010` carries,
  in the HTML: the code, the title, `Titulaire(s) du cours`, `Crédits ECTS`,
  `Langue(s) d'enseignement`, `Contenu du cours`, objectives, teaching methods,
  bibliography, the campus, and `Méthode(s) d'évaluation` with weightings. Both
  2025-2026 and 2026-2027 are offered, as at UCLouvain.

Two differences from UCLouvain that the parser must expect rather than discover.

**No quadrimester.** The word appears nowhere on the course page. `quarter` is
already nullable and the filter facets are derived from the data, so the Term
filter will simply not be offered for ULB courses. This is section 12.8's rule
working as intended: a field the source omits is a state to record, never a
reason to lose the course.

**Lecturer email addresses are published**, in a `Contacts` block next to the
teacher's name, in the form `prenom.nom@ulb.be`. We store names and never
addresses. Requirements 5.1 makes the lecturers the GDPR exposure rather than
the students, and the address is the part that makes a named person
contactable.

The pattern is written here and the real one is not, on purpose. This
repository is public and permanently cloneable, so an address quoted as an
example would be republished by us just as surely as one in a column.

### 13.2 A code belongs to a catalogue, not to the world

`Course.code` was globally unique and `Programme` was unique on `(code, year)`.
Both were right with one institution. With two they were an accident of naming:
UCLouvain writes `lepl1503`, ULB writes `comm-b1010` and `ba-tecn`, so nothing
collides today and nothing said it had to keep not colliding.

**The cost of finding out the hard way is not a duplicate row.** A load is one
transaction, so one colliding code fails a whole catalogue after the crawl that
produced it has spent over an hour. Section 12.10 is that same failure from a
numeric column.

Requirements 1.5 lists tenancy in the data model as one of the few things cheap
now and expensive later, and this is exactly that: while the only rows are one
institution's and can be rebuilt from the snapshot it is a backfill, and once
reviews point at a second institution's courses it is a migration with user data
hanging off it.

So `Course` and `Programme` both carry `institutionId`, unique on
`(institutionId, code)` and `(institutionId, code, year)`.

**What the column means is narrower than it looks.** It answers "which code
space was this string drawn from", not "who teaches this". FR-D31's tenant is
the second question, its answer is sometimes another institution entirely, and
answering it needs FR-D30's two stated fields, which are **specified and not yet
parsed**. `read.ts` still derives `external` from having no teachers and no
assessment, which is the heuristic FR-D30 measured as wrong on 4 of 66 flagged
offerings. Putting the tenant in this column would have made a guess look like
a fact.

**Programme's copy is enforced, not trusted.** `institutionId` there duplicates
what the faculty already knows, and two copies of one fact drift. The foreign
key is composite, `(facultyId, institutionId)` referencing `Faculty(id,
institutionId)`, so a programme filed under an institution its own faculty does
not belong to cannot be written, whatever the loader does. A trigger would have
achieved the same and would have been code nobody reads.

### 13.3 What is not yet decided

A code in a URL does not say which university it belongs to. `/app/ryc/c/lepl1503`
resolves against the whole catalogue, which is unambiguous with one institution
and ambiguous with two. That is **OPEN-48**, and it blocks loading ULB's
catalogue rather than the schema change: the database can hold two catalogues
today, and the read path cannot yet address them apart.

The crawler also needs a source adapter before ULB can be ingested: the current
one is UCLouvain-shaped throughout, walking faculty indexes and the search
application, while ULB's shape is sitemap, then the programme endpoint, then
course pages.

Rough size, extrapolated from one bachelor and therefore an estimate rather
than a measurement: around 286 French-language programmes and somewhere near
5,000 to 8,000 courses, so perhaps 6,000 requests.
