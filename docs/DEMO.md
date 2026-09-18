# Showing Studens to students

A script for a live demonstration, written for the person driving it. It
assumes nothing is deployed yet, so everything runs on a laptop and the room
looks at a screen.

Written 2026-09-18 for the first ULB session. If the numbers below disagree
with what is on screen, the screen is right and this file is stale: every
figure here is also visible in the product, which reads them from the database.

---

## 1. Before the room arrives

Copy these exactly. Three terminals; the first two stay open for the whole
session.

### Terminal 1, the API

```bash
cd ~/projects/studens
sudo service postgresql start
npm run dev:api
```

Wait for it to print three lines. It has to say all three:

```
api listening on http://localhost:3001 (catalogue: database)
  .env: /home/.../.env  |  sign-in providers: Google
  web app: not built, API only (npm run build:web)
```

`npm run dev:api` **rebuilds before it starts**, so restarting it is how you
pick up a code change. It takes about twenty seconds. It also turns on the
development identity and warns about it in capitals; that warning is correct
and it is worth not having on the projector.

### Terminal 2, the application

```bash
cd ~/projects/studens
npm run dev:web
```

Wait for `VITE ... ready` and `Local: http://localhost:5173/`.

**This one does NOT rebuild anything on its own.** See section 1.2.

### Terminal 3, the check before you start

```bash
curl -s localhost:3001/api/catalogue
```

Expected, and if it disagrees the rest of the session will too:

```json
{"year":2026,"courses":12093,"programmes":976,"institutions":["uclouvain","ulb"]}
```

---

### 1.1 The order that matters

```bash
git pull                 # FIRST, before starting anything
npm run dev:api          # rebuilds, then serves
npm run dev:web          # serves source directly
```

Pull first. Starting the servers and then pulling is the single most common way
to end up demonstrating last week's code, because neither server notices.

---

### 1.2 THE STALE SERVER, which has cost this project more hours than any bug

**The symptom**: a change you know is merged is not on the screen. A button
with no styling, a chevron that is not drawn, a number that is still the old
one, a page that crashes with "Element type is invalid".

**The cause**, one of two:

- `dev:web` was started before you pulled, and Vite is serving modules it
  cached. It does not re-read the disk for a change that arrived behind its
  back, and it can serve **fresh CSS next to a stale component**, which is why
  the result often looks like a styling bug rather than a stale one.
- Two `vite` processes are running at once, from two terminals, and the one
  answering port 5173 is not the one you think.

**The fix, every time, in order:**

```bash
# 1. Find and stop every dev server
ps -o pid,etime,args -C node | grep -E 'vite|api/dist'

# 2. Stop them by PID, from that list. Never by pattern:
#    `pkill -f vite` matches the shell running it and kills your terminal.
kill <pid> <pid>

# 3. Free the API port if something is still holding it
fuser -k 3001/tcp

# 4. Throw away Vite's cache
rm -rf node_modules/.vite apps/web/node_modules/.vite

# 5. Start again, API first
npm run dev:api          # terminal 1
npm run dev:web          # terminal 2
```

**How to know you are actually running what you think.** Compare how long the
servers have been up against the last commit:

```bash
ps -o pid,etime,args -C node | grep -E 'vite|api/dist'
git log -1 --format='%ci'
```

If a server has been running longer than the age of the newest commit, it
predates your code. That is the whole check, and it takes five seconds.

---

### 1.3 Proving a specific change is live

Guessing from the screen is how the wrong thing gets diagnosed. Ask the server.

```bash
# The catalogue figures (PR 57). Must name both universities.
curl -s localhost:3001/api/catalogue

# The reviews on the ULB demo course: 4 pages of 10, 35 in total.
curl -s 'localhost:3001/api/courses/ulb/info-f101/reviews' \
  | python3 -m json.tool | head -20

# The administrator's settings (PR 59). Needs a session first.
curl -s -c /tmp/j.txt -o /dev/null -X POST localhost:3001/api/session/dev
curl -s -b /tmp/j.txt localhost:3001/api/moderation/settings
# {"settings":[{"key":"ryc.reviewsPerPage","min":3,"max":50,"fallback":10,...}]}
```

A signed-out call to the settings route answers **404 on purpose**, not 401: an
address that only exists for an administrator should not announce itself. So
404 there does not mean the route is missing; sign in first and ask again.

---

### 1.4 When the database is the problem

```bash
sudo service postgresql status      # is it even running
sudo service postgresql start

npm run db:migrate                  # apply any migration you just pulled
npm run db:grant-local              # after a migration, or reads start failing
npm run db:verify-isolation         # 32 assertions, ends with a plain verdict
```

Counts, if a demo course looks empty:

```bash
psql -d studens -c 'select count(*) from ryc."ReviewAttributed";'
psql -d studens -c 'select count(*) from ryc."ReviewAnonymous";'
psql -d studens -c 'select count(*) from ref."Course";'
```

The two seeded demo courses, which should stay seeded:

| course | path | reviews | pages |
|---|---|---|---|
| ULB, Programmation | `/fr/app/ryc/c/ulb/info-f101` | 35 | 4 |
| UCLouvain, Projet 3 | `/fr/app/ryc/c/uclouvain/lepl1503` | 50 | 5 |

---

### 1.5 Everything else worth having on hand

```bash
npm run gates            # typecheck, lint, 746 tests, schema, doc links
npm run gates:db         # the above against a real database, plus isolation
npm run build            # the production artefact: API, worker, application
npm start                # run that artefact, serving the app from the API

npm run ingest                              # re-crawl UCLouvain
npm run ingest -- --source ulb --prose      # re-crawl ULB, long fields too
npm run db:load -- --in data/catalogue.json # load a snapshot
npm run catalogue:report                    # what the crawl lost, if anything
```

**Do not run an ingest before a demonstration.** UCLouvain takes about 78
minutes and ULB about 75, and a half-finished crawl is not loaded, so there is
nothing to gain and a live catalogue to lose.

---

## 2. What is real, and what is not

Say this early. It is the difference between a demonstration and a sales pitch,
and the room will find out anyway.

| | |
|---|---|
| **Real** | The catalogue. 12,154 courses and 1,055 programmes across UCLouvain and ULB, scraped from each university's own site, with a link to the official page on every course |
| **Real** | Everything the software does: submission, anonymity, moderation, the account, deletion, export |
| **Not real** | The reviews. 99 of them, all written by us while testing. No student has used this yet |
| **Not built** | Anything deployed. This runs on a laptop. There is no URL to give anybody today |
| **Not built** | Sign-in with a university account. Google works; Microsoft is written and not registered, which is the next thing |

Nothing on screen claims otherwise: the mock on the home page is labelled as an
example, and the two reviews in it say they are invented.

---

## 3. The demonstration, in order

Roughly fifteen minutes. Every path below is a real URL.

### 3.1 The public page, 2 minutes

`http://localhost:5173/fr/` and `/fr/modules`

The problem statement is the first thing on the page, in a student's words:
the same questions every year, answered on Discord, gone in three weeks.

On `/modules`, point at the chips: `UCLOUVAIN · ULB · 12 093 cours ·
976 programmes · année académique 2026-2027`. **Those are fetched, not typed.**
Worth saying out loud, because the page used to state 546 courses from when the
crawl covered one faculty, and nobody noticed for weeks.

### 3.2 Finding a course, 3 minutes

`http://localhost:5173/fr/app/ryc`

Two ways in, and the screen says which is which: browse when you know your
programme, search when you know the course.

- **Browse** shows the programmes of your universities only, with counts
  computed inside that set. The panel filters by type, campus, faculty and
  field of study, and every filter is in the address, so a filtered list can be
  sent to somebody.
- **Search**: type `programmation`. Results arrive filtered by quarter,
  credits, language and campus.

Press Back a few times. Nothing is lost: filters, search and the page you were
on are all in the URL.

### 3.3 A course page, 4 minutes

**For an ULB room:** `http://localhost:5173/fr/app/ryc/c/ulb/info-f101`
(Programmation, 35 reviews)

**For a UCLouvain room:** `.../c/uclouvain/lepl1503` (Projet 3, 50 reviews)

- The facts at the top come from the university: credits, term, language,
  lecturers, contact hours, campus.
- The long fields fold. Open **Évaluation**: that is the official assessment
  method with its weightings, scraped. **Nobody is asked to type this in.**
  Open a link with `?ouvert=evaluation` and it opens there, so a section can be
  linked to.
- Below it, the reviews. Ten to a page, with the average, the split between
  signed and anonymous, and a pass band rather than a percentage.

### 3.4 Writing one, and the choice that matters, 4 minutes

Press **Donner mon avis** on that course.

The form asks only what the catalogue cannot answer: the year you took it, a
recommendation, workload against credits, difficulty, and the text.

Then the fork, which is the part worth slowing down for:

- **Under your name**, editable afterwards.
- **Anonymous**, and the screen tells you before you choose how many signed and
  how many anonymous reviews already exist on that course, because that is the
  number that decides your own exposure and only you know your cohort size.
- Anonymous is **irreversible**, and the confirmation says so. There is no
  column joining an anonymous review to an account, so nobody can withdraw it
  for you, including us.

### 3.5 What happens when something is wrong, 2 minutes

Any review, **Signaler**. It works signed out, which the Digital Services Act
requires.

Then `http://localhost:5173/fr/app/moderation` as an administrator: the queue
oldest first (never most-reported, which is what a pile-on buys), the decision
with a reason, the appointment of moderators, the settings, and the suspension
of an account.

---

## 4. Showing that the promise is enforced, not asserted

This is the part that separates this from a product that says "we respect your
privacy". Two commands, in a terminal, on the projector.

```bash
npm run db:verify-isolation
```

32 assertions. Each one tries something as a specific database role and expects
to be allowed or refused. It ends with:

> isolation verified: every grant and every absent grant behaves as intended

Explain what it proves: the module that stores reviews **cannot read the member
table**. Not "does not", cannot. The database refuses it.

```bash
npm run gates
```

746 tests, including a schema test that fails if any column in the anonymous
review table could ever hold a member identifier.

Then, if anybody asks whether the anonymity is real:

```bash
psql -d studens -c '\d ryc."ReviewAnonymous"'
```

There is no member column. There is nothing to join on.

---

## 5. Questions, and honest answers

**Is this official? Does ULB know?**
No, and deliberately. Studens is independent, affiliated with no university,
and the footer says so on every page. That means nobody has to approve it, and
also that it cannot promise anything on the university's behalf.

**Where do the course descriptions come from?**
Each university's own public pages, read automatically and refreshed. Every
course links to the official page, which is the one that counts. Nothing is
retyped, so nothing drifts from the source by hand.

**Can a lecturer find out who wrote a review?**
Not for an anonymous one, and not from us either: there is no stored link
between an anonymous review and an account. For a signed one, the name is on
it, which is the point of signing it.

**Then how do you stop abuse if you cannot identify anyone?**
Content can be reported, held and removed, one piece at a time. An account can
be suspended. What cannot be done is sanctioning the author of an anonymous
review, because nobody knows who they are. That is a real cost of the design
and we would rather state it than pretend.

**What stops someone writing fifty fake reviews?**
A quota per account, and one review per course per person on the signed path.
Both bound accounts rather than people: registration is open, because there is
no student roster anybody could give us. They are speed bumps, not guarantees,
and we will not describe them as more.

**If I am the only anonymous review on a small course, am I identifiable?**
Possibly, and the product tells you that before you choose rather than after.
Signed reviews narrow the field for anonymous ones, which is worst in small
cohorts. You see both counts at the moment of choosing.

**Can I delete my account?**
Yes, without asking anybody, with an export first. Signed reviews are detached:
the text stays and the name goes. Anonymous ones cannot be removed, because
there is nothing linking them to you, and you were told that before publishing.

**Is it GDPR compliant?**
The reasoning is written down in the requirements and is not a lawyer's. The
serious exposure is reviews naming a lecturer, which is a third party's
personal data. Anonymous contributions fall outside the GDPR under Recital 26.
This needs professional review before launch and has not had it.

**When can I use it?**
Not today. It needs a host, a domain and Microsoft sign-in so that a university
account works. That is the next work.

**How much does it cost, and who pays?**
Nothing to use. It is one person's project on a personal budget, with no
advertising and no selling of data, and the code is public under MIT so that
claim is checkable.

---

## 6. What to do with what the room says

Write it down during the session, not after. The two questions worth asking
them, because nothing in the product answers them yet:

- Would you write a review, and under your name or anonymously?
- What would you want to read that is not there?

The second one is the roadmap. `docs/requirements.md` section 7 is where an
answer becomes an open question rather than a feature nobody asked for.

---

## 7. When something breaks, at a glance

Read the symptom, do the fix. Do not diagnose from the screen: the screen is
what is lying to you.

| What you see | What it is | What to type |
|---|---|---|
| A change you merged is not there. Unstyled buttons, a missing icon, an old number | Stale dev server, or two of them | `ps -o pid,etime,args -C node`, `kill <pid>`, `rm -rf node_modules/.vite`, start both again (1.2) |
| The page is blank, or "Element type is invalid" | Same thing: a stale module beside fresh code | The same. It is almost never the code |
| `EADDRINUSE` on 3001 | An API is already running | `fuser -k 3001/tcp`, then `npm run dev:api` |
| Your terminal dies when you stop a server | `pkill -f` matched the shell running it | Kill by PID, or by port. Never by pattern |
| Everything 500s, or reads fail after a `git pull` | A migration arrived and has not been applied | `npm run db:migrate && npm run db:grant-local` |
| `Can't reach database server` | PostgreSQL is not running | `sudo service postgresql start` |
| A course page shows no reviews | Wrong course, or the database was reset | Check the counts in 1.4, and use the two seeded courses |
| The catalogue figures look wrong on the public page | They are fetched, so the API is the source | `curl -s localhost:3001/api/catalogue` and compare |
| `/api/moderation/settings` gives 404 | Correct when signed out; the route hides itself | Sign in as an administrator first (1.3) |
| Sign-in does nothing | Only Google is registered; Microsoft is not | Use the DEV button, or Google |
| A screenshot looks cut off at the right | The window was clamped to a minimum width | Measure the DOM, not the picture. Screenshots lie about width |

**The single most useful check**, when anything at all looks wrong:

```bash
ps -o pid,etime,args -C node | grep -E 'vite|api/dist'
git log -1 --format='%ci'
```

A server older than your newest commit is running code you have not got.
