# Commands

Every command you need, grouped by what you are trying to do. `CONTRIBUTING.md`
explains *why* things are the way they are; this one is *what to type*.

Everything runs from the repository root, `~/projects/studens`, inside WSL.

---

## Start here, every time

Four steps, in this order. Steps 2 and 3 are only needed after pulling a change
that touched migrations or the catalogue, so most days it is 1 and 4.

```bash
# 1. PostgreSQL. The one thing that needs sudo, because it is a system service.
sudo service postgresql start

# 2. Only after pulling a migration.
npm run db:migrate
npm run db:grant-local

# 3. Only the first time on a machine, or to refresh the catalogue.
npm run ingest -- --faculty epl
npm run db:load

# 4. The app. Two terminals.
npm run dev:api      # terminal 1, http://localhost:3001
npm run dev:web      # terminal 2, http://localhost:5173
```

Then open **<http://localhost:5173>**.

**The API must be running before the web app is useful.** The browser only ever
talks to 5173, which proxies `/api` to 3001; with the API down every page loads
and nothing in it works, which looks like a frontend bug and is not one.

To stop them, kill by port and never by pattern:

```bash
fuser -k 3001/tcp 5173/tcp
```

### Every script, and what it is for

The complete list. Anything not here does not exist, whatever it looks like it
should be called.

| Command | What it does |
|---|---|
| **Running it** | |
| `npm run dev` | API and web together in one terminal. Harder to read the logs |
| `npm run dev:api` | The API, with the development sign-in. Port 3001 |
| `npm run dev:api:anon` | The API with **no** development identity: what a signed-out visitor sees |
| `npm run dev:web` | Vite, port 5173. Proxies `/api` to 3001 |
| `npm run mail` | Drain the mail outbox. Prints each message when no relay is configured. `-- --watch` loops every 30 seconds |
| **Before you push** | |
| `npm run gates` | The whole no-database gate. What CI's `gates` job runs |
| `npm run gates:db` | The database half. What CI's `database` job runs |
| `npm run typecheck` | `tsc --build`, plus the two `--noEmit` passes for `ryc-ui` and `web` |
| `npm run lint` | ESLint, including the FR-B6 boundary rules |
| `npm run test` | Vitest. **Silently skips** the database tests when PostgreSQL is down |
| `npm run test:db` | Vitest where an unreachable database is a hard failure instead of a skip |
| `npm run schema:validate` | The Prisma schema is valid. Connects to nothing |
| `npm run docs:links` | Every path a tracked file mentions exists and is tracked |
| **Database** | |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:grant-local` | Let your user assume the three module roles, so `SET ROLE` works |
| `npm run db:verify-isolation` | Assert every module role can and cannot do exactly what it should |
| `npm run db:reset` | **Destructive.** Drops and rebuilds: you lose the catalogue and every review |
| **Catalogue** | |
| `npm run ingest` | Scrape into `data/catalogue.json`. Takes `-- --source ulb` (default `uclouvain`, and a non-default source writes `data/catalogue-<source>.json` instead), `-- --faculty epl,lsm`, `-- --year 2025`, `-- --max 40` (sample), `-- --max-requests 1500` (ceiling), `-- --no-cache`, `-- --prose` (ULB only: a second pass for the long fields, one request per course) |
| `npm run db:load` | Load that snapshot into PostgreSQL, in one transaction. The file says which institution it is a crawl of, so a second catalogue needs no extra flag. **Refuses a load that would remove more than a fifth of that institution's catalogue**, which is what a sampled crawl produces; `-- --shrink-ok` says you meant it |
| `npm run catalogue:report` | **After any crawl:** what the crawl lost and whether the database holds it. Writes `data/catalogue-report.txt`. Exit 1 when something is missing |
| **Build and run for real** | |
| `npm run build` | Everything a server needs: the API, the worker, and the application |
| `npm run build:api` | Compile the API. Run for you by `dev:api` |
| `npm run build:worker` | Compile the worker. Run for you by `ingest`, `db:load` and `mail` |
| `npm run build:web` | Vite's production build, into `apps/web/dist` |
| `npm start` | Run the built artefact: one process serving the API **and** the application. See "Deploying" |

Two of those behave differently from how they read, and both have cost time:

- **`npm run test` passes with no database**, skipping about a hundred tests and
  saying so only in a line most people scroll past. `npm run test:db` is the one
  that refuses to be quiet about it.
- **`npm run db:reset` is not a repair tool.** It drops everything, including
  every review submitted while testing.

---

## First time on a machine


```bash
git clone git@github.com:Lord-Melflam/Studens.git ~/projects/studens
cd ~/projects/studens
npm install

npm run gates                 # should pass with no database at all
```

Then the database. **There is no password to manage**: the local connection uses
the unix socket with peer authentication, so PostgreSQL trusts your operating
system user.

```bash
sudo service postgresql start
sudo -u postgres createuser --createdb --createrole "$USER"
sudo -u postgres createdb -O "$USER" studens

cp .env.example .env          # the defaults work as they are
npm run db:migrate            # create the schemas, tables, roles and grants
npm run db:grant-local        # let your user assume the three module roles
npm run gates:db              # migrate, grant, verify isolation, run the DB tests
```

Then real data. The first crawl takes a few minutes and is polite about it;
every page is cached afterwards, so a second run takes about nine seconds and
makes no requests.

```bash
npm run ingest -- --faculty epl     # scrape uclouvain.be into data/catalogue.json
npm run db:load                     # load that snapshot into PostgreSQL
```

---

## Running it

Two terminals.

```bash
npm run dev:api               # terminal 1, http://localhost:3001
npm run dev:web               # terminal 2, http://localhost:5173
```

Then open **<http://localhost:5173>**.

**Never `sudo` anything in this repository.** `sudo` is right for starting
PostgreSQL, which is a system service, and wrong for everything else here. It
breaks two things at once:

- **It uses a different Node.** `sudo` resets `PATH` to `secure_path`, so it
  picks `/usr/bin/node`, which on this machine is **v12.22.9**, not the v22 you
  installed with nvm. Node 12 does not understand `??`, and that token is inside
  TypeScript's own compiled code, so the build dies with
  `SyntaxError: Unexpected token '?'` pointing at a file you never wrote.
- **It changes who the database thinks you are.** The local connection uses peer
  authentication over the unix socket, so PostgreSQL trusts the operating system
  user. Under `sudo` that user is `root`, which is not a role with access to
  `studens`, so even a successful build would fail to connect.

Nothing in this project needs root. Port 3001 is above 1024, and the database
grants your own user everything it needs.

| URL | What it is |
|---|---|
| `http://localhost:5173/` | redirects to your browser's language |
| `http://localhost:5173/fr` `‧/nl` `‧/en` | the public site |
| `http://localhost:5173/fr/modules` | what each module does |
| `http://localhost:5173/fr/connexion` | sign in |
| `http://localhost:5173/fr/app` | the app, behind a session |
| `http://localhost:3001/api/health` | the API, on its own |

The web server proxies `/api` to port 3001, so the browser only ever talks to
5173. Run both or nothing works.

### Variants

```bash
npm run dev                   # both at once, one terminal, harder to read the logs
npm run dev:api:anon          # API without the development identity: what a
                              # signed-out visitor sees
```

`dev:api` sets `STUDENS_DEV_IDENTITY=1`, which is why a sign-in button appears
without any OAuth credentials. Watch the second line it prints at startup:

```
api listening on http://localhost:3001 (catalogue: database)
  .env: loaded  |  sign-in providers: none configured
```

That line is how you know whether `.env` was read and which providers are
configured. `none configured` with credentials in `.env` means a name is
misspelled, or only half a pair is set.

### Stopping them

```bash
fuser -k 3001/tcp             # the API
fuser -k 5173/tcp             # the web server
ss -lntp | grep -E ':3001|:5173'   # what is still listening
```

**Kill by port, never by pattern.** `pkill -f node` matches the shell running the
command, because that command line contains the pattern, and kills your own
terminal. This has cost three shells.

---

## Before you push

```bash
npm run gates                 # typecheck, lint, tests, schema. No database needed
npm run gates:db              # migrate, grant, isolation, database tests
```

Both must pass. CI runs the same two.

Individually, when you are iterating:

```bash
npm run typecheck
npm run lint
npm run test                  # all tests; database ones skip if none is reachable
npm run test:db               # same, but a missing database is a FAILURE
npx vitest run test/ui        # one directory
npx vitest run -t "quota"     # tests whose name matches
npx vitest watch test/kernel  # rerun on save
```

`npm run test` skips the database tests silently when there is no database.
`npm run test:db` sets `STUDENS_REQUIRE_DB=1`, which turns that skip into a
named failure. Use it when you expect them to run.

---

## Where the project stands

```bash
npm run state                 # counts everything countable, about 20 seconds
npm run state -- --quick      # same, without running the test suite
```

Commits, requirements, open questions, tests, lines, and the catalogue and
review figures. Counted when you ask, from the repository and the database.

**None of these numbers is written down anywhere**, and that is deliberate.
The state table in `TIMELINE.md` used to hold six of them; it was corrected by
hand on 2026-09-19 and was wrong again two merges later, which is what a
maintained number does. Phase 47 has the reasoning.

It runs the test suite rather than counting `it(` in the source, because tests
are generated in loops in two files and a static count would be a guess that
looks like a fact. `--quick` skips that and says so instead of printing a
number from nowhere.

With no database reachable it prints the repository figures and says the
catalogue and review ones are not shown. There is no cache: a figure from the
last run is the problem this command exists to remove.

---

## The database

```bash
psql -d studens                       # a shell
psql -d studens -c 'SELECT ...'       # one statement
```

Useful one-liners:

```bash
# what exists
psql -d studens -c '\dt platform.*'
psql -d studens -c '\dt ref.*'
psql -d studens -c '\dt ryc.*'
psql -d studens -c '\d ryc."ReviewAnonymous"'

# how much catalogue is loaded
psql -d studens -c 'SELECT count(*) FROM ref."Course"'
psql -d studens -c 'SELECT code, title FROM ref."Course" c JOIN ref."CourseOffering" o ON o."courseId"=c.id LIMIT 5'

# reviews, and the quota that bounds them
psql -d studens -c 'SELECT count(*) FROM ryc."ReviewAttributed"'
psql -d studens -c 'SELECT count(*) FROM ryc."ReviewAnonymous"'
psql -d studens -c 'DELETE FROM platform."MemberQuota"'    # give yourself a fresh window
```

Schema changes:

```bash
npx prisma migrate dev --name what_changed   # write a migration from schema.prisma
npm run db:migrate                            # apply pending migrations
npx prisma generate                           # regenerate the client after editing the schema
npm run schema:validate                       # validate without a database
```

**After editing `prisma/schema.prisma`, run `npx prisma generate`.** Until you
do, TypeScript still sees the old columns and the errors make no sense.

Starting over:

```bash
npm run db:reset              # DROPS EVERYTHING and re-migrates
npm run db:grant-local
npm run db:load               # reload the catalogue from data/catalogue.json
```

Checking the security boundary:

```bash
npm run db:verify-isolation   # 15 assertions: every grant, and every absent grant
```

It prints one line per check and exits non-zero on any surprise. Each check
asserts which role it is running as before doing anything, because the first
version of it passed while proving nothing.

---

## The catalogue

```bash
npm run ingest -- --faculty epl              # everything reachable from EPL
npm run ingest -- --faculty epl --max 40     # a slice, while working on the parser
npm run ingest -- --year 2024                # a past year, via the archive portal
npm run ingest -- --no-cache                 # ignore data/page-cache and refetch
npm run ingest -- --delay 500                # milliseconds between requests
npm run ingest -- --out /tmp/try.json        # somewhere other than data/catalogue.json

npm run db:load                              # data/catalogue.json into PostgreSQL
npm run db:load -- --in /tmp/try.json
```

### A second institution

```bash
npm run ingest -- --source ulb               # writes data/catalogue-ulb.json
npm run ingest -- --source ulb --prose       # and the long fields: much slower
npm run ingest -- --source ulb --max 200     # a slice, while working on it
npm run db:load -- --in data/catalogue-ulb.json
npm run catalogue:report -- --snapshot data/catalogue-ulb.json
```

**The report is per institution, and so is its output file.** A snapshot is one
institution's crawl, so `catalogue:report` scopes every database query to the
institution the snapshot names, and writes
`data/catalogue-report-<institution>.txt` for anything but UCLouvain. Without
the scoping the counts would mix two universities and the "in the database and
not in this snapshot" check would list the whole of the other one.

Run it once per snapshot. `npm run catalogue:report` with no argument still
reports on UCLouvain, which is what it always meant.

### Both universities at once

The two crawls hit different hosts and write different files, so they can run
side by side. **Build once first**, because `npm run ingest` compiles the worker
before it starts and two concurrent `tsc --build` runs race over
`apps/worker/dist`:

```bash
npm run build:worker                                        # once, first

# then one terminal each, calling node directly so neither rebuilds
node apps/worker/dist/ingest-catalogue.js --source ulb --prose
node apps/worker/dist/ingest-catalogue.js

# then, sequentially, once both have finished
npm run db:load -- --in data/catalogue.json
npm run db:load -- --in data/catalogue-ulb.json
npm run catalogue:report
npm run catalogue:report -- --snapshot data/catalogue-ulb.json
```

Measured 2026-09-18: ULB with `--prose` took 75 minutes and 5,290 requests for
286 programmes and 5,439 courses. UCLouvain's full crawl takes about 78. They
share `data/page-cache` safely, because a cache key includes the host.

`--source` defaults to `uclouvain`, so every command written before there was a
second one still means what it meant. A non-default source writes to its own
file rather than `data/catalogue.json`: a snapshot holds ONE institution's
crawl, and two sources writing to one path would each erase the other.

`db:load` needs no flag saying whose crawl it is. The file says so itself since
snapshot version 9, and the option still wins when given.

**ULB is about 580 requests and a few minutes**, against UCLouvain's ten
thousand and 78 minutes. The difference is where the two publish their course
lists: ULB's programme listing carries the code, title, language, quadrimester,
lecturers, credits and teaching hours for every course, so the crawl asks once
per programme rather than once per course. The three long prose fields, content,
objectives and the assessment method, live only on ULB's course pages and are
**not** fetched unless you pass `--prose`, which reads one page per course:
about 5,400 requests against 286, so it is asked for rather than assumed. A run
without it is still a whole catalogue, and the snapshot says which fields it did
not go looking for so the "a field empty everywhere" guard stays armed for
every other one.

`themes` is never collected for ULB. It publishes objectives, prerequisites and
teaching methods, and none of them is UCLouvain's "Thèmes abordés": putting one
in that column would make the field mean two things depending on which
university a row came from.

**Keep `data/page-cache`.** It is gitignored, so a fresh clone or a new worktree
has none, and an ingest then re-crawls 546 pages instead of finishing in nine
seconds. Copy it across rather than making uclouvain.be serve it again.

The whole run writes a complete new snapshot and only replaces the live one if
everything succeeded, so a broken crawl cannot empty a course page.

---

## Git, day to day

```bash
git switch main && git pull
git switch -c wil/what-you-are-doing

# ... work, committing as you go ...

npm run gates && npm run gates:db
gh pr create --fill
```

Nothing reaches `main` except through a pull request: one approval from someone
who is not the author, and both CI jobs green.

```bash
gh pr list                    # what is open
gh pr checks 7                # CI on one PR
gh pr view 7 --json mergeStateStatus,reviewDecision --jq .
gh run list --limit 5         # recent CI runs
gh pr diff 7
```

Working on two things at once, without disturbing a running dev server:

```bash
git worktree add ../studens-other -b fm/other main
cd ../studens-other && npm install        # worktrees do not share node_modules
git worktree remove ../studens-other      # when finished
```

Two caveats for worktrees here: there is **one** local PostgreSQL and one `.env`,
so two worktrees running migrations fight over the same database; and
`data/page-cache` is not shared, so copy it or the ingest re-crawls.

---

## Signing in locally

Without OAuth credentials, the development identity is the only way in.

```bash
curl -s localhost:3001/api/session                    # who am I
curl -s -c /tmp/jar -X POST localhost:3001/api/session/dev   # sign in, keep the cookie
curl -s -b /tmp/jar localhost:3001/api/session
curl -s -b /tmp/jar localhost:3001/api/sessions       # FR-A5, your live sessions
curl -s -b /tmp/jar -X DELETE localhost:3001/api/session     # sign out
```

In the browser, the header carries a **se connecter · dev** button that does the
same thing.

With real credentials in `.env`, `GET /api/auth/providers` lists what is
configured and the sign-in page shows a button per provider. Registering the two
applications is walked through in `design/authentication.md`, Appendix A.

### After a full crawl, always

A full crawl is about 9,000 requests over roughly two hours, and the things that
go wrong in it are individually small: one course page the server would not
serve, one programme whose course list never loaded. Each one is a student who
cannot find their course, and the line that mentioned it scrolled past an hour
ago.

```bash
npm run catalogue:report
```

It reads the snapshot and the database, compares them, and ends with one line
saying whether anything is missing. It writes the same to
`data/catalogue-report.txt`, changes nothing, and exits 1 when there is a gap,
so it can gate a deployment without anybody reading it.

Three things it calls a **gap**, meaning somebody will not find their course:
a programme whose course list never loaded, a course page the university would
not serve, and a course parsed into the snapshot that never reached the
database. A programme that simply lists no courses is a **note**, not a gap:
`prog-2025-cyse2m` is a joint master whose courses are hosted by the partner
institutions, and all three of its pages are legitimately empty.

---

## The first administrator

Every appointment needs an administrator to make it, so the first one cannot be
made in the product: a fresh database has nobody who can appoint anybody and the
moderation console stays unreachable.

Sign in, finish the first run so the account has a username, then:

```bash
npm run admin -- <username>        # the username, not an email address
```

It works once. With an administrator in place it refuses, and everybody else is
appointed from the console, where the appointment is recorded against the
administrator who made it. The bootstrap is recorded too, with the operator as
the actor, because no member made it.

There is no route that does this, on purpose. An endpoint that promotes somebody
while no administrator exists is open to whoever reaches it first, and
registration is public (FR-A6). Reaching the database is the check.

### If you have been demoted and cannot reach the console

```bash
npm run admin -- <username> --force
```

Administrators are peers. `setRole` refuses only two things, changing your own
role and demoting the last administrator, and both exist to prevent the one
state that needs a database to undo. Neither is about seniority, so with two
administrators each can demote the other.

That is ordinary, and it stays. What was not ordinary is that the demoted one
had no way back except editing a row by hand, so `--force` appoints past the
bootstrap's check and records it against the operator, exactly as the bootstrap
does. It takes nothing away from whoever else holds the role.

**It grants nothing that was not already there.** Running it needs the
database, and anybody holding the database can write any row, so the choice is
between a recorded command and a silent `UPDATE`. FR-E17 has the alternatives
that were rejected and what would change the answer.

---

## Mail

Nothing is sent inside a request (FR-H5). The app writes a row into
`platform.MailOutbox` and the worker delivers it.

```bash
npm run mail               # send what is queued, once
npm run mail -- --watch    # keep going, every 30 seconds
```

**With no relay configured nothing is sent, and that is the default.** The
messages are still queued, so nothing is lost and they go out the day a relay
exists. The worker **prints each one in full**, which is how the confirmation
link for an address change is clicked with no mail server at all:

```bash
# change the address in /app/moi, then
npm run mail               # the link is in the printed message; open it
```

The account screen says this too rather than claiming a message is on its way.
That was a real bug: it said "A message has gone to ..." while the row sat
queued and undeliverable, so somebody waited for a link that was never coming.

**The queue also holds moderation messages**, `account.suspended` and
`account.reinstated`, and those go to somebody who has just lost access. With
no relay they are printed like the rest, so the screen at the next sign-in is
the only half of FR-E15 that reaches anybody. The console says which of the two
happened rather than claiming the person was told, and this is the same answer
from the other side:

```bash
psql -d studens -c "select kind, \"createdAt\" from platform.\"MailOutbox\" \
  where kind like 'account.%' order by \"createdAt\" desc limit 5;"
```

Nothing is queued at all for an account with no confirmed contact address, by
FR-A13: an unconfirmed address is as likely to be a typo pointing at a stranger
as it is to be theirs.

To actually deliver, set the five `STUDENS_SMTP_*` variables in `.env`. Any
plain SMTP relay works; `.env.example` walks through the zero-budget starting
point, which is a Gmail account with an app password.

```bash
psql -d studens -c 'select kind, "toAddress", "sentAt", attempts, "lastError" \
  from platform."MailOutbox" order by "createdAt" desc limit 10;'
```

A row with `attempts` at 5 and a `lastError` has given up and wants a person.

---

## Poking the API directly

```bash
curl -s localhost:3001/api/health
curl -s localhost:3001/api/catalogue
curl -s 'localhost:3001/api/courses?q=lepl'
curl -s localhost:3001/api/courses/lepl1503 | python3 -m json.tool
curl -s localhost:3001/api/faculties
curl -s localhost:3001/api/programmes/sinf1ba/courses

curl -s localhost:3001/api/courses/lepl1503/reviews | python3 -m json.tool
curl -s localhost:3001/api/courses/lepl1503/review-context

# submit one (needs the cookie from above)
curl -s -b /tmp/jar -X POST localhost:3001/api/courses/lepl1503/reviews \
  -H 'content-type: application/json' \
  -d '{"academicYear":2024,"recommendation":4,"workloadVsEcts":3,"difficulty":3,
       "body":"'"$(printf 'x%.0s' {1..90})"'","completed":true,"anonymous":false}'
```

The anonymous path returns `{"anonymous":true}` with **no id**, deliberately
(FR-C9). The attributed path returns one.

---

## Environment variables

All optional for local work except where noted. They live in `.env`, which is
gitignored; `.env.example` carries the names with empty values and is the only
tracked copy. **Never put a real secret in `.env.example`, and never paste one
into a chat or a pull request.**

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Set by `.env.example`. The unix socket default needs no password |
| `PORT` | API port, default 3001 |
| `STUDENS_DEV_IDENTITY` | `1` enables the development sign-in. Refused when `NODE_ENV=production` |
| `STUDENS_SESSION_SECRET` | Signs the sign-in state cookie. **Required in production**, the process refuses to start without it. `openssl rand -base64 32` |
| `STUDENS_MS_CLIENT_ID` / `_SECRET` | Microsoft OAuth. Both or neither |
| `STUDENS_GOOGLE_CLIENT_ID` / `_SECRET` | Google OAuth. Both or neither |
| `STUDENS_PUBLIC_ORIGIN` | Where the provider redirects back. Must match what you registered |
| `STUDENS_APP_ORIGIN` | Where a visitor lands after signing in |
| `STUDENS_SECURE_COOKIES` | `1` when served over HTTPS: adds `Secure` and the `__Host-` prefix |
| `STUDENS_WEB_ROOT` | Where the built application is. Defaults to `apps/web/dist` beside the API, and is skipped when it is not there |
| `STUDENS_DEV_HOST` | Hostnames other than localhost allowed to reach the dev server, comma separated. A leading dot covers subdomains. Empty by default; see "Showing it to somebody else" |
| `STUDENS_CONTACT_EMAIL` | Where somebody writes about a moderation decision. Printed in the suspension message and shown on the suspension screen. Unset means both state the reason and offer nowhere to write, which beats an address that bounces |
| `CATALOGUE_SNAPSHOT` | Read the catalogue from a file instead of the database |
| `STUDENS_REQUIRE_DB` | Tests only. `1` makes an unreachable database a failure rather than a skip |

---

## Showing it to somebody else

Nothing is deployed, so the only way to put this in front of a person who is
not at this keyboard is a tunnel from this machine. Any tunnel works; it
forwards a public hostname to `localhost:5173`.

**Vite refuses a `Host` header it does not recognise**, which is what stops
somebody else's DNS name being pointed at a developer's machine, so the tunnel
hostname has to be named:

```bash
STUDENS_DEV_HOST=.example-tunnel.dev npm run dev:web
```

A leading dot means the domain and its subdomains. Without it every request
comes back "Blocked request. This host is not allowed."

**Run the API WITHOUT the development identity:**

```bash
npm run dev:api:anon          # not dev:api, and not npm run dev
```

This matters more than the tunnel. `dev:api` and `dev` both set
`STUDENS_DEV_IDENTITY=1`, and that sign-in button issues a real session as the
development member, which on a working machine is usually an **administrator**.
Reachable from the public internet, one press hands a stranger the moderation
console, the suspension controls and the settings, against whatever is in the
local database. A visitor still sees the public site and the whole catalogue,
which is most of what there is to show.

**Sign-in through a tunnel needs three more things**, and is worth doing only
if the tunnel is more than a one-off: the tunnel URL registered as a redirect
URI with the provider, `STUDENS_PUBLIC_ORIGIN` and `STUDENS_APP_ORIGIN` set to
it, and `STUDENS_SECURE_COOKIES=1` because the tunnel is HTTPS. Left alone, the
provider sends the visitor back to their own `localhost` and sign-in fails.

**It is this machine.** The tunnel serves the real local database, with its
real accounts and reviews, for as long as it is open. Close it when the
demonstration is over.

---

## Deploying

One process serves both the API and the application. In development Vite serves
the app on 5173 and proxies `/api` to 3001; in production there is no Vite, so
the web process serves the built files itself and answers any unknown path with
`index.html`. Without that, a refresh on any page but the root is a 404.

```bash
npm run build          # the API, the worker, and the application
npm run db:migrate     # on the target database
npm start              # node apps/api/dist/index.js
```

`npm start` prints what it found, and reading that line is the check:

```
api listening on http://localhost:3001 (catalogue: database)
  .env: absent  |  sign-in providers: Microsoft, Google
  web app: /srv/studens/apps/web/dist
```

`web app: not built` means the process is serving the API only, and every page
will 404. `sign-in providers: none configured` means nobody can sign in. Both
look identical to a healthy process until somebody opens a page, which is why
they are printed.

**Try it locally before trusting it anywhere.** `npm run build && npm start`
runs the exact artefact a server would run, with no proxy involved, so the thing
being deployed is the thing that was tested.

### What a host needs beyond this

Not yet done, and **none of the following has been run**, so treat it as a plan
rather than a procedure:

- A reverse proxy in front, for TLS. Let's Encrypt needs a hostname, so the
  domain comes first. The proxy terminates TLS and forwards everything to this
  process; it does **not** serve the static files, deliberately, so that only one
  place knows which paths belong to the application.
- `STUDENS_SECURE_COOKIES=1`, or the session cookie keeps the development
  settings over HTTPS.
- `STUDENS_PUBLIC_ORIGIN` and `STUDENS_APP_ORIGIN` both set to the real origin,
  and that origin's callback URLs added to the Microsoft and Google
  registrations. A redirect URI is compared character for character.
- `STUDENS_SESSION_SECRET`, or the process refuses to start.
- No `.env` on the server. Values come from the environment, and `loadDotEnv`
  already lets the real environment win.
- Something to keep the process up across a reboot, and a periodic request to
  `/api/health`, because the hosting decision in requirements 5.2 accepts idle
  reclamation as a risk and a health check is what answers it.

---

## The design documents

Three LaTeX sources under `docs/typeset/`, producing PDFs that are gitignored:
build them yourself. They share one preamble, `studens-preamble.tex`, so the
palette and the diagram styles exist once.

```bash
cd docs/typeset
xelatex stack-overview.tex  && xelatex stack-overview.tex    # twice, for the contents
xelatex frontend-design.tex && xelatex frontend-design.tex
xelatex backend-design.tex  && xelatex backend-design.tex
```

`stack-overview.tex` is the one to hand somebody who asks what the stack is: it
names every dependency, says what was deliberately left out and why, and walks
the five pipelines (a request, a review, the catalogue, mail, and the build)
end to end. The other two go deeper on one half each.

The logos those documents reference are fetched, never committed:

```bash
bash scripts/fetch-logos.sh
```

---

## When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on 3001 or 5173 | A previous server is still running | `fuser -k 3001/tcp` |
| The web page loads, every request fails | The API is not running | Start `npm run dev:api` |
| "the catalogue holds no offerings for year 0" | The database has no catalogue | `npm run ingest -- --faculty epl && npm run db:load` |
| Tests pass but a batch is **skipped** | No database reachable | `sudo service postgresql start`, then `npm run test:db`, which turns that skip into a failure |
| Prisma errors about columns that exist | The generated client is stale | `npx prisma generate` |
| `SET ROLE` permission denied | Your user is not a member of the module roles | `npm run db:grant-local` |
| The review form says a session is required | The API is running without the development identity | Use `npm run dev:api`, not `dev:api:anon` |
| `sign-in providers: none configured` | `.env` missing a name, or only half a pair | Check both `_CLIENT_ID` and `_CLIENT_SECRET` |
| A refresh on `/fr/a-propos` 404s in production | The server does not fall back to `index.html` | Only affects a real deployment; the dev server handles it |
| Your terminal died running `pkill` | The pattern matched the shell running it | Kill by port instead |
| `SyntaxError: Unexpected token '?'` from inside `node_modules/typescript` | You ran it with `sudo`, which used `/usr/bin/node` v12 instead of your nvm v22 | Drop the `sudo`. Only `service postgresql start` needs it |
| `EACCES ... '/root/.npm/_logs'` | Same cause: npm running as root | Drop the `sudo` |
| Connects to PostgreSQL as the wrong user, or is refused | `sudo` makes the socket's peer user `root` | Drop the `sudo`. Peer authentication trusts your own user, which is the point |
