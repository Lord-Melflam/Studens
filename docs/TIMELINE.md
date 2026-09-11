# Where the project is, and how it got here

Updated as work happens. The state at the top is what matters day to day; the
log below is the record of how each decision was reached, so a decision can be
re-opened with its reasoning attached rather than argued again from nothing.

Companion files: `requirements.md` is the specification, `design/` holds the
decisions with their alternatives and costs, and `LESSONS.md` records what has
gone wrong and what each failure changed.

---

## State, as of 2026-09-11

| | |
|---|---|
| Stage | **Working software.** Catalogue end to end, and reviews submitted and read on both paths |
| Commits | 28 |
| Requirements | **108**: 90 functional (FR-A 10, FR-B 20, FR-C 23, FR-D 30, FR-E 7) and 18 non-functional. Counted, not carried forward |
| Open questions | **13** open, 32 resolved |
| Tests | **258**, plus 15 database isolation assertions |
| Code | ~4,900 lines TypeScript in `packages`, `apps` and `scripts`, plus ~1,900 lines of tests and ~800 of SQL and Prisma |
| Data | 546 courses, 546 offerings, 43 programmes, 893 lecturer rows, in PostgreSQL |

### What runs today

```bash
npm run gates            # typecheck, lint, tests, schema validation. No database needed
npm run gates:db         # migrate, grant, then verify the schema isolation
npm run ingest -- --faculty epl        # scrape uclouvain.be, politely. Cached after the first run
npm run db:load                        # snapshot into PostgreSQL, in one transaction
npm run dev:api                        # terminal 1, with the development identity
npm run dev:api:anon                   # same, signed out, to see what a visitor sees
npm run dev:web                        # terminal 2, then localhost:5173
```

`dev:api` sets `STUDENS_DEV_IDENTITY=1`, because submission needs a member
(FR-C4) and FR-A is not built, so without it the review form refuses to open and
looks like a bug. The fence is unchanged: the code still requires the variable
to be set explicitly, still refuses when `NODE_ENV=production`, and still prints
a warning naming FR-A at every start. Production does not run this script. The
cost is that a signed-out session is no longer the default locally, hence
`dev:api:anon`. Both scripts go away when FR-A ships.

You land on the **shell**, choose a module, and inside RYC you can browse a
programme or search a course code and open its page: ECTS, quarter, language,
lecturers, contact hours, the official assessment method with its weightings,
and a link to the official UCLouvain page.

Below that page you can now read the reviews and write one. The form, the fork
between your name and anonymity, the confirmation on the anonymous branch and
the aggregate all work end to end, against the real kernel.

### What is deliberately not there

Authentication, so submission runs on a fenced development identity
(`STUDENS_DEV_IDENTITY=1`, refused when `NODE_ENV=production`, and the process
says so at every start). Moderation has no queue consumer, so a submitted review
publishes directly. The trendline and distribution graphs, deferred to v2.
**No placeholders for any of them**: an
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
| Branch per change, pull request, one approval, squash merge | `requirements.md` FR-B19, `CONTRIBUTING.md` |
| Owner review required on guarantees and on the instruments that prove them | `requirements.md` FR-B20, `.github/CODEOWNERS` |
| Oracle Cloud Always Free, one EU VM | `requirements.md` 5.2 |
| Microsoft and Google OAuth only, no stored passwords | `requirements.md` 3.1 |

### The 13 open questions

Grouped by who can answer them, because that is what decides when they close.

**Needs François, and small:** OPEN-8 (how Moderators are appointed), OPEN-24
(auto-removal threshold), OPEN-26 (the quota number), OPEN-36 (full name or
username on attributed reviews), OPEN-7 (whether a 24 hour moderation target is
sustainable).

**Needs François, and consequential:** OPEN-35 (one person can hold many
accounts, so per-member limits bound accounts rather than people), OPEN-45
(courses taught at other institutions, which arrived inside a single-tenant v1).
OPEN-18 closed on 2026-09-11, once there was a second person to review.

**Blocked on something outside the repository:** OPEN-42 (permission from the
EPL drive administrators, which blocks any import), OPEN-17 and OPEN-23 (AI cost
and whether review text leaves the platform), and the data protection review in
5.1, which is non-lawyer reasoning and needs professional confirmation before
launch.

**Should be settled against code, by their own terms:** OPEN-40 (worker
deployment), OPEN-41 (backup cadence, now a privacy parameter), OPEN-34
(enrolment ownership, explicitly not to be decided before a second consumer).

### Not yet done, and known

- **Administrators are exempt from branch protection**, by decision on
  2026-09-11. The rules bind `wilfred33`; they do not bind the owner. FR-B15
  records the deviation and the two ways to close it.
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

### Phase 13: drawing the backend

`design/backend-design.tex`, 12 pages. The architecture was already decided and
running; this draws it, which the prose could not. Every fact about the schema,
the roles and the grants was read out of the live database while writing rather
than recalled, which is how the unintended grant on `_prisma_migrations` was
noticed.

The centrepiece is the anonymity kernel drawn as a sequence, and the grant
matrix printed as a table: the security boundary made visible, including the
four properties readable directly off it, of which the last is that nobody holds
DELETE on the anonymous table.

The LaTeX preamble was extracted to `studens-preamble.tex` at the same time, so
the palette exists once. A per-institution theme is planned and a palette in two
files would have diverged.

### Phase 14: the review submission path

The first code that exercises the anonymity kernel, built in the order that let
each piece be checked before the next depended on it.

**The kernel first.** `platform/quota.ts` and `platform/kernel.ts`. The quota is
a single statement, `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE`, so the
check and the increment cannot be separated. The first draft read the counter
and then wrote it, which is a race; a mutation test proved it, letting **19 of
20** concurrent attempts through against a limit of 5. The window start is
computed from the epoch, so it needs no stored state and reveals nothing about
when a member joined.

**Then the two paths.** `ryc/submit.ts`. They share validation and nothing else.
`memberId` appears in `submitAnonymous`'s signature and reaches the kernel; it
does not appear in `content(...)` or below it, and the table has no column for
it, so a mistake there fails to compile.

**A discovery.** The first attributed submission returned 500: `studens_platform`
holds no grant on `ryc.ReviewAttributed`, because the grant matrix says the
platform has no rights over a feature module's own data. The boundary was working
correctly, and the fix was not to weaken it: the kernel now takes a second role
and switches with `SET LOCAL ROLE` between the quota and the insert, one
transaction, two identities. `design/backend-design.tex` 5.3.

**Reading, with the privacy rules on the server.** `ryc/read.ts` returns an
anonymous review with `author`, `recommendation`, `workloadVsEcts` and
`difficulty` already null (FR-C16, FR-D15), while those numbers still feed the
aggregate, which is the whole point of FR-D15. The pass band is a band above a
floor of five, never a percentage (FR-D23). None of this is left to the client:
a second client would leak it on day one.

**Then the screens.** `ryc-ui`: the form, the fork, the confirmation, the result.
The form carries no way to choose a path, because FR-C9 makes the anonymous
choice permanent and a radio button beside *Send* invites a decision of that
weight to be taken without reading it. The anonymous branch costs one screen
more than the named one, and that asymmetry is the design.

**Making the asymmetry checkable.** That property lived in JSX across three
`onClick` handlers, where it is readable but not testable, so the state machine
was pulled out into `ryc-ui/src/flow.ts` as a pure function. `test/ui` now
asserts over every step and every event that **no step other than the
confirmation can write an anonymous review**. Verified by mutation: removing the
confirmation step fails three tests. Recorded as FR-C23.

Tests went from 85 to 131. The gates and the live endpoints were both run: the
anonymous path returns no id (FR-C9), the attributed path returns one, and 400,
401, 409 and 429 all come back where they should.

---

### Phase 15: the scraped fields get their structure back

François, reading a course page: the evaluation, themes and content fields
were "juste rempli tel quel", one unbroken blob with no line breaks, no
paragraphs and no bullets.

The cause was one line in the parser. Labels on a course page carry `<br />`
inside them, cheerio joins text across a break with nothing, and every label
lookup spanning a break was failing. The fix, `$("br").replaceWith(" ")`, ran
once over the whole document. It fixed the labels and flattened 3,988 line
breaks inside the values. `LESSONS.md` section 1.

**Measured before designing anything.** Across the 546 cached pages and the
1,390 values of those three fields: 4,040 `li`, 3,988 `br`, 818 `ul`, 523
`strong`, 81 `ol`, 10 tables, and list nesting three levels deep. That is what
the model has to carry, and nothing more.

The fields are now structured blocks: paragraphs with their line breaks, lists
ordered and unordered nested to any depth, headings, tables, and three inline
emphasis flags. Stored as `jsonb`, snapshot format version 4, migration
`20260910230000_structured_course_prose`.

**Two properties worth keeping.** Structure is preserved, never invented: 106
fields are still one long line because their authors wrote one paragraph, and
adding breaks there would be fabricating. And no markup from UCLouvain reaches
the browser (FR-D27): the parser converts the source's HTML into a closed set
of shapes, the client builds its own elements, so there is no stored HTML and
no sanitiser in the path.

Tested from both ends, because either half can be right while the pair is
wrong: `test/catalogue/rich.test.ts` on the parser, against fixtures shaped
like the real markup rather than tidier than it, and `test/ui/prose.test.ts`
on the renderer, which is where a list that arrives nested and renders flat
would show. 143 tests to 151.

---

### Phase 16: polishing the submission screens

Seven things, and the first was not cosmetic.

**The fork was advertising three features that do not exist.** The named card
offered "modifiable plus tard", "apparaît dans Mes avis" and "vous pouvez
demander sa suppression". FR-C14 and FR-D12 are specified and have no code. The
copy had been lifted from `design/frontend-design.tex`, which draws the target
product in the present tense.

That matters because of which screen it was on. The fork is where a permanent,
unprovable choice is made by comparing two lists, so a false claim on one side
pushes the decision toward it, and here that was the side that is not
anonymous. The cards now say only what is true today, the planned edit is
mentioned once below both of them in the quietest type on the screen, and
`test/ui/path-honesty.test.ts` fails if a card names an unbuilt capability
again. Recorded as FR-D28 and in `LESSONS.md` section 1.

**The rest.** The submission limit is shown before the review is written rather
than as a 429 after it, and at zero the form does not open (FR-D29); its
wording says the platform counts reviews and never which ones, because for the
anonymous path it does not. A step indicator shows two steps on the named
branch and three on the anonymous one, so the asymmetry is visible before the
choice. The draft is re-readable on the fork and on the confirmation, since
deciding whether to sign text you cannot see is a decision made half blind.
Leaving the form with text in it now asks first. Missing fields are marked
where they are, not only listed in a sentence a long form pushes off screen.
And the body gained a maximum of 4,000 characters, **on the server first**: the
only ceiling had been the API's 32 kB request cap, which fails the whole
request with no field named.

Writing that limit exposed a gap: `validate()` had no tests at all. The quota
and the roles were covered, the content rules were covered by a manual curl.
`test/ryc/validate.test.ts` now covers all of them, 24 cases. 151 tests to 186.

---

### Phase 17: a development cycle, because there are two of us now

`wilfred33` was added to the repository, so the git workflow stopped being a
preference and became a control. It had been `[OPEN]` since the start, and
OPEN-18 had already been sharpened to "who may approve a merge is a security
question, not a workflow question", because FR-B14 makes review the boundary
every FR-C guarantee rests on.

**Decided** (FR-B19). Short lived branches off `main`, one pull request per
change, one approval from someone who is not the author, both CI jobs green,
squash merge so `main` carries one commit per reviewed unit, linear history.
Git flow was rejected on its own terms: `develop` and release branches exist to
support several released versions at once, and this project has one environment
and no releases, so it would have cost two merges per change and bought nothing.

**Branch protection is on**, which it had never been. Required checks `gates`
and `database`, branch up to date first, approvals dismissed on new commits, the
last pusher cannot be the approver, conversations resolved, no force pushes, no
deletions. Verified by reading the settings back rather than trusting the write.

**`.github/CODEOWNERS`** answers the governance half of OPEN-18 (FR-B20). It
lists two kinds of path: things that *are* a guarantee (schema, migrations,
grants, the kernel, the two submission paths, the read path that strips author
attributes) and things that *verify* one (the isolation script, the architecture
and kernel tests, the lint boundary rule, the CI workflow). The second kind is
there because `LESSONS.md` section 9 records that the instrument is the part
taken on trust.

**One deviation, recorded rather than hidden.** François chose to leave
administrators exempt from the protection, so the owner can still push straight
to `main`. FR-B15 was not weakened to match: it now states the rule, the
deviation, what it costs (on the owner's own changes review is self-review
again, the exact condition FR-B15 exists to compensate for) and the two ways to
close it. A requirement that quietly agrees with whatever the repository does is
not a requirement.

**A pull request template** carries the four questions hard rule 8 demands, and
one checkbox that is not a formality: if the change adds or alters a gate, break
the thing it checks and paste the failure. Two gates in this repository were
found to be worthless for want of exactly that.

This entry was itself the first pull request.

---

### Phase 18: sessions, and the seam authentication will slot into

FR-A is the last thing between the review path and a real user. It is four pull
requests, because one would not be reviewable and review is the security
boundary here. This is the first.

`docs/design/authentication.md` records six decisions with what each costs:
server-side sessions rather than a stateless token (revocation and FR-A5 need
the list anyway), the cookie carrying a random token whose SHA-256 alone is
stored, `SameSite=Lax` and deliberately not `Strict` (the provider redirects
back as a top-level cross-site GET, which `Strict` would block), providers as
configuration rather than an SDK each, PKCE state in a short-lived signed cookie
rather than a table, and OPEN-36 resolved as a username chosen at first sign-in.

**The sharpest of those is what is not stored.** The provider hands us a display
name; we keep the subject, the email domain and the chosen username, and discard
the rest. Data never held cannot leak, be requested, or be correlated.

**The token is not the row id.** A session table whose primary key is the cookie
makes any stored snapshot a set of working cookies, and the FR-C3 threat model
already assumes an adversary may hold one. A test asserts that the token appears
nowhere in the stored row.

**The development identity changed shape.** It used to answer "who is this" out
of thin air, bypassing the session layer entirely. It now signs a fixed member
IN and issues a real session, so every local request runs the code path
production will use, and swapping in a real provider changes only where the
member comes from. Both fences were checked live: with the variable unset the
endpoint answers 404, and with secure cookies on the cookie carries the
`__Host-` prefix and `Secure`.

**A GET no longer signs anyone in.** `SameSite=Lax` still sends the cookie on a
cross-site top-level GET, so no state-changing endpoint may be a GET. Every
write here was a POST already; now that has a reason attached.

16 new tests, 186 to 202.

---

### Phase 19: OpenID Connect, provable before the applications exist

The second of the four authentication pull requests, and it merges what the
design note had as steps two and three: the flow, and Microsoft and Google as
configuration. Their issuers, scopes and claim names are public facts, so the
only thing still missing is two secrets in `.env`.

**Tested against a provider that really exists for the length of the test.** The
fake serves a discovery document and a JWKS over HTTP and signs real RS256
tokens. So the signature check, the JWKS fetch and the claim validation are the
code that will face Microsoft, rather than a stub returning what it was told to.
Mocking `fetch` would have tested the mock.

**One decision with a security consequence worth reading.** Microsoft's
multi-tenant metadata declares a templated issuer,
`https://login.microsoftonline.com/{tenantid}/v2.0`, while a real token carries
the signing tenant's id. Comparing as strings rejects every genuine token;
skipping the comparison accepts a token from anywhere. So the placeholder is
filled from the token's own `tid`, which must be a GUID, and the result must
equal what the provider published. Tested against empty strings, `..`, non-GUIDs
and a hostile issuer.

**A gap the tests found, which is the point of writing them.** The replay test
failed: replaying a callback with the captured cookie created a second session.
Our state cookie is cleared as it is read, which stops a back button but not a
deliberate replay, because clearing a cookie is an instruction to the browser.
What actually refuses it is the provider denying the reused code, which
RFC 6749 section 4.1.2 makes a MUST.

The first fake provider did not implement that MUST, so it was **laxer than any
real provider** and hid the dependency completely, which is the same failure as
a fixture tidier than reality. The fake now enforces it, the test asserts the
replay fails, and section 0.7 of the design note records that this one property
is discharged by the provider rather than by us, with what it would take to
bring it in house.

Also here: `openid email profile` and nothing more, which is what keeps the
Google app free of verification, warning screens and seven day expiry; and
Appendix A, a start to finish walkthrough of registering both applications,
checked against the vendor documentation rather than recalled.

202 tests to 241.

---

### Phase 21: the public zone

The first of the three zones from phase 20. A stranger now meets a site rather
than a sign-in wall: what Studens is, the problem it exists for, how it works,
what is and is not built, what anonymity protects and what it does not, and who
is behind it.

**Paths, not hashes.** The old router put the module id after a `#`, which was
fine while everything sat behind a session: nobody shares a link to an
authenticated screen. A public page is the opposite, and `studens.be/#/a-propos`
is a link that looks like a mistake. Cost, written down rather than discovered:
the server must answer unknown paths with `index.html` or a refresh on
`/a-propos` is a 404. Vite does it in development; production does not have it
yet.

**The boundary gate shaped the copy, three times.** FR-B16 forbids RYC's
vocabulary anywhere in `apps/web`, and a landing page explaining RYC needs
exactly that vocabulary. Rather than weaken the rule, the module now presents
itself: `ModuleRegistration.presentation` carries the problem statement, the
steps and the status, and the public pages lay out words they do not
understand. The same reason the registry exists, one zone further out. When MPA
ships, a landing page written in RYC's words would have been wrong rather than
merely coupled.

It also caught `changer d'avis`, the French idiom, because `avis` is RYC's word
for a review. Reworded rather than exempted. And it caught a privacy page that
explained the complement problem in terms of courses; it now speaks the
platform's own vocabulary, which is what FR-C already uses and what will still
be true for the second module.

**Reworked once François supplied procyo.be's structure**, which no automated
client can read: Vercel's bot protection refuses every one of them, so it
arrived pasted by hand.

What transferred: a realistic product mock in the hero rather than a paragraph
about the product, benefit-titled cards instead of abstract statements, a
"where the data comes from" section, and a numbered getting-started. What did
not: Procyo sells to brokers, so "Book a demo" is on every screen; the
equivalent here is a free account. And Procyo needs a cookie consent banner.
Studens does not, because it runs no analytics, and **saying that is worth more
than a banner**, so the page says it and a test asserts it stays true.

The mock is the module's own, built from the real components and the real CSS,
so it cannot drift into advertising a screen the product does not have. A test
asserts the anonymous contribution in it shows no author and no numbers,
because that is what the server actually returns.

One thing procyo.be has that Studens structurally cannot fake: a fr/nl/en
switcher. The name was chosen precisely because it reads natively in all three,
and the product is French-only with no internationalisation. Not papered over
with a switcher that does nothing; raised as a gap instead.

**A gate for the opposite direction.** The architecture test enforces the
negative, that no domain word appears in the shell. A page could satisfy that by
saying nothing at all. `test/ui/public-zone.test.ts` enforces the positive: the
module's own sentences must actually reach the page. Verified by hardcoding the
copy into the landing page and watching it fail.

The first mutation of that test was worthless and worth recording: changing the
module's text passed, because the test reads the same source the page renders.
The property is about the wiring, so the wiring is what has to be broken.

241 tests to 252, then 258 after the rework below.

---

## Next

1. **Authentication** (FR-A). It is now the only thing between the review path
   and a real user: submission runs on a development identity that refuses to
   work in production. Needs OAuth client credentials from Microsoft and Google,
   which only François can register.
2. **Moderation** (FR-E). A submitted review publishes directly today. The queue
   has a schema and no consumer.
3. **Editing an attributed review** (FR-C14) and "Mes avis" (FR-D12), both of
   which the fork already promises on screen.
4. ~~Branch protection~~ done 2026-09-11, see phase 17.
