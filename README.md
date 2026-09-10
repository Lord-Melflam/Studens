# Studens

A modular web platform for students in higher education. People log in securely, then use
**modules**: self-contained tools covering the things that make student life better.

**Status: specification stage.** There is no code yet, and that is deliberate. The
requirements are being written before anything is built, because the goal is a small app
that genuinely works rather than a large one that does not.

## The name

**Studens** is Latin, spelled **studēns** with a long *e*, and pronounced accordingly.

It is the present active participle of the second conjugation verb
**studeō, studēre, studuī**, and it declines as a third declension one termination
participle: *studēns*, genitive *studentis*.

It means **studying**, and more fully *dedicating oneself to something, directing one's
efforts toward it, striving after it*. The narrower sense of "study" in the academic sense
is a later, medieval development. The earlier and broader meaning is closer to eagerness
and effort than to sitting with a book.

The name was not chosen for merely containing the syllable *stud*. It **is** the origin of
that syllable, through the participle stem *student-*:

| Language | Word | From |
|---|---|---|
| English | student | *studēns*, stem *student-* |
| French | étudiant | *studēns*, stem *student-* |
| Dutch | student | *studēns*, stem *student-* |

So the name reads correctly and immediately in all three of the platform's languages
without translation, which matters for a project intended to serve several Belgian
institutions.

Its deeper etymology is a happy accident. *Studēre* descends from Proto-Italic *\*studēō*
and ultimately from a Proto-Indo-European root meaning **to push, to hit**, the same root
behind Latin *tundō* and English *stub*. Studying, at the root of the word, is pushing
against something. That seems about right.

Related Latin words from the same family: *studium* (zeal, application, and hence a
pursuit or study) and *studiōsus* (zealous, eager).

## Documentation

Specifications live in `docs/`, and they are the authoritative description of this project.

| Document | Contents |
|---|---|
| `docs/TIMELINE.md` | **Start here.** Where the project is, what runs today, what is deliberately absent, and the log of how each decision was reached |
| `docs/requirements.md` | Platform requirements. The working document. Requirement IDs are permanent and referenced from tests and commits |
| `docs/CONTRIBUTING.md` | How to run it, and why code review is a security control here rather than a quality practice |
| `docs/LESSONS.md` | What has gone wrong and what each failure changed. Kept because the rule is worth more than the memory of the bug |
| `docs/design/architecture-style.md` | Accepted: modular monolith plus a worker, with the six candidates compared and microservices excluded on two independent grounds |
| `docs/design/module-boundaries.md` | How modules share without coupling. Rejects a global shared module, and explains why |
| `docs/design/anonymous-rate-limiting.md` | Accepted: enforcing contribution limits without linking a contribution to a person |
| `docs/design/catalogue-ingestion.md` | Accepted: scraping the course catalogue, with the structure discovered rather than hardcoded |
| `docs/design/frontend-design.tex` | Proposed: how the end product should look and behave. Architecture, user scenarios, use cases and screens. Build with `xelatex`; the PDF and the institution logos are gitignored |

Requirements are marked `[VERIFIED]`, `[DERIVED]`, `[PRIOR-ART]` or `[OPEN]`. Nothing is
agreed while it is still `[OPEN]`, and open questions are collected in section 7. That
section is currently long on purpose: unanswered questions are recorded rather than guessed.

## How this project is built

The approach is **DevSecOps**, and it is meant to be visible in the pipeline rather than
asserted here. Security checks belong in continuous integration where they can fail a
build, not in a document where they can only be claimed.

Quality is framed around the two V's of software quality assurance:

- **Verification**, are we building it right: tests, static analysis, review, CI gates.
  Every requirement is written so that it can fail a test.
- **Validation**, are we building the right thing: real prospective users see the work
  before it is called done.

Two properties are treated as load bearing and are enforced structurally rather than by
convention:

- **Module boundaries.** A module declares its own routes, storage and public interface,
  and cannot reach into another module's data. The build fails on violations.
- **Anonymity.** Contributors choose, per contribution, whether to publish anonymously or
  under their account. Anonymous contributions store no identifier of their author, on a
  structurally separate path rather than behind a nullable column, and they are permanent:
  no editing or deletion by the contributor. Moderators retain removal powers.

## Licence

[MIT](LICENSE). Use it, modify it, build on it.

Contributions are accepted on the same terms: what comes in is licensed the way what goes
out is, so no separate contributor agreement is needed.

## Author

François Meli
