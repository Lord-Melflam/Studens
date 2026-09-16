# Where the project is, and how it got here

Updated as work happens. The state at the top is what matters day to day; the
log below is the record of how each decision was reached, so a decision can be
re-opened with its reasoning attached rather than argued again from nothing.

Companion files: `requirements.md` is the specification, `design/` holds the
decisions with their alternatives and costs, and `LESSONS.md` records what has
gone wrong and what each failure changed.

---

## State, as of 2026-09-13

| | |
|---|---|
| Stage | **Working software.** Catalogue end to end, sign-in with Google, a first run, an account somebody can leave, and reviews submitted and read on both paths |
| Commits | 47 |
| Requirements | **154**: 136 functional and 18 non-functional. Counted, not carried forward |
| Open questions | **8** open, 38 resolved |
| Tests | **469**, plus 19 database isolation assertions |
| Code | 14,274 lines of TypeScript and TSX across `packages`, `apps` and `scripts`, 5,620 of tests. Measured over every `.ts` and `.tsx` outside `node_modules` and `dist`, excluding generated `.d.ts` |
| Data | 546 courses, 546 offerings, 43 programmes, 893 lecturer rows, and 11 institutions, in PostgreSQL |
| Not sent | **No mail leaves this installation.** Messages are queued and printed; five `STUDENS_SMTP_*` variables turn that into delivery |

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
(FR-C4) and signing in for real needs provider credentials a contributor will not
have. It signs in one fixed member and issues a real session, so everything
downstream runs production's code path. The fence is unchanged: the code requires
the variable to be set explicitly, refuses when `NODE_ENV=production`, and prints
a warning at every start. Production does not run this script. The cost is that a
signed-out session is no longer the default locally, hence `dev:api:anon`.

That member starts with no username and no first-run progress (FR-F14), so what
a developer lands on is the first-run sequence, not somebody's finished account.

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

### The 8 open questions

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
every commit, challenge rather than agree, and later **the rule that every choice must
be justified** by naming the requirement it serves, the alternatives rejected,
the cost accepted, and what would change the answer.

The contributor's local working notes are deliberately untracked: they hold
machine-specific context that has no place in a public repository. Everything
a contributor actually needs is in `README.md`, `CONTRIBUTING.md` and the
specification, and the rules above are restated in `CONTRIBUTING.md`.

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
than invented screen by screen: `docs/typeset/frontend-design.tex`, 13 pages of
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

`docs/typeset/backend-design.tex`, 12 pages. The architecture was already decided and
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
transaction, two identities. `docs/typeset/backend-design.tex` 5.3.

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
was pulled out into `packages/ryc-ui/src/flow.ts` as a pure function. `test/ui` now
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
copy had been lifted from `docs/typeset/frontend-design.tex`, which draws the target
product in the present tense.

That matters because of which screen it was on. The fork is where a permanent,
unprovable choice is made by comparing two lists, so a false claim on one side
pushes the decision toward it, and here that was the side that is not
anonymous. The cards now say only what is true today, the planned edit is
mentioned once below both of them in the quietest type on the screen, and
`test/ui/path-claims.test.ts` fails if a card names an unbuilt capability
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
### Phase 20: the product had no shape, only a spine

François, on the current screens: "Too basic. You're really too basic there."
He was right, and the gap was structural rather than cosmetic. A visitor with no
account saw nothing at all. A member landed on a list of two buttons. There was
no public face, no path from stranger to member, and no moment where the product
asked who someone is and what they want from it.

`design/information-architecture.md` and FR-F1 to FR-F15 are the answer, written
before any screen, which is the same order the project used in phase 1.

**Three zones in one deployable**: a public site needing no account, sign-in and
a first-run sequence, then the app. A separate static marketing site was
rejected, and what that costs is written down rather than discovered.

**A first run, one question per screen**, resumable, with only the username
required. The alternative, one long form, asks a person to absorb every question
before answering any, and the first thing this product asks anyone is a question
about anonymity.

**Four collisions with existing decisions, surfaced before building.** Each one
would have been expensive to find in code:

1. Every profile field enlarges the attribute set behind 3.3. I recommended
   deferring programme and year of study to MPA, the module that will need them.
   Overruled, deliberately, and FR-F8 records the decision with its cost and the
   two mitigations that make it safe: nothing is required, and **no profile field
   renders on any contribution, attributed or anonymous**. That second one
   extends FR-C16 to the named path, because a public "3rd year, SINF" beside a
   named review sharpens the complement attack against every anonymous review of
   the same course, and a named reviewer cannot consent on behalf of the silent.
2. The institution picker was asked for with logos. `frontend-design.tex` 2.3
   had already recorded that the marks are trademarked whatever their copyright
   status. Name, city and colours instead, which still feeds the
   per-institution theme.
3. A declared institution is weaker evidence than the email domain, and FR-A10
   already forbids presenting that as proof of enrolment.
4. Choosing an institution must not set a tenant, because FR-C19 derives an
   anonymous contribution's tenant from the target and not the author.

**The institution list was looked up, not recalled**: eleven universities across
the three communities, with Saint-Louis Brussels folded into UCLouvain since
2023. Hautes écoles and hogescholen need the official registries and come later.

**And a way to test it**, because an onboarding completed once is an onboarding
nobody can re-test: replayable from the profile by anyone, the development
sign-in starts with no progress, and every step is its own route.

Written in a git worktree, so the dev servers running on the authentication
branch were not disturbed. First real use of the thing `CONTRIBUTING.md`
describes.

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

**Then two corrections from François, both structural.**

*"Studens is more than that. You're deeply referring to RYC."* Correct, and it
was an over-correction from FR-B16: to keep the shell from knowing what a course
is, the module had been handed the platform's own voice, so the hero, the
problem and the whole spine were RYC's. The landing page read as a course review
site with a platform bolted underneath, which is backwards. Studens is the thing
that accumulates; a module is what it accumulates into. The day MPA ships, that
page would have needed rewriting rather than extending.

Now the platform makes the platform's claim, the modules are what is inside it,
and the first module gets a section in its own words labelled as the first
module rather than as the product. `MPA` is listed as announced, with a name, a
line and a status and deliberately nothing else: writing a problem statement for
something unbuilt is how a roadmap turns into a promise, and requirements 1.0
is explicit that it has no shape yet. A test asserts a planned module carries no
problem statement, no steps, no mock and no component.

*"If you have to illustrate to pics, at least put real data."* The mock said
LEPL1503 was 6 credits with a subtitle it does not have, and showed "4.1 sur 23
avis" for a course with no reviews at all. Both invented. The course record is
now read out of the loaded catalogue: 5 credits, Q2, French, and the real
assessment text with its weightings and its second-session rule, verbatim. The
reviews stay illustrative because nobody has written one yet, and that is now
stated **on the mock** rather than assumed: a product asking people to trust a
privacy guarantee cannot illustrate itself with numbers that look measured and
are not. Tested.

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

### Phase 22: three languages

Studens was named because it reads natively in French, Dutch and English, and
the product was French only. That is a claim the product did not honour, and it
is structural rather than cosmetic: Belgian higher education is legislated
separately by the Flemish and the French Communities, so a platform meant for
both cannot be monolingual. Every screen written in one language is a screen to
revisit, so the cost grew with every pull request. It came before the first-run
sequence for that reason.

**The locale is in the path**, `/nl/a-propos`. A cookie cannot be shared: the
same link would show different things to different people, and a crawler would
see one language. Cost: every route carries a prefix, contained in one function
that `linkProps` calls, so no component knows the prefix exists.

**No library.** i18next and its relatives sell extraction tooling and a plural
engine, and the platform already ships the plural engine as `Intl.PluralRules`,
which knows that French treats zero as singular and English does not. What
remains is eighty lines. The same call as react-router and the OIDC client.

**Each package owns its strings**, the shell's separate from RYC's. A shared
`locales/` directory is a file every module must edit (FR-B4) and would put
RYC's vocabulary inside the shell, which FR-B16 has already refused three times.
So a module's public presentation is now built from the translator rather than
stored as text.

**A missing key is loud**, because nobody notices a page that quietly reverts to
French. Development warns and names the key; a test asserts `missingKeys()` is
empty, that no string is blank, and that the landing page rendered in the three
languages produces three different pages, since if two matched, one was falling
back and the switcher was decoration.

**What is deliberately not translated**: anything an institution publishes. A
Dutch-speaking student at UCLouvain reads French course descriptions because
that is what UCLouvain publishes, and inventing an official-looking translation
on a page whose claim is that the official record is one link away would be
worse than leaving it. The interface says so rather than letting a reader
conclude the product is half-finished.

**The FR-B18 gate was refined rather than weakened.** It forbade every
`@studens/` import outside the registry, which also caught shared platform-tier
infrastructure that is nobody's domain. It now reads each package's declared
tier from its manifest and forbids only **feature**-tier imports, which is what
FR-B18 actually says. Verified by importing a module into `main.tsx` and
watching it fail.

Still French only: the app zone and RYC's own screens. The mechanism is there
and the strings are not. And the Dutch has not been read by a native speaker,
which is recorded as open and must close before any Flemish institution is
launched into: clumsy Dutch reads as "not for you".

260 tests to 267.

---

### Phase 23: five open questions, prepared not decided

François asked for OPEN-35, OPEN-45 and the moderation trio to be worked up
while he rested. All five are **proposals**, with options, a recommendation and
what it costs. None is marked resolved: that is his call.

Two of them changed shape while being prepared, which is the argument for
preparing them rather than answering from the armchair.

**The Digital Services Act applies, and nothing in the product implements it.**
Checked against the regulation text rather than recalled. Article 16, a notice
and action mechanism, binds every hosting provider regardless of size, and there
is no report button anywhere. Article 6 conditions the liability shield on
acting once you have actual knowledge, which makes the size of the moderation
queue a legal exposure and not only an operational one. Article 19 exempts a
micro enterprise from the expensive half: internal complaints, trusted flaggers,
most transparency reporting.

**Article 17 collides with FR-C9 head on.** It requires telling the affected
user what was decided and why. On the anonymous path there is nobody to tell,
and that is FR-C9 working rather than an implementation gap. Proposed: publish
the statement of reasons **in the place the contribution occupied**, which is
the only channel that exists, is much harder to abuse quietly than a silent
deletion, and is the only redress an anonymous author can have, since they can
contest a public reason where they could never prove authorship to contest a
private one. Flagged for the same qualified reader who must confirm 5.1.

**The `external` flag is a heuristic, and it is wrong 6% of the time.** It
infers "another institution owns this" from having no teachers and no
assessment, which is also what a sparse page looks like. Measured: 66 flagged of
546, and **4 are UCLouvain courses**, including LINFO1222, which has themes,
prerequisites, contact hours and a faculty. Meanwhile the pages state the answer
outright, in two labelled fields nobody parses: `Institution de référence >
Université de Namur` and `Code de l'UE dans l'institution de référence >
NANOM306`. The proposal is to read what the page says instead of guessing from
what it lacks, which is the same lesson as several already in `LESSONS.md`.

The other recommendations in brief. **Nothing is ever removed automatically**: a
report threshold is a brigading tool, and the content it would remove is exactly
the argued negative review this platform exists to protect. **Moderators are
appointed one at a time by an administrator**, recorded, with content powers
only and no path to authorship. **No response time is published** until one has
been measured, because a missed promise is worse than none at the moment someone
is complaining. **Multiple accounts are accepted and disclosed**, with
per-target burst detection, which is the only integrity control that survives
FR-C2: a burst of contributions to one course is a fact about the course, not a
link between a member and what they wrote.

---

### Phase 24: five questions closed, one against the recommendation

François ruled on all five prepared in phase 23. Four as recommended, one not,
and the one that went the other way is the interesting entry.

**Moderation** (FR-E8 to FR-E14). Nothing is ever removed automatically:
a report threshold is a brigading tool and what it removes is the argued
negative contribution this platform exists to protect. Holding is automatic,
reversible and narrow, on dull signals only, never sentiment. Report counts are
evidence about the reporters as much as the content, shown to a human and never
acted on alone. No response time is published until one has been measured.
Moderators are appointed one at a time by an administrator, recorded, with
content powers only and no path to authorship.

Two of those requirements come from the regulation rather than from us. **FR-E8,
a notice and action mechanism, is legally required and does not exist**, which
makes it the first piece of moderation work. **FR-E9 publishes the statement of
reasons in the place the contribution occupied**, because DSA Article 17 wants
the affected user informed and on the anonymous path there is nobody to inform.
It stays `[OPEN]` pending the same qualified reader as 5.1: a non-lawyer arguing
that a public reason satisfies a duty to inform a recipient is exactly the kind
of reasoning that needs someone who knows.

**Accounts** (FR-C24, FR-C25). Multiple accounts are accepted and disclosed
rather than fought. The one control that survives FR-C2 is detection on the
**target**: a burst of contributions to one course is a fact about the course,
not a link between a member and what they wrote.

**External courses** (FR-D30, FR-D31), and the one that went against the
recommendation. The mechanics were accepted: the page states the owning
institution and the foreign course code, and the old heuristic guessed from
missing fields and was wrong for 4 of the 66 it flagged. The policy was not: I
proposed keeping those 62 courses read-only until their institution's catalogue
was ingested, and François chose to make them contributable now, with the tenant
being the owning institution.

That is FR-C19 applied rather than excepted, and the argument for it is one I
under-weighted: 1.5 lists tenancy among the few things cheap now and expensive
later, so exercising it against 62 courses and no live users costs less than
exercising it later against two institutions and traffic. The costs are recorded
rather than argued away: v1's UCLouvain scope now needs reading carefully, the
course record behind such a contribution is thin so FR-D19's promise holds
weakly there, and the official link points at UCLouvain's stub because we hold
Namur's course code and not their URL grammar.

Eight open questions remain, from thirteen.

### Phase 25: the first run

Signing in worked and landed people nowhere. There was a Member row with a
provider subject, an email domain and a tenant, and nothing a person had chosen:
no name, no institution, no way to be anything other than "membre" beside their
own review. FR-F4 to FR-F14 had been written on 2026-09-12 and none of it
existed.

Five screens at `/bienvenue/1` to `/5`: what this is, a username, a language,
studies, an institution. One question per screen, and only the username required
(FR-F6). The step is in the URL **and** on the Member row, so a refresh resumes
and so does a different device tomorrow (FR-F5). The whole sequence is a third
zone, next to the public site and the app: no module navigation and no crumbs,
because a wizard you can wander out of is one people leave halfway.

**Four things were decided while building it, and three of them were caught by a
gate rather than by me.**

**`displayName` was dropped rather than filled in.** OPEN-36 had already decided
the provider's display name is not kept. It was a column nothing wrote except
the development identity, and leaving it there made the decision a habit
somebody could quietly reverse. Removing it makes it structural. That is the
same argument as the anonymous table having no member column at all.

**Notification preferences were removed from FR-F8.** The column was written,
and then it became clear it could never work: FR-A9 stores the email *domain*
and never the address, so the platform cannot send mail to anybody. An unused
field is one thing; a preference for something that cannot happen is a promise.
Restoring it means first deciding to store addresses, which is a separate
decision with its own weight. The amendment is recorded against FR-F8 and needs
François's confirmation, because the original was his call.

**`programme` became `studies`, because FR-B6's frontend gate refused it.** The
first run asked for a "programme" and `test/architecture/frontend-shell.test.ts`
failed on five lines: that word belongs to the catalogue. The gate was right for
a second reason it does not know about, which is the better one: the field is
free text, it is matched against no catalogue row, and naming it after one
implies it is. Renaming fixed a real misdirection, not just a lint.

**The username reaches a review through a function, not a query.** `studens_ryc`
holds no grant on `platform.Member` and must not: a module that can query the
member table can enumerate members. So `reviewsFor` takes a `NameResolver`, the
API composes the two, and neither side gains the other's access. The module
still cannot look anybody up; it can only ask about ids already in its own
table, which are attributed reviews by definition.

Two older claims on screen were false and are now not. The submission form said
"la connexion n'est pas encore en place (FR-A)", which stopped being true when
FR-A shipped in phase 19, and the API start-up banner said "there is no
authentication". Both were written when they were true and nothing made them
change with the code.

The account panel gained the username, the institution and the studies it used
to list under "not yet available", and `test/ui/navigation.test.ts` gained the
harder half of that rule: a test that fails if something which has shipped is
still listed as missing. The first half was already there. Only the first half
ever gets written.

### Phase 26: filters, and one thing deliberately not built

546 courses and 43 programmes, both presented as a scroll. Browsing existed
because 1.1 is a discovery problem and search only helps somebody who already
knows the code, but a list of 46 courses with no way to say "Q2, five credits,
and something written about it" is not discovery either.

Both lists filter now. Programmes on kind, site and text; courses on term,
credits, teaching language, the entity in charge, text, and whether anything has
been written about them. FR-D33.

**Two rules make a facet trustworthy, and both are in the tests rather than in a
comment.** The options offered are the values actually present, never a written
list: the same reason the faculty and programme structure is discovered at
runtime. And each facet's count is computed with its own dimension ignored and
every other one applied, so a count is what selecting it would leave. Counting
against the unfiltered list is the easy version and it produces a chip saying 23
beside a list that empties when pressed.

**The kind of a programme is parsed from its title**, because UCLouvain does not
publish it as a field: "Master [120] : ingénieur civil en informatique
(Louvain-la-Neuve)" carries the kind, the credits and the site. That is a parse,
so it lives with the rest of the parsing and is checked against all 43 real
titles, with the code suffixes (`1ba`, `2m`, `2fc`, `fil`, `mino`) used as an
independent cross-check rather than as the source. A title matching nothing
returns null and shows as "autre": the same rule as the offering parser, where
"absent because the era lacks it" must stay distinguishable from "absent because
the parse broke".

**FR-D34 records what was not built: no filter, sort or search on a lecturer's
name.** Section 5.1 is that this product's GDPR exposure is the lecturers, and a
control that gathers everything written about one person in a single press is a
different feature with a different legal footing. There is a test asserting that
a text filter does not match a lecturer, so reversing the decision has to be
deliberate.

Three things were found while building it, and all three were on screen already.

**`owningFaculty` was stored and displayed with the arrow the source page draws
it with**, so the course page read "Faculté en charge: > BTCI". Stripped at the
parse, not at the screen: the arrow is punctuation belonging to the surrounding
page, and a filter would otherwise have grouped on it.

**The plural strings were written in ICU syntax**, `{n, plural, one {# avis}
other {# avis}}`, which this project's translator does not implement: it uses
`key.one` and `key.other` with a `count` variable and `Intl.PluralRules`. It
typechecked, it passed every test, and it would have printed the markup on the
screen. There is now a test that pins the convention.

**One assertion in the authentication tests counted the whole Session table**
while every other count in the same file was scoped to its own provider. Two
unrelated new test files shifted vitest's parallel scheduling and it began
failing about a third of the time. The assertion was never wrong about the
behaviour, only about what it was allowed to observe. Verified as a latent bug
rather than a new one by running the suite six times on the previous commit.

The in-app RYC screens were French only: the i18n work in phase 22 reached the
public showcase and stopped at the module's own screens. The browse and search
path is translated now, because adding filter labels in three languages to a
screen hardcoded in one produces something worse than either. The course page
and the review flow are still French, and that is the next piece of RYC work.

### Phase 27: the account, and four bugs found by using it

The platform could not reach anybody. FR-A9 was read as "keep the domain, throw
the address away", and that reading was mine rather than François's: the
provider sends the address on every sign-in, so discarding it bought no privacy
and cost every feature that needs to contact a person.

**The wider point, which is the one to keep.** FR-C's guarantees are about
CONTRIBUTIONS, which are a module's concern. They were allowed to govern
decisions about the ACCOUNT, which is the platform's, and that is how Studens
ended up unable to email anybody because of a rule written for RYC. FR-H is
written at the platform's level and says so. The one place FR-C legitimately
constrains it is FR-H3: no message may reveal the author of an anonymous
contribution, to anybody, including its author. That constrains the CONTENTS of
a message, never whether the platform may hold an address.

Built: two addresses, identity and contact, only one editable; a confirmed
change with the old address warned; per-kind notification preferences carrying
the date consent was given; export as a file; deletion behind typing your own
username. Mail is queued and drained by the worker over plain SMTP with
STARTTLS, spoken directly rather than through a dependency.

**OPEN-46 answered: detach.** When somebody deletes their account the text of
what they signed stays and the name goes. Detached is a FOURTH state and not a
second anonymous one, and the distinction is the whole reason it is safe: a
detached review keeps the numbers it was published with, is labelled as a
deleted account, and is counted with neither the named nor the anonymous set.
Folding it into the anonymous count would inflate the figure FR-C21 puts in
front of the next contributor, so the number somebody uses to judge their own
exposure, and 3.3's arithmetic with it, would be wrong.

Then four bugs, every one of them found by François using the product, and none
of them findable by the tests that existed.

**"A message has gone to you", when none could.** The confirmation was queued
correctly and no relay was configured, so it could never leave. He waited for a
link that was not coming. The queueing was right; the sentence was not. A
product that says something happened when it did not is worse than one that says
it cannot: the first makes a person doubt their own inbox, the second tells them
what to fix. `mailRelayConfigured` now lives in the platform rather than in the
worker, so the process that promises and the process that delivers cannot
disagree.

**A confirmation link that worked forever.** Stretching the lifetime from one
hour to twenty-four was right; verifying it was how the real problem surfaced. A
two-hour-old link replayed three times against a live account and applied every
time, overwriting an address the member had since set. FR-A13 said "single-use"
and the implementation was not, and the word had been dropped from the
requirement while rewriting it, which is the worse half. It is single-use now
with no stored state: the token carries a fingerprint of the contact state it
was issued against, and applying the change moves that state.

**The first run would not finish.** UCLouvain selected, Finish pressed, nothing.
The save was correct; the account was written, onboarded, institution set. The
routing decided whether to divert from the session fetched ON MOUNT, which still
said the first run had never been opened, so finishing navigated to the app and
was sent straight back, and the wizard resumed at the saved step. Pressing Finish
looked exactly like pressing nothing. The session is refreshed before the
navigation now, and waited for. The second half of why it was invisible: the
error line lived on step two only, so a refused save anywhere else produced
nothing at all to read.

**Free text accepted anything.** Control characters stored raw, bidirectional
overrides that reorder what is displayed without changing what is stored,
zero-width characters, newlines in a one-line field, and a limit of 120 that
refused 61 emoji because JavaScript counts UTF-16 units and a person counts
characters. Nothing on screen said any of it. The rules live in the platform,
reject rather than strip, count in graphemes, and are mirrored in the browser so
a mistake is visible while it is made; a test runs both over one corpus and
fails if they drift.

Two of those rules were wrong on the first attempt and my own tests caught them:
compound emoji were refused, contradicting reasoning written two lines above,
and the checks ran after whitespace was collapsed, which let the byte order mark
through because JavaScript counts U+FEFF as whitespace. That is silent stripping
arriving through the back door, in the module whose header says it never strips.

**What the pattern of this phase says.** Four bugs, four reports, zero caught by
469 tests. Every one sat on the signed-in path or in a claim made on screen, and
the tests that existed checked behaviour rather than what the product told
somebody about it. `test/ui/signed-in.test.ts` and the claim gates from phase
26 are the beginning of an answer; the rest is that a product has to be used.

---

## Next

1. ~~Authentication~~ done, phases 19 and 25. Google works end to end. Microsoft
   is registered and untried: UCLouvain's tenant turns an outside account into
   an `#EXT#` guest, so it needs testing from the `procyo.be` tenant instead.
2. **FR-E8, the notice and action mechanism.** Legally required, and nothing
   implements it. First piece of moderation work, ahead of the queue.
3. **Moderation** (FR-E) beyond that. A submitted review publishes directly
   today. The queue has a schema and no consumer.
4. **Editing an attributed review** (FR-C14) and "Mes avis" (FR-D12), both of
   which the fork already promises on screen.
5. **A mail relay.** Nothing is delivered until the five `STUDENS_SMTP_*`
   variables are set: messages queue correctly and the worker prints them. The
   zero-budget start is a Gmail app password; the exit is a relay on the real
   domain. François's to supply, and it blocks nothing else.
6. **Deployment.** Nothing deploys. The API does not serve the single-page
   application, so path routing would 404 in production on any refresh.
7. **The rest of RYC in three languages.** The course page, the review form and
   the fork are still hardcoded French. Phase 26 did the browse and search path.
8. **A programme is not in the URL.** `Browse` holds the chosen programme in
   component state, so it cannot be linked or refreshed, which is the same bug
   phase 20 fixed for courses. The filters sit on top of that and inherit it.
9. ~~Branch protection~~ done 2026-09-11, see phase 17.
