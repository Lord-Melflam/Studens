# Where the project is, and how it got here

Updated as work happens. The state at the top is what matters day to day; the
log below is the record of how each decision was reached, so a decision can be
re-opened with its reasoning attached rather than argued again from nothing.

Companion files: `requirements.md` is the specification, `design/` holds the
decisions with their alternatives and costs, and `LESSONS.md` records what has
gone wrong and what each failure changed.

---

## State, as of 2026-09-10

| | |
|---|---|
| Stage | **Working software.** Catalogue end to end; the review module is not built |
| Commits | 20 |
| Requirements | 105, of which FR-A 10, FR-B 18, FR-C 22, FR-D 26, FR-E 7 |
| Open questions | **14** open, 31 resolved |
| Tests | **85**, plus 14 database isolation assertions |
| Code | ~3,200 lines TypeScript, ~800 SQL and Prisma, ~3,000 documentation |
| Data | 546 courses, 546 offerings, 43 programmes, 893 lecturer rows, in PostgreSQL |

### What runs today

```bash
npm run gates            # typecheck, lint, 85 tests, schema validation. No database needed
npm run gates:db         # migrate, grant, then verify the schema isolation
npm run ingest -- --faculty epl        # scrape uclouvain.be, politely. Cached after the first run
npm run db:load                        # snapshot into PostgreSQL, in one transaction
npm run dev:api                        # terminal 1
npm run dev:web                        # terminal 2, then localhost:5173
```

You land on the **shell**, choose a module, and inside RYC you can browse a
programme or search a course code and open its page: ECTS, quarter, language,
lecturers, contact hours, the official assessment method with its weightings,
and a link to the official UCLouvain page.

### What is deliberately not there

Reviews, because the module is not built. Authentication, because nothing yet
needs it (FR-D13 makes course pages public anyway). The trendline and
distribution graphs, deferred to v2. **No placeholders for any of them**: an
empty ratings panel would claim the platform does something it cannot.

### Decided, and not to be re-argued without new evidence

| Decision | Where |
|---|---|
| Modular monolith plus a worker, one Postgres, schema and role per module | `design/architecture-style.md` |
| Microservices excluded: a saga's correlation id **is** the forbidden link | same, section 3 |
| Anonymity kernel enforced by grants, not by code review | same, 6.1 and 8 |
| Anonymous contributions permanent, no suppression threshold | `requirements.md` 3.3 |
| Rate limiting by fixed-window counter, no timestamps | `design/anonymous-rate-limiting.md` |
| Catalogue scraped, structure discovered not hardcoded | `design/catalogue-ingestion.md` |
| Trusted contributors, all module code in this repository | `requirements.md` FR-B14 |
| Oracle Cloud Always Free, one EU VM | `requirements.md` 5.2 |
| Microsoft and Google OAuth only, no stored passwords | `requirements.md` 3.1 |

### The 14 open questions

Grouped by who can answer them, because that is what decides when they close.

**Needs François, and small:** OPEN-8 (how Moderators are appointed), OPEN-24
(auto-removal threshold), OPEN-26 (the quota number), OPEN-36 (full name or
username on attributed reviews), OPEN-7 (whether a 24 hour moderation target is
sustainable).

**Needs François, and consequential:** OPEN-18 (who may approve a merge, which
FR-B14 turned into a security question), OPEN-35 (one person can hold many
accounts, so per-member limits bound accounts rather than people), OPEN-45
(courses taught at other institutions, which arrived inside a single-tenant v1).

**Blocked on something outside the repository:** OPEN-42 (permission from the
EPL drive administrators, which blocks any import), OPEN-17 and OPEN-23 (AI cost
and whether review text leaves the platform), and the data protection review in
5.1, which is non-lawyer reasoning and needs professional confirmation before
launch.

**Should be settled against code, by their own terms:** OPEN-40 (worker
deployment), OPEN-41 (backup cadence, now a privacy parameter), OPEN-34
(enrolment ownership, explicitly not to be decided before a second consumer).

### Not yet done, and known

- **Branch protection requiring the `gates` job** is a repository setting, not a
  file, so it cannot be verified from here. Without it FR-B15 is a document
  rather than a control.
- Only **EPL** is ingested. The crawl covers all 20 faculties; the module
  launches scoped, by decision.
- `apps/worker` has the two CLIs and no queue. Moderation has no consumer yet.

---

## Log

### Phase 0: context and rules

Established the working environment (Windows 11 host, WSL2, Ubuntu 22.04) and
the hard rules that govern everything since: no AI attribution, plain
punctuation, never assume, plain tone, no touching secrets, a hard check before
every commit, challenge rather than agree, and later **rule 8: every choice must
be justified** by naming the requirement it serves, the alternatives rejected,
the cost accepted, and what would change the answer.

`CLAUDE.md` is deliberately untracked: it holds machine-specific context that
has no place in a public repository.

### Phase 1: specification before code

**Nothing was built until the specification existed.** The instruction was
explicit: "no scaffolding, the first thing to do should be writing the specs."

`requirements.md` grew to 105 requirements with permanent identifiers, four
provenance markers (`[VERIFIED]`, `[DERIVED]`, `[PRIOR-ART]`, `[OPEN]`), and 45
numbered open questions. The RYC prototype was recorded as prior art with **zero
authority**.

The anonymity design was settled here and has not moved since: per-contribution
choice, structurally separate storage paths, no nullable owner column,
permanent and irreversible for anonymous, moderators retain removal, author
sanctions impossible on the anonymous path.

A race condition was found in the accepted rate-limiting design (read-then-write
on the quota) with the one-line atomic fix.

The product was named **Studens** after four rounds of verified `.be`
availability checks, and published under MIT.

### Phase 2: reading the academic material

Work stopped to read three courses in full: **163,839 words** across LINFO2252
(Software Maintenance and Evolution), LINFO2251 (Software Quality Assurance) and
LINFO2145 (Cloud Computing). Each produced a two-layer synthesis, faithful
summary then applied to Studens, in Markdown and PDF: 24, 85 and 63 pages.

Kept local and gitignored, because they summarise course slides and a commercial
textbook.

That reading has since produced requirements rather than vocabulary. The safety
kernel pattern, the CI-gates-for-organisational-independence argument, the
scalability cube's X and Y axes, and the observation that an AP store sacrifices
consistency even with no partition, all appear in decisions below.

### Phase 3: the answers that unblocked everything

Nine open questions answered at once, including the two upstream blockers.

**The problem statement (OPEN-1).** Students choose elective courses blind at
PAE time. Syllabus descriptions diverge from the real workload, teaching and
evaluation difficulty; peer feedback lives in Discord and is buried within
weeks, so every cohort re-asks the same questions. With a failable pass test.

**The first module (OPEN-13).** RYC specified as FR-D1 to FR-D25.

Also settled: open public registration (no student roster is obtainable by a
third party), transparency as the default with anonymity opted into per
contribution, courses identified by code plus academic year, and AI as a product
capability rather than a module.

Two findings recorded that the answers created rather than closed. Per-course
uniqueness **cannot** be enforced on the anonymous path, so **FR-C17** forbids
claiming it publicly: the enforcement gap is what keeps the complement attack
probabilistic, and announcing the rule would hand back the certainty. And a
moderation queue is storage even though it looks like plumbing.

### Phase 4: research instead of assumption

Six questions closed against checked sources.

- **Identity.** MX lookup showed `uclouvain.be` and `student.uclouvain.be` both
  route through Microsoft, so the whole target population already holds a
  Microsoft identity. Side effect: the email-domain trust signal is
  provider-verified rather than self-declared.
- **Hosting.** Vercel Hobby disqualified (10s functions, no first-party
  Postgres, no GitHub org repos, and a non-commercial clause that catches any
  paid contributor); Render's free Postgres **expires after 30 days**; Fly.io has
  no permanent free tier. Oracle Always Free chosen with three risks recorded,
  including that it was halved in June 2026 with no announcement.
- **Load.** EPL about 2,200 students, UCLouvain more than 35,000. Capacity is
  not a design driver, and cohorts of 15 to 40 are the normal case, which made
  the anonymity-set question real rather than theoretical.
- **Data protection.** The exposure is the **lecturers**, not the students: a
  named third party who never consented. Anonymous reviews fall outside the GDPR
  under Recital 26, which is the return on all of FR-C.

### Phase 5: architecture, decided against six candidates

Six styles compared against eight criteria taken from the project's own
documents. Microservices excluded by **two independent arguments**:

1. The anonymity invariant is cross-tier. A saga persists a correlation
   identifier tying the quota increment to the contribution, which is exactly
   the member-and-target pair FR-C2 forbids. **The coordination mechanism is the
   forbidden link.**
2. FR-C8's test is a schema test, which only exists while there is one schema.

Chosen: modular monolith plus a worker, one Postgres, **a schema per module and
a role per schema**. Drawing the schema before confirming the decision found
three problems, two of them in requirements already committed (see
`LESSONS.md` section 2).

### Phase 6: first code, gates before features

The repository moved out of the Windows mount after measurement: 300 small file
writes took 0.030 s on ext4 against 4.018 s on `/mnt/c`, **134 times slower**.

Workspace tiers, 15 database models, and the two gates built and **proven by
mutation** before any feature: adding a member column, replacing the
day-precision date with a timestamp, adding a tenant column, and pointing a
feature module at a higher tier each fail with the requirement id in the
message.

### Phase 7: the scraper

546 courses reachable from EPL across 43 programmes. Structure discovered at
runtime, nothing hardcoded. Two page eras parsed (2024 onward, and the archive
back to 2012 via redirect). Three bugs found only by running it against the live
site, all in `LESSONS.md`.

The genuine discovery: the catalogue contains **courses taught at other
institutions**, whose UCLouvain pages carry only a reference. That became
OPEN-45.

### Phase 8: the first screen

React 18, Vite, one screen. Deliberately no placeholder for reviews.

An eslint config matching only `**/*.ts` meant the **entire frontend was
unlinted**, which is in `LESSONS.md`.

### Phase 9: the database, and the kernel

Two migrations: the schema, then roles and grants written by hand because Prisma
does not manage roles.

**OPEN-39 answered against real code**, as it had asked to be:
`studens_platform` is the only role that may INSERT into `ryc.ReviewAnonymous`,
because only it can perform the quota check in the same transaction.
`studens_ryc` may read anonymous reviews and cannot create one, so the module
owning the feature cannot bypass the quota. DELETE belongs to nobody.

The write path to the anonymous store is **one grant wide**, checkable by
reading a migration rather than by auditing application code. The first version
of the script verifying this was a false green; see `LESSONS.md` section 1.

### Phase 10: catalogue into Postgres, and the official link

The API reads the database and **every route handler was unchanged**, which was
the claim made when the read interface was written.

Two properties verified rather than assumed: course ids are **stable across
re-ingestion** (a review attached to a course still resolves afterwards), and
nothing is ever deleted from `ref.Course`, so a review of a retired course
survives.

### Phase 11: browse, and the shell

Browsing by programme added, after noticing that **the pass test is narrower
than the problem statement**: search serves someone who already knows the code,
while 1.1 describes a discovery problem. The test stands as a necessary
condition, not a sufficient one.

The data turned out not to be there: the crawl had been discarding the programme
it traversed. Snapshot version 3 and a join table fixed it. Now 1,530 programme
links for 546 courses, so a course sits in 2.8 programmes on average.

And the frontend got the tiers it never had, after François asked whether a user
would drop straight into RYC. `apps/web` **was** RYC. See `LESSONS.md`
section 5.

### Phase 12: drawing the target product

Before building the review submission path, the frontend was designed rather
than invented screen by screen: `design/frontend-design.tex`, 13 pages of
LaTeX and TikZ, marked proposed. Architecture, screen map, three personas, four
scenarios, twelve use cases, and the anonymity seam drawn once.

The colour decision came from a constraint rather than taste: every institution
Studens will sit beside is blue, so a blue platform reads as an official
university product, which is an affiliation it does not have. Institution logos
are fetched by a script and never committed, because trademark applies whatever
the copyright status of the file.

The first version of the drawings had text overlapping in many places, from
hand-computed layout with guessed text widths. See `LESSONS.md` section 1.

---

## Next

1. **Review submission**, which is the first thing that exercises the anonymity
   kernel: the quota check and the anonymous insert in one transaction, as the
   only role permitted to do it.
2. Authentication, which FR-D13 needs before reviews can be read.
3. Branch protection, which only François can enable.
