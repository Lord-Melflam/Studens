# Commands

Every command you need, grouped by what you are trying to do. `CONTRIBUTING.md`
explains *why* things are the way they are; this one is *what to type*.

Everything runs from the repository root, `~/projects/studens`, inside WSL.

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
| `CATALOGUE_SNAPSHOT` | Read the catalogue from a file instead of the database |
| `STUDENS_REQUIRE_DB` | Tests only. `1` makes an unreachable database a failure rather than a skip |

---

## The design documents

Two are LaTeX and produce PDFs, which are gitignored: build them yourself.

```bash
cd docs/design
xelatex frontend-design.tex && xelatex frontend-design.tex   # twice, for the contents
xelatex backend-design.tex  && xelatex backend-design.tex
```

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
