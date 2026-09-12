# Contributing

New here? Read `TIMELINE.md` first for where the project stands, and
`LESSONS.md` for the failures that produced the rules you are about to work
under. Both are short, and the second will save you repeating something.

**`COMMANDS.md` is the command reference.** This file explains why the rules
exist; that one is what to type, including the things that are not `npm` scripts:
`psql` one-liners, `gh`, worktrees, and a table of what to do when something
breaks.

Studens is MIT licensed, inbound equals outbound, so no contributor agreement is
needed. Outside contributors are welcome as contributors: open a pull request.

All module code lives in this repository and is admitted by review before merge
(FR-B14). There is no plugin loader, no registry, and no runtime loading of
third-party code.

## Getting set up

Requires Node 22 or later and a PostgreSQL database.

```bash
npm install
npm run gates             # typecheck, lint, tests, schema validation. No database needed.
```

Then the database, which is a separate set of gates because it needs one:

```bash
sudo service postgresql start
sudo -u postgres createuser --createdb --createrole "$USER"
sudo -u postgres createdb -O "$USER" studens

cp .env.example .env      # the local default needs no password: see below
npm run gates:db          # migrate, grant, verify the isolation, run the kernel tests
```

**There is no password to manage locally.** `.env.example` connects over the unix
socket with peer authentication, so PostgreSQL trusts the operating system user.
Setting this project up involves no secret at all, which is the point.

`npm run db:grant-local` grants your user membership of the three module roles so
that `SET ROLE` works and the isolation checks can run. That is a local testing
affordance. In production each module gets its own credentials and its own
connection pool, so a connection cannot escalate at all.

Then, for real data:

```bash
npm run ingest -- --faculty epl   # scrapes uclouvain.be, politely. 546 courses
npm run db:load                   # the snapshot into PostgreSQL, in one transaction
npm run dev:api                   # terminal 1
npm run dev:web                   # terminal 2, then localhost:5173
```

The first crawl takes a few minutes and is polite about it. Every page is then cached
under `data/page-cache`, so a re-run costs about nine seconds and no requests at all. Use
`--max 40` for a smaller slice while working on the parser.

**`dev:api` sets `STUDENS_DEV_IDENTITY=1`.** Submission needs a Member (FR-C4) and FR-A is
not built, so without it the review form refuses to open and looks broken. The fence is in
the code, not the script: the variable must be set explicitly, it is refused when
`NODE_ENV=production` whatever else is set, and the process prints a warning naming FR-A
at every start. Production does not run this script. `npm run dev:api:anon` runs without
it, which is how to see what a signed-out visitor sees. Both go away when FR-A ships.

**Work inside the Linux filesystem, not on a Windows mount.** Measured on this
project: 300 small file writes took 0.03 s on ext4 and 4.0 s on `/mnt/c`, which
is 134 times slower. `node_modules` is tens of thousands of files.

## Editor

`.vscode/extensions.json` recommends four extensions, and VS Code offers to install
them on first open. Each one surfaces a gate in the editor rather than leaving it
to CI: ESLint shows FR-B6 boundary violations as you type, the Prisma extension
validates the schema where the anonymity invariant lives, the Vitest explorer runs
the two architecture gates, and Remote-WSL is how the project is opened at all.

Only that file is tracked. `.gitignore` ignores the rest of `.vscode`, so editor
settings stay personal and nobody's formatter is imposed on anyone else.

## Review is a security control, not a quality practice

FR-B14 made code review the boundary that every FR-C guarantee rests on: the
anonymity design holds because all code touching the database was read by
someone.

Two consequences.

**The automated gates must pass regardless of author** (FR-B15), including the
project owner. `npm run gates` runs the same checks CI does. Never merge past a
red gate because you wrote the change yourself, and never make a gate advisory:
`docs/design/architecture-style.md` section 9 records that the whole
architecture degrades to an unstructured monolith if FR-B6's gate becomes
optional.

**Branch protection on `main` requires both CI jobs.** Enabled 2026-09-11. It is
a repository setting rather than a file, so it is not version controlled and has
to be checked by hand: `gh api repos/Lord-Melflam/Studens/branches/main/protection`.

## How we work

Decided 2026-09-11, when the second developer joined. Until then the repository
had one developer and no protection at all, which is why none of this existed.

### The cycle, in five steps

```bash
git switch main && git pull                 # 1. start from main, always
git switch -c wil/moderation-queue          # 2. a branch per change
                                            # 3. work, committing as you go
npm run gates && npm run gates:db           # 4. both green before you ask anyone
gh pr create --fill                         # 5. a pull request, never a push to main
```

Branch names are `<who>/<what>`: `fm/oauth-microsoft`, `wil/moderation-queue`.
Nothing enforces it; it just makes `git branch -a` readable for the other person.

**Nothing lands on `main` except through a pull request.** One approval, from
someone who is not the author, and both CI jobs green. GitHub will not let you
approve your own, which is the point: FR-B14 makes review the security boundary,
and with two people mutual review is possible for the first time.

### What the protection actually enforces

| Rule | Why it is on |
|---|---|
| `gates` and `database` must pass | FR-B15. These are the checks that stand in for organisational independence. `database` runs the kernel tests, which until 2026-09-11 had never run in CI at all |
| Branch up to date with `main` first | Two green branches can still be red together. Cheap here: CI takes about 40 seconds |
| 1 approval, not from the author | FR-B14 |
| Approvals dismissed on new commits | An approval that survives a later push covers code nobody read |
| The last pusher cannot be the approver | Same reason, one step further |
| Code owner review on the paths in `.github/CODEOWNERS` | OPEN-18. See that file for which paths and why |
| Conversations resolved | A review comment that is merged unanswered was not a review |
| Linear history, no force push, no deletion | "Do not rewrite shared history" made mechanical |

**One deliberate hole: administrators are not bound by any of it.** François can
push straight to `main`. That is a choice made on 2026-09-11, not an oversight,
and `docs/requirements.md` FR-B15 records it as a deviation with what would close
it. Read it before concluding the rules are optional: they are not optional for
anyone who is not an administrator, and the discipline is expected of
administrators too.

### Merging

**Squash by default.** One commit on `main` per reviewed unit, which is what
"admitted by review before merge" means. The squashed commit takes the PR title
and the PR body, so write the body as the commit message you want to survive.
Merge commits are disabled. Rebase is available when every commit on the branch
is meaningful and self-contained; say so in the PR when you use it.

Branches are deleted on merge. Keep them short lived: a branch open for a week
is a branch that will conflict.

### Commit messages

Written for the other developer, not for a changelog.

- An imperative subject line, about 70 characters: `Add the review submission path, on both routes`.
- A body that says **why**, names the requirement IDs, and names what was
  rejected. Commit messages here routinely run twenty lines. That is deliberate:
  `git log` is where a decision is found six months later.
- No AI attribution of any kind. No em dashes, no double dashes.

**Conventional Commits (`feat:`, `fix:`) is deliberately not used.** It exists to
drive automated semantic versioning and changelogs; this project publishes no
package and cuts no releases, so it would add a prefix with no consumer and
shorten the part that actually carries the reasoning. If we ever publish
versioned releases, adopt it then.

### Worktrees

A personal convenience, not policy. `git worktree add ../studens-fix fm/fix`
gives you a second checkout so a long branch and an urgent fix can both be open.
Use it or do not. Three things about this repository if you do:

1. **Each worktree needs its own `npm install`.** npm workspaces do not share
   `node_modules` across worktrees.
2. **There is one local PostgreSQL and one `.env`.** Two worktrees running
   `npm run db:migrate` or `npm run db:load` fight over the same database. Either
   keep everything that touches `prisma/` in one worktree, or give the second one
   its own `DATABASE_URL` and its own database.
3. **Copy `data/page-cache` across.** It is gitignored, so a fresh worktree has
   none and `npm run ingest` will re-crawl 546 pages instead of finishing in nine
   seconds. Be kind to uclouvain.be.

## The two gates worth understanding before you change anything

`test/architecture/boundaries.test.ts` checks that dependencies point one way:
feature module, then reference module, then platform service. It reads the
workspace manifests, so an undeclared dependency cannot resolve at all, which is
stronger than lint. It also lints a deliberate violation in `test/fixtures` and
fails if that violation stops being reported, so the gate cannot be quietly
removed.

`test/architecture/anonymity-schema.test.ts` parses `prisma/schema.prisma` and
fails if anything that could identify a Member reaches the anonymous path. It
needs no database, so it fails before a migration is ever written. It also
checks that the anonymous identifier is random rather than sequential, that its
date is day precision only, and that it carries no tenant column.

`scripts/verify-isolation.sql` is the third and the one the architecture argument
rests on. It asserts that a feature module cannot read platform data, cannot
write the catalogue, and **cannot insert an anonymous review at all**: only the
platform can, because only the platform can perform the FR-C13 quota check in
the same transaction. That is the anonymity kernel enforced by the database
rather than by code review, and it answers OPEN-39.

Its first version was a false green worth knowing about. Every `SET ROLE` was
itself denied, so all the checks ran as the table owner with full access and the
"must fail" cases quietly succeeded. Each check now asserts which role it is
actually running as, and raises if it cannot assume it, because a check that
cannot confirm its own identity proves nothing.

**If any of them is failing, do not weaken it.** Read `docs/requirements.md` 3.3
first. They encode decisions with recorded reasoning behind them, and every
requirement ID in a failure message points at that reasoning.

## Four more gates on the review path

The submission path is the first code that touches the anonymity kernel, so its
rules are held by tests rather than by comments.

`test/ui/review-flow.test.ts` asserts, over every step and every event of the
submission state machine, that **no step other than the confirmation can write
an anonymous review** (FR-C23). The named branch sends in one press and the
anonymous branch costs one more, and that asymmetry is the design rather than an
oversight: only one of the two can be taken back. Deleting the confirmation step
fails three of these.

`test/ui/path-honesty.test.ts` asserts that the fork's two cards **name no
capability that is not built** (FR-D28). That screen is where a permanent choice
is made by comparing two lists, so a claim that is not true today biases the
decision, and it biases it away from anonymity. When FR-C14 and FR-D12 ship,
update this test in the same change, not before.

`test/architecture/design-tokens.test.ts` keeps the two colours that mean
*attributed* and *anonymous* out of the themeable palette. A per-institution
theme is planned and must never be able to make the two paths look alike.

`test/ryc/validate.test.ts` covers what a review must be before either path will
take it. The rules are shared deliberately (FR-C6): a lower bar on the anonymous
path would itself be a signal.

## Writing style in this repository

No em dashes and no double dashes in prose. Plain words, short sentences. Every
choice is justified by naming the requirement it serves, the alternatives
rejected, the cost accepted, and what would change the answer. If it cannot be
justified that way it is not a decision yet, and it is marked `[OPEN]` in
`docs/requirements.md` instead.
