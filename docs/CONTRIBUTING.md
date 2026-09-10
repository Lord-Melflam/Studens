# Contributing

Studens is MIT licensed, inbound equals outbound, so no contributor agreement is
needed. Outside contributors are welcome as contributors: open a pull request.

All module code lives in this repository and is admitted by review before merge
(FR-B14). There is no plugin loader, no registry, and no runtime loading of
third-party code.

## Getting set up

Requires Node 22 or later and a PostgreSQL database.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL
npm run gates             # typecheck, lint, tests, schema validation
```

**Work inside the Linux filesystem, not on a Windows mount.** Measured on this
project: 300 small file writes took 0.03 s on ext4 and 4.0 s on `/mnt/c`, which
is 134 times slower. `node_modules` is tens of thousands of files.

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

**Branch protection on `main` must require the `gates` job.** That is a
repository setting rather than a file, so it is not version controlled and has
to be checked by hand. If it is off, FR-B15 is not enforced.

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

**If either is failing, do not weaken it.** Read `docs/requirements.md` 3.3
first. Both encode decisions with recorded reasoning behind them, and every
requirement ID in a failure message points at that reasoning.

## Writing style in this repository

No em dashes and no double dashes in prose. Plain words, short sentences. Every
choice is justified by naming the requirement it serves, the alternatives
rejected, the cost accepted, and what would change the answer. If it cannot be
justified that way it is not a decision yet, and it is marked `[OPEN]` in
`docs/requirements.md` instead.
