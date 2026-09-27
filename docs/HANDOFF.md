# Picking this project up

For whoever arrives next: a person, or a model working on their behalf. It
assumes you have the repository and nothing else, and it is written to be read
once, in order, in about twenty minutes.

Everything here was true on 2026-09-27 and checked against the code rather than
recalled. Where a number would go stale, this file names the command that
computes it instead.

---

## 1. What this is, in one minute

Students choose elective courses blind. Syllabus descriptions diverge from the
real workload and difficulty, peer advice lives in Discord and is buried within
weeks, so every cohort re-asks the same questions. **Studens** is a platform
that hosts small modules for students; the first, **RYC**, lets them read and
write course reviews.

**v1 passes when a student can search a course code and see rated, dated,
workload-annotated feedback in one place before their PAE deadline.** That
sentence is the acceptance test. Nothing else is.

The hard part is not the reviews. It is that a contribution can be published
**anonymously or under the author's name, chosen per contribution**, and that
the anonymous half must stay unlinkable to its author permanently, including
from the operators. Most of the unusual decisions in this codebase exist
because of that.

Run `npm run state` for the live figures.

---

## 2. From zero to running

PostgreSQL 14+ and Node 22+. Nothing else.

```bash
git clone <this repository> && cd studens
npm ci

createdb studens                     # or whatever DATABASE_URL points at
cp .env.example .env                 # then fill it in, see section 3
npm run db:migrate                   # schemas, tables, and the role grants
npm run db:grant-local               # lets your own user read all three schemas

npm run gates                        # typecheck, lint, the test suite, schema, links
npm run gates:db                     # the above plus the role isolation proof
```

The catalogue is scraped, not shipped. Without it the product runs and has no
courses:

```bash
npm run ingest                       # ~75 min per university, politely rate limited
npm run db:load                      # the snapshot into PostgreSQL, one transaction
npm run catalogue:report             # compares both directions, exits 1 on a gap
```

Then, in three terminals:

```bash
npm run dev:api                      # 3001, with the development identity
npm run dev:web                      # 5173
npm run mail -- --watch              # drains the outbox every 30s
```

`dev:api` signs in one fixed member so submission works without provider
credentials. It is fenced: the variable must be set explicitly, it refuses when
`NODE_ENV=production`, and the process says so at every start. **Use
`dev:api:anon` for anything reachable from outside this machine**, or one press
of the sign-in button hands a stranger an administrator session.

`docs/COMMANDS.md` is the full list and is kept honest by a gate.

---

## 3. What is NOT in this repository

**This is the section that matters most, and the reason this file exists.**
Three things the project depends on are deliberately untracked, so a clone
gives you none of them.

### `.env` — configuration and secrets

`.env.example` documents every variable with what it is for. Names only, here:

| Variable | What it is, and where to get a new one |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection. Local development uses peer authentication over the unix socket, so it carries no password. |
| `STUDENS_SESSION_SECRET` | Any long random string you generate yourself. Changing it signs everybody out; nothing else. |
| `STUDENS_GOOGLE_CLIENT_ID` / `_SECRET` | Google Cloud console, an OAuth 2.0 Web application client. The redirect URI must match your origin exactly. |
| `STUDENS_MS_CLIENT_ID` / `_SECRET` | Microsoft Entra, app registration. **Never exercised against the live provider**; see section 7. |
| `STUDENS_PUBLIC_ORIGIN`, `STUDENS_APP_ORIGIN` | Where the app is reachable. Both must be the public address or the provider sends visitors back to their own localhost. |
| `STUDENS_SECURE_COOKIES` | `1` whenever the origin is HTTPS. |
| `STUDENS_SMTP_*`, `STUDENS_MAIL_FROM` | Any SMTP relay. Port 587 with STARTTLS; 465 hangs, because the sender always issues STARTTLS on a plain socket. |
| `STUDENS_CONTACT_EMAIL` | Printed on the suspension screen and in the suspension message. Unset means both state the reason and offer nowhere to write, which beats an address that bounces. |

**No value is written down anywhere in this repository, and none should be.**
Re-issue them; do not hunt for the old ones.

### The working instructions for a model

The file the previous assistant read first is **not tracked**, because it holds
personal and machine-specific context. If you are a model and nobody has given
you one, sections 4 and 5 below are the part of it that belongs to the project
rather than to a person.

### The notes a previous assistant accumulated

Also untracked, for the same reason. What survived the sanitising is section 5.

---

## 4. The shape of the code

A **modular monolith plus one worker**. One database, a schema per module, a
PostgreSQL role per schema.

```
packages/platform   tier 1  members, sessions, quota, moderation, the anonymity kernel
packages/ref        tier 2  the course catalogue and its crawler
packages/ryc        tier 3  the review module
packages/ryc-ui             that module's screens
packages/i18n               three languages, in the URL
apps/api                    Express: routes are the ONLY place allowed to know all three tiers
apps/web                    the shell: navigation and a module registry, nothing about courses
apps/worker                 crawling, mail, pruning. Long jobs that must not be in a request
```

**Dependencies point down and never sideways.** Tier 1 imports nothing, tier 2
imports nothing, tier 3 may import both. This is enforced twice, and the second
one is the important one:

1. A linter rule, with a test that writes a violating file and asserts the
   linter rejects it.
2. **The database.** `studens_ryc` holds `SELECT` and nothing else on the
   anonymous review table; `studens_platform` holds `INSERT`. The module that
   owns the feature physically cannot write an anonymous review by itself,
   whatever its code says. `scripts/verify-isolation.sql` attempts every
   forbidden statement as every role and asserts it is denied.

Six runtime dependencies in total: `@prisma/client`, `express`, `react`,
`react-dom`, `cheerio`, `jose`. There is no router library, no state library,
no CSS framework, no auth library and no mail library, each for a reason
recorded in `docs/typeset/stack-overview.tex`, which is the document to read
after this one.

---

## 5. How this project is worked on

These are not style preferences. Each was earned by something going wrong, and
each is the short version of a longer entry in `docs/LESSONS.md`.

**Verify by using it, in the state the user is in.** Green endpoints and
passing component tests can both be true while the screen a person opens is
blank. Two changes were reported as working and were broken on the signed-in
path, because everything behind sign-in was, in test terms, never drawn. Before
saying a flow works, drive that flow signed in, and say plainly which parts you
checked and which you did not. Never claim a fix you have not reproduced first.

**Measure the document, look at the render.** Screenshots lie about width: a
headless window has a minimum size, so the page lays out wider than the picture
and everything looks cut. Two wrong diagnoses came from reasoning about flex
shrinking. Probe the DOM with `scrollWidth` for layout questions; take a
screenshot for "which rule applied" questions.

**Anything that can grow gets a bound in the change that adds it.** Not when it
hurts. Three uncapped lists shipped in one day; a fourth was written an hour
after the first three were fixed. The failure is legibility long before speed:
976 programmes as a 143,000-pixel page, "25 of 25" where 25 was the window and
456 matched. Draw a screenful, say how many are left, offer the rest. This is
NFR-O4 and it is a checkbox in the pull request template.

**Every choice names four things**, or it is not a decision, it is a guess and
must be marked `[OPEN]`: the requirement it serves, the alternatives rejected
and why, the cost accepted, and what would change the answer. A one-line
justification naming all four beats a page naming none.

**Challenge, then follow the call.** When a decision looks wrong, say so, give
the reason and the alternative, and name the cost nobody has mentioned: money,
permanence, or a weakened guarantee. Then do what was decided. Several
decisions in `docs/requirements.md` record the owner overruling a
recommendation, and those entries say so.

**Branch from `main`, always.** Merges are squash merges, so a branch stacked
on an unmerged branch conflicts every time. If work genuinely depends on
another branch, wait.

**A database test owns its namespace.** Vitest runs files in parallel against
one database, and `username` is globally unique. Every fixture lives under the
`ztst` prefix and each file owns a sub-prefix nobody else uses. A gate enforces
it, and `npm run state` excludes that namespace so the project never counts its
own test rows as data. It did once, and the wrong figure reached a published
document.

**Visual staleness is a defect, not a polish item.** Small-capital micro-labels
are the single strongest dated signal; sentence case at a readable size with
weight doing the separating reads as maintained. Chevrons are SVG paths with
round caps, never two rotated CSS borders. Anything pressable has a hover and a
focus state.

**Plain words.** Short sentences, no em dashes in prose, and none of the
vocabulary that signals a machine wrote it. Commit messages explain why, for a
teammate, in the project's own voice.

---

## 6. The gates, and the failure each one is made of

About a third of the test suite tests the *project* rather than the product.
None of these was written speculatively.

| Gate | The failure it exists for |
|---|---|
| `boundaries` | A tier boundary is only real if crossing it fails a build. |
| `anonymity-schema` | Reads the Prisma schema and asserts the anonymous table has no member column. |
| `verify-isolation.sql` | Its first version was a false green: every `SET ROLE` was itself denied, so all nine "must fail" queries ran as the owner and passed. It now asserts `current_user` first. |
| `here-wins` | A "you are here" mark lost to a later rule of equal specificity, three times, then a fourth where `.panel button` squeezed a button's content box to a negative width and an icon rendered as nothing. |
| `styled` | A whole screen shipped with six class names and no CSS rule for any of them. Nothing in the toolchain treats that as an error. |
| `signed-out` | A route caught the not-signed-in error and returned without answering, so the request hung forever and the screen sat on a loading line. |
| `no-egress` | Review text must never reach a third party, so the module holding it opens no socket at all. |
| `path-claims` | The screen where an irreversible choice is made may not name a capability that is not built. |
| `no-stale-counts` | The public page said 546 courses while the database held 12,154. |
| `docs:links` | Nothing tracked may reference an untracked file. The repository is public. |
| `test-isolation` | A non-deterministic failure that lands on whoever added an unrelated file. |

**Never bypass a gate because you wrote the change yourself.** Review is the
security boundary here, not a quality practice: every anonymity guarantee rests
on all database-touching code having been read, and with a small team that
often means self-review.

---

## 7. What is not built, and what is deliberately open

Stated plainly, because a handover that lists only what works is a brochure.

- **Nothing is deployed.** There is one deployable artefact, the web process
  serves the built application as well as the API, and it has never run
  anywhere but a laptop. A host, a domain and TLS are what is missing.
- **Automatic screening before publication** (FR-E4).
- **Removal publishing a statement of reasons** in the place the contribution
  occupied (FR-E9). Marked `[OPEN]`: it is a non-lawyer's reading of DSA
  Article 17 and needs confirming by somebody qualified.
- **Microsoft sign-in has never been exercised against the live provider.** Two
  of its values were written from documentation and never observed. This
  matters more than it sounds: one of the two target universities runs on
  Microsoft 365, so it decides whether that population can use a university
  account at all.
- **No student has used any of this.** Every review in the database was written
  during testing.

`npm run state` prints how many questions are still open;
`docs/requirements.md` section 7 holds them with their reasoning. Two are open
on purpose rather than by neglect, and say so in the entry itself.

---

## 8. Where to look for what

| Question | File |
|---|---|
| Why is it like this? | `docs/TIMELINE.md`, the log of how each decision was reached. **Read this first.** |
| What must it do? | `docs/requirements.md`. Requirement IDs are permanent. |
| What went wrong before? | `docs/LESSONS.md` |
| What do I type? | `docs/COMMANDS.md` |
| How do I contribute? | `docs/CONTRIBUTING.md`, including where a file goes |
| What is the stack, end to end? | `docs/typeset/stack-overview.tex` |
| How does anonymity actually work? | `docs/typeset/backend-design.tex`, and `packages/platform/src/kernel.ts`, which is short on purpose |
| Why these dimensions, this scraper? | `docs/design/` |

---

## 9. A suggested first hour

1. `npm run gates`. If it is green, the repository is sound.
2. Read `docs/TIMELINE.md` down to the end of the state section.
3. Read `packages/platform/src/kernel.ts` in full. It is the smallest piece of
   code the whole privacy design depends on, and it is deliberately short
   enough to read in one sitting.
4. Run the app, sign in with the development identity, write one review on each
   path, and look at what the course page shows and withholds.
5. Open `docs/requirements.md` section 3.3 and read the complement problem.
   Everything odd in the schema follows from it.

Then pick something from section 7.
