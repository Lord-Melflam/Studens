# Documentation

Where to start, and what each document is for. **New here? Read `TIMELINE.md`
first**, then `CONTRIBUTING.md`. Everything else is reference you reach for when
you need it.

## The five you will actually open

| | |
|---|---|
| [`TIMELINE.md`](TIMELINE.md) | **Where the project stands, and how it got here.** The state table at the top is what matters day to day, and it holds no figure that moves: `npm run state` counts those when you ask, because a number kept by hand here went stale twice in one week. The phase log below it records how each decision was reached, so a decision can be reopened with its reasoning attached rather than argued again from nothing. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | **How we work and why.** Branching, review, the gates, and what each gate exists to prevent. Read it before your first pull request. |
| [`COMMANDS.md`](COMMANDS.md) | **What to type.** Setup, running it, the database, the catalogue, mail, and a table of what to do when something breaks. Includes the things that are not npm scripts: `psql` one-liners, `gh`, worktrees. |
| [`DEMO.md`](DEMO.md) | **How to show it to a room of students.** The script for a live demonstration: what to run first, what to show in what order, what is real and what is not, and the questions students ask with honest answers. Written for the first ULB session, 2026-09-18. |
| [`LESSONS.md`](LESSONS.md) | **What has gone wrong, and what each failure changed.** Short, and it will save you repeating something. Every rule in `CONTRIBUTING.md` that looks arbitrary has an entry here explaining what produced it. |

## The specification

[`requirements.md`](requirements.md) is the working document and the longest
thing here. Requirement IDs (`FR-A1`, `NFR-S3`, `CON-1`) are **permanent** and
are referenced from test names, failure messages and commit messages, so a
failing gate points at the reasoning behind the rule it enforces.

Its shape: section 1 is purpose, scope and the goals everything else is judged
against; sections 2 to 3 are the requirements themselves, grouped by area
(`FR-A` authentication, `FR-B` modules, `FR-C` anonymity, `FR-D` the first
module, `FR-E` moderation, `FR-F` the shape of the product, `FR-G` languages,
`FR-H` reaching a member); sections 4 to 6 are constraints, legal analysis and
hosting; section 7 is the open questions.

Anything not yet decided is marked `[OPEN]` with a number rather than guessed.

## [`design/`](design) — decision notes

One note per decision that was large enough to need working out. Each carries a
header saying its status, what it decides, what it is constrained by, and who
asked for it. They are the long form of a line in `requirements.md`: read the
requirement first, come here when you want to know what was rejected and why.

| Note | Decides |
|---|---|
| [`architecture-style.md`](design/architecture-style.md) | Modular monolith plus one worker, over microservices and three other options, scored against the goals in requirements 1.05 |
| [`module-boundaries.md`](design/module-boundaries.md) | What a module may and may not reach, and how the build enforces it |
| [`anonymous-rate-limiting.md`](design/anonymous-rate-limiting.md) | Counting contributions without linking a member to one |
| [`account-integrity.md`](design/account-integrity.md) | Living with open registration and many accounts per person |
| [`authentication.md`](design/authentication.md) | OpenID Connect against Microsoft and Google, with the registration walkthrough in its appendix |
| [`moderation.md`](design/moderation.md) | Notice and action, what is held automatically, and who may moderate |
| [`catalogue-ingestion.md`](design/catalogue-ingestion.md) | Scraping a catalogue that has no API, politely, across eras that disagree |
| [`information-architecture.md`](design/information-architecture.md) | The three zones, and routing by path rather than by hash |
| [`internationalisation.md`](design/internationalisation.md) | Three languages, the language in the URL, and how a missing string is caught |

## [`typeset/`](typeset) — the two design documents

`backend-design.tex` and `frontend-design.tex`, with a shared preamble. These
are the long-form pieces that are read rather than searched, and they are
typeset because that is what suits them.

Built with `xelatex`. **The PDFs are not committed**, nor are the build
artifacts or the institution logos `frontend-design` pulls in: a logo is a
trademark whatever the copyright status of the file. Build them yourself, or
read the `.tex`, which is written to be readable as source.

## Conventions

**Every document states its own status.** A design note says whether it is
accepted and by whom. A requirement says `[VERIFIED]` where a person decided it,
`[DERIVED]` where it follows from something else, and `[OPEN]` where it does
not yet exist.

**Nothing here references a file that is not in the repository.** Local working
notes, machine setup and study material are deliberately untracked, so a
document that cited them would send a reader to nothing.

**Where a path is mentioned, it is the real path.** If you move a file, the
references move with it, and `npm run gates` will not catch that for you.
