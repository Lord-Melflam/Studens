# Platform Requirements

| | |
|---|---|
| Status | **Draft**, not agreed |
| Version | 0.1 |
| Date | 2026-09-09 |
| Author | François Meli |

## 0. How to read this document

Every requirement has a stable ID (`FR-`, `NFR-`, `CON-`). IDs are permanent: if a
requirement dies, mark it withdrawn, do not reuse the number. Later documents, tests and
commits reference these IDs so a change can be traced from a decision to the code that
implements it and the test that proves it.

Priority uses MoSCoW: **MUST**, **SHOULD**, **COULD**, **WON'T (v1)**. Given the stated
preference for a small app that genuinely works, `WON'T (v1)` is a normal, healthy outcome
and not a failure.

Four markers appear throughout:

- **[VERIFIED]** stated directly by François, or observed in a system of record.
  Authoritative.
- **[DERIVED]** a reasonable consequence of something verified, but still needs
  confirmation before it is treated as agreed.
- **[PRIOR-ART]** observed in the RYC prototype. **Not authoritative.** See 0.1. Useful as
  a starting point for discussion, never as a source of requirements.
- **[OPEN]** genuinely undecided. It must not be assumed. All open items are collected in
  section 7.

Nothing in this document is settled until section 7 is empty and the status above says
Agreed.

## 0.1 Status of RYC

**RYC is a prototype, not a specification.** François drafted it many months before
2026-09-09, it was never finished, and it does not work. He describes it as "a context
refining experiment". **[VERIFIED]** François, 2026-09-09.

It therefore carries **no authority** in this document. Its README, `docs/PRIVACY.md`,
`docs/MODERATION.md` and `docs/API.md` record one earlier line of thinking, nothing more.
Concretely, this means:

- Its stated architecture ("microservices") is not a decision, and does not constrain this
  platform's architecture.
- Its stack choices are not inherited. They are candidates like any other.
- Its moderation states and thresholds are a first sketch, not agreed behaviour.
- Its privacy policy is an unpublished draft describing a system that never ran, so there
  is no live promise to users to preserve.
- Its unfilled `SECURITY.md` template is what an abandoned draft looks like, and implies
  nothing about this project's security posture.

Anything worth keeping from RYC must be re-argued on its own merits and re-marked
`[VERIFIED]` once François confirms it. Until then it stays `[PRIOR-ART]`.

## 1. Purpose and scope

### 1.0 Long-term vision

**[VERIFIED]** François, 2026-09-09. This is direction, not v1 scope. See 1.3.

A **virtual buddy or advisor for students**: a single place covering the things that make
student life better, grown over months and years into a catalogue of modules. Candidates
named so far are RYC (course reviews), a planning generator, and "some AI stuff".

Two properties of the destination matter more than the feature list, because they are
expensive to retrofit and cheap to keep open:

1. **Multi-institution.** Starting at UCL, later other Belgian higher education
   institutions: universities and **hautes écoles**. Higher education only, so users are
   adults. **[VERIFIED]** François, 2026-09-09.
2. **Open to outside contributors.** Other people should find it easy to extend existing
   modules and add new ones.

Both are recorded here so that v1 avoids decisions that would foreclose them. Neither is a
licence to build them now. The stated preference for a small app that genuinely works
(CON-3, section 4.3) still governs what gets built first.

### 1.1 Problem statement

**[OPEN-1]** Still needed, and now narrower. "Improving student life" is a direction, not a
problem statement: nothing can fail a test against it, which makes Validation (NFR-Q5)
impossible. What is needed is the **first** concrete problem, named in the words of the
students who have it, together with how they currently cope without you.

Vision answers "where is this going". A problem statement answers "why would anyone use
v1". Only the second can be validated, and only the second tells you what to build first.

### 1.2 Product summary

A web application that authenticated users log into and then use as a host for **modules**.
Modules are self-contained functional areas, basic or advanced. **[VERIFIED]** François,
2026-09-09.

**RYC** ("Rate Your Courses"), an anonymous course review tool, is the intended first
module as a *concept*. **[VERIFIED]** François, 2026-09-09. The existing RYC repository is
a discarded prototype and is not the module. See 0.1. Whether the module is written fresh
here, or salvages anything from that repository, is **[OPEN-11]**.

### 1.3 In scope for v1

- The shell: authentication, session, navigation between modules.
- The module contract: how a module is defined, mounted, and isolated.
- **One** module, built well enough to be genuinely used.
- The pipeline: build, test, security checks, deploy.

### 1.4 Out of scope for v1

Named explicitly, because the vision in 1.0 is large and scope control is the main risk to
a project with no deadline. Everything here is *deferred*, not rejected.

- A second module. The planning generator and any AI feature are vision, not v1.
- Third party module authors. The contract is designed with them in mind (1.5), but v1
  ships with modules written by the core team only.
- More than one institution. v1 serves one, with tenancy kept possible (1.5).
- Secondary education. Out of scope permanently, not merely deferred. See OPEN-15.

### 1.5 Decisions that are expensive to reverse

The vision's job in this document is not to add features. It is to identify the handful of
decisions that are cheap now and costly later, so v1 does not accidentally foreclose them.
Everything else should be decided as late as possible.

| # | Keep open | Why it is expensive later |
|---|---|---|
| 1 | **Tenancy in the data model.** Whether a row belongs to an institution. | Retrofitting a tenant boundary into a live schema means migrating every table and re-auditing every query. Adding the column now, even with one tenant, costs almost nothing. |
| 2 | **Identity is not assumed to be one provider.** | UCL SSO, another university's SSO, and self-managed accounts differ. Hard-coding one identity shape reaches into session handling, authorisation and every module. |
| 3 | **The module contract is a real interface**, not a convention. | If modules reach into each other, the boundary cannot later be turned into a public extension point. This is FR-B, and it is the load-bearing decision of the whole project. |
| 4 | **No user identifier leaks into module storage.** | If module rows carry user IDs, unlinkability cannot be added afterwards. See FR-C, conditional on OPEN-12. |

Note what is deliberately absent: multi-tenant routing, an institution admin UI, a plugin
loader, a module marketplace. Those are the expensive parts, and none is needed to keep the
corresponding door open.

## 2. Actors

**[DERIVED]** from the described login shell and the anonymous-module concept. Confirm
before use. None of these are agreed.

| ID | Actor | Description |
|---|---|---|
| AC-1 | Visitor | Unauthenticated. Can reach the public entry point only. |
| AC-2 | Member | Authenticated user of the platform. Sees the module list. |
| AC-3 | Contributor | A Member acting *inside* an anonymous module. Deliberately unlinkable to AC-2. |
| AC-4 | Moderator | Reviews flagged content. Exists only if a module needs moderation. |
| AC-5 | Administrator | Operates the platform, manages modules and moderator accounts. |
| AC-6 | Module author | Writes a module. Core team in v1, potentially an outside contributor later (1.0, OPEN-16). |
| AC-7 | Institution | A university or school whose students are Members. Not an actor in v1, but see 1.5 item 1. |

**[OPEN-3]** Who may become a Member? UCL students only, any university, or anyone? This
single answer determines the identity provider, the eligibility check, the abuse model and
the legal position, so it blocks a large part of the design.

## 3. Functional requirements

### 3.1 Authentication and session (FR-A)

| ID | Priority | Requirement |
|---|---|---|
| FR-A1 | MUST | A Visitor can authenticate and become a Member. |
| FR-A2 | MUST | A Member can end their session explicitly, on the current device. |
| FR-A3 | MUST | Sessions expire after inactivity. Duration is **[OPEN-4]**. |
| FR-A4 | MUST | Authentication failures reveal nothing about whether an account exists. |
| FR-A5 | SHOULD | A Member can see and revoke their active sessions. |

**[OPEN-5]** Identity provider: self-managed credentials, UCL SSO, or a third party?
Self-managed means owning password storage, reset flows and breach risk. SSO removes that
burden and answers FR-A1 and OPEN-3 together, but couples the project to UCL and may not
be obtainable by a student project. Cost must be zero either way (CON-1).

### 3.2 Module system (FR-B)

This section is the core of the MEA goal. If these requirements hold, adding module number
two is cheap; if they do not, the platform is a monolith in the bad sense.

| ID | Priority | Requirement |
|---|---|---|
| FR-B1 | MUST | A Member sees only the modules they are entitled to use. |
| FR-B2 | MUST | A module declares its own routes, its own storage, and its public interface. |
| FR-B3 | MUST | A module cannot read or write another module's data directly. |
| FR-B4 | MUST | Adding a module requires no change to another module's source. |
| FR-B5 | SHOULD | A module can be disabled without redeploying the others. |
| FR-B6 | SHOULD | Violations of FR-B3 fail the build, rather than relying on reviewer vigilance. |
| FR-B7 | SHOULD | The module contract is documented well enough for someone outside the core team to write a module against it. |
| FR-B8 | SHOULD | A module declares what it needs (storage, user attributes, network) rather than being granted everything by default. |

FR-B6 is deliberate. A boundary that is only a convention erodes; a boundary the pipeline
enforces does not. This is Verification applied to architecture itself.

FR-B7 and FR-B8 exist because of the vision in 1.0. Once outside contributors write
modules, **the module boundary stops being a tidiness concern and becomes a trust
boundary.** A third party module is code you did not write, running next to student data,
inside a session you authenticated. That is a materially different security problem from a
module written by the core team, and the honest answers span a wide range:

- **Trusted contributors.** Outsiders contribute by pull request, you review and merge,
  everything ships as one reviewed codebase. Cheap, and the module boundary stays internal.
- **Vetted catalogue.** Modules are separately authored but manually approved before they
  can be enabled. More process, more reach.
- **Untrusted plugins.** Anyone publishes, the platform contains them at runtime. This is
  the expensive one: it needs sandboxing, a capability model, resource limits and a review
  pipeline, and it is where most plugin platforms get breached.

**[OPEN-16]** Which of these is the target? FR-B8's least-privilege declaration is worth
doing under any of them, and is the cheapest thing that keeps the harder options reachable.
Building for the third before you have the first would violate CON-3 and section 4.3.

### 3.3 The anonymity seam (FR-C)

The platform authenticates its users. An anonymous module, by definition, must not know who
they are. These two pull in opposite directions, and the seam between them is where the
contradiction is resolved or quietly lost.

**Anonymity is a core product value and it stays.** The contributor chooses, per
contribution, whether to publish anonymously or under their real account.
**[VERIFIED]** François, 2026-09-09. Resolves OPEN-12.

That choice is a genuine product improvement and a significant engineering complication.
The traps below are not hypothetical; they are the standard ways optional anonymity fails.

#### Two paths, not one path with a flag

| ID | Priority | Requirement |
|---|---|---|
| FR-C1 | MUST | Authentication establishes *eligibility to contribute*. For an anonymous contribution it never establishes authorship. |
| FR-C2 | MUST | An anonymous contribution stores **no** identifier of the authenticated Member, in any column, log, or backup. |
| FR-C3 | MUST | An Administrator holding stored data (a dump, a backup, or query access to the live tables) cannot link an anonymous contribution to a Member. **Deliberately scoped:** an adversary observing writes as they happen is out of the threat model. See below. |
| FR-C4 | MUST | A Member cannot contribute without limit, and enforcing that must not break FR-C2. **[OPEN-6]** |
| FR-C5 | MUST | Timestamps, ordering and identifiers must not act as a de facto link. |
| FR-C6 | MUST | Anonymous and attributed contributions are stored on structurally separate paths, not distinguished by a nullable owner column. |
| FR-C7 | MUST | An attributed contribution is ordinary personal data and carries the full obligations that follow. |
| FR-C8 | SHOULD | Unlinkability is covered by an automated test that fails if an identifier ever reaches the anonymous path. |
| FR-C9 | MUST | An anonymous contribution cannot be edited or deleted **by its contributor**, ever. This follows from FR-C2: nobody can prove authorship, including its author. **[VERIFIED]** François, 2026-09-09. |
| FR-C10 | MUST | Moderators and Administrators **can** remove any contribution, anonymous or attributed. FR-C9 constrains the contributor, never the platform. |
| FR-C11 | MUST | Before an anonymous contribution is submitted, the contributor is shown that it is permanent and irreversible, and confirms. |
| FR-C12 | MUST | The public privacy statement describes the guarantee at exactly its real strength, including the FR-C3 scope limit. It must not overclaim. |

**The threat model boundary, decided 2026-09-09.** **[VERIFIED]** François. Rate limiting
uses Option A of `design/anonymous-rate-limiting.md`: a fixed window counter on the member
record, nothing on the contribution. A live adversary with access to the database write
stream is **out of scope**, and such an adversary could correlate a counter increment with
a contribution insert.

This is a reasonable proportionality judgement for this project, and it has one obligation
attached: FR-C12. The privacy statement must say that the platform does not store the link,
rather than implying that correlation is impossible for anyone under any circumstances.
Overclaiming here would be worse than the weaker guarantee, because users would calibrate
their honesty against a promise that does not hold. Stating the limit plainly is what makes
the rest of the promise credible.

FR-C6 is the load-bearing requirement here, and it is a schema decision rather than a
policy one. The obvious implementation of "optional anonymity" is one table with a nullable
`member_id`, left `NULL` when the contributor chose anonymity. **Do not do this.** A
nullable foreign key means the schema itself permits the linkage, every anonymous row is
one careless `INSERT` away from being identified, and the guarantee rests on application
code being correct forever. Two separate paths, where the anonymous one has no column
capable of holding an identifier, make the guarantee structural. The database then cannot
express the leak, and FR-C3 stops depending on anybody's vigilance.

FR-C3 is the honest form of the promise. "We choose not to look" is a policy; "we are
unable to look" is a property. Only the second survives a compromised administrator, and
only the second is worth writing in a privacy policy. Choosing the weaker version is a
legitimate decision, but it must be a deliberate one.

#### Where optional anonymity bites

**The choice itself carries information.** If most contributions are attributed, choosing
anonymity is itself a signal, and on a small course with few reviews the anonymity set can
collapse to one person regardless of how good the cryptography is. Unlinkability protects
the record; it does not protect against there being only one plausible author. **[OPEN-19]**
Is a minimum anonymity set required before an anonymous contribution is displayed?

**"My contributions" is incompatible with anonymity, and is therefore not offered.**
**RESOLVED 2026-09-09, OPEN-20:** an anonymous contribution cannot be edited or deleted by
its contributor. No client-held secret, no edit token, no recovery path. This is the strong
answer and it keeps FR-C2 and FR-C3 intact, at a real cost in user convenience that the
interface must be honest about (FR-C11).

Two consequences follow and must not be confused with each other.

*The contributor loses control; the platform does not.* FR-C10 exists because "nobody can
delete this" would be an untenable position. A contribution may be defamatory, may contain
personal data about a third party such as a named lecturer, or may simply be illegal.
Moderators must be able to remove it. The rule is that the **contributor** cannot act on
their own past contribution, not that the content is beyond reach. Removal by moderation is
also unlinkable: removing a contribution reveals nothing about who wrote it.

*A named third party retains their rights.* A review about an identifiable lecturer contains
that lecturer's personal data, and their rights do not depend on the reviewer's anonymity.
FR-C10 is what makes such a request actionable. Interacts with OPEN-10.

**Mixed mode leaks through behaviour.** A Member who contributes attributed on one course
and anonymously on another can often be correlated through timing, writing style or session
patterns. Perfect defence is not achievable, but the design should avoid making it easy.
**[OPEN-21]** Is the anonymous or attributed status of a contribution publicly visible?

**Erasure and unlinkability collide.** If a Member exercises a right to erasure, their
attributed contributions can be deleted. Their anonymous ones cannot, because by
construction nobody can tell which they are. This is defensible: data that cannot be
associated with an identified person sits outside those obligations. It must be stated
plainly to users before they contribute, not discovered at the first request. Interacts
with OPEN-10.

Users must understand, at the moment of choosing, that anonymous means **permanent and
irreversible**: no editing, no deletion, no proving it was theirs. That is the honest
consequence of a guarantee worth having.

### 3.4 First module (FR-D)

**No requirements yet. [OPEN-13]**

The first module's behaviour has not been specified. The prototype sketched one shape, and
that sketch is recorded below as prior art to argue with, not as requirements to implement.

**[PRIOR-ART]**, from the discarded RYC repository, read 2026-09-09:

| Sketched | Detail |
|---|---|
| Review states | `PENDING`, `APPROVED`, `FLAGGED`, `REJECTED` |
| Escalation | 3 or more community flags hide a review pending review |
| Moderator view | content, anonymous ID and timestamp only |
| Anonymous ID | `'anon_' + crypto.randomBytes(16).toString('hex')` |
| Service target | 24 hour manual review |

Points worth challenging before any of it is adopted. A 24 hour manual review target is an
operational commitment that needs a staffed rota, which a team of two or three with no
budget may not be able to honour (CON-1, CON-2). A fixed threshold of 3 flags is trivially
gamed by three coordinating accounts. And a random per-review identifier only delivers
unlinkability if nothing else in the system correlates the records, which is exactly what
FR-C5 is about.

Writing this section is a prerequisite for building anything.

### 3.5 Moderation and administration (FR-E)

| ID | Priority | Requirement |
|---|---|---|
| FR-E1 | MUST | Moderator actions are recorded in an audit log. |
| FR-E2 | MUST | The audit log records the moderator, never the contributor. |
| FR-E3 | SHOULD | An Administrator can appoint and remove Moderators. |
| FR-E4 | MUST | Contributions are screened automatically before publication. **[VERIFIED]** François, 2026-09-09. |
| FR-E5 | MUST | Screening has three possible outcomes: publish, hold for human review, or reject. |
| FR-E6 | MUST | Screening is advisory for removal decisions with legal weight. A human decides those. |
| FR-E7 | MUST | Sanctions against a **person** are possible only for attributed contributions. See below. |

Screening is intended to combine deterministic filters with language model passes over
open weight models, to detect defamation and similar categories. **[VERIFIED]** François,
2026-09-09.

**FR-E7 is a hard consequence of the anonymity design, and it contradicts one stated
intention.** "Holding the user for writing certain things" requires knowing which user
wrote it. For an anonymous contribution nobody does, by construction (FR-C2, FR-C3). So on
the anonymous path you can hold, reject or remove the **content**, and you cannot warn,
suspend or sanction the **author**. That is not a gap to be fixed later; it is the price of
the guarantee, and any mechanism that restores author sanctions on anonymous contributions
has silently broken unlinkability. On the attributed path, author sanctions are entirely
possible and unproblematic.

Two consequences to decide:

**[OPEN-23]** Does contribution text leave the platform to a third party inference service?
If yes, that service becomes a data processor, which brings contractual and GDPR
obligations (OPEN-10) and a cost that CON-1 forbids (OPEN-17). Note that anonymous text is
not automatically harmless to send: a review can identify its author through content alone,
especially in a small cohort (OPEN-19). Self-hosting open weights avoids the processor
question and moves the cost to hardware nobody currently has.

**[OPEN-24]** Where is the threshold for automatic removal versus holding for a human? An
automated classifier that removes content unilaterally will silence legitimate negative
reviews, which is the one thing a course review platform must not do. Holding is the safer
default, and it consumes moderator time the team may not have (OPEN-7).

**[OPEN-8]** How is a Moderator appointed, and by whom? Unanswered, this becomes a
privilege escalation path.

## 4. Non-functional requirements

### 4.1 MEA (NFR-M)

| ID | Priority | Requirement |
|---|---|---|
| NFR-M1 | MUST | A new developer can go from clone to running system with one documented command. |
| NFR-M2 | MUST | Every module follows the same internal structure, so one is learned by learning any. |
| NFR-M3 | SHOULD | Adding a module touches only that module's directory plus one registration point. |
| NFR-M4 | SHOULD | Architecture decisions are recorded with their rationale, so a future reader can tell an intentional choice from an accident. |

NFR-M1 matters more now that the team is growing to two or three. Onboarding cost is a
maintainability property, not a nicety.

### 4.2 Security (NFR-S)

| ID | Priority | Requirement |
|---|---|---|
| NFR-S1 | MUST | Dependency vulnerability scanning runs in CI and can fail the build. |
| NFR-S2 | MUST | Static analysis runs in CI on every pull request. |
| NFR-S3 | MUST | No secret is ever committed. Enforced by an automated check, not by care. |
| NFR-S4 | MUST | All traffic uses HTTPS. |
| NFR-S5 | MUST | A documented, non-placeholder vulnerability disclosure process exists. |
| NFR-S6 | SHOULD | A written threat model exists and is revisited when trust boundaries change. |

NFR-S5 says "non-placeholder" deliberately. An unfilled `SECURITY.md` template is worse
than none, because it looks like a policy while committing to nothing.

### 4.3 Quality and process (NFR-Q)

| ID | Priority | Requirement |
|---|---|---|
| NFR-Q1 | MUST | Every FR is testable. A requirement that cannot fail a test is not a requirement. |
| NFR-Q2 | MUST | CI runs the full test suite on every pull request. |
| NFR-Q3 | MUST | Merging to the main branch requires CI to pass. |
| NFR-Q4 | SHOULD | Each requirement traces to the test that verifies it. |
| NFR-Q5 | SHOULD | Validation is planned explicitly: real prospective users see the thing before it is called done. |

NFR-Q1 to Q4 are Verification. NFR-Q5 is Validation, and it is the one usually skipped.
A system can pass every test and still be the wrong system.

### 4.4 Operational (NFR-O)

**[OPEN-9]** Expected user numbers, acceptable downtime, and backup and recovery
expectations are all unknown. Performance and availability targets invented without them
would be theatre, so none are stated here.

| ID | Priority | Requirement |
|---|---|---|
| NFR-O1 | MUST | Data is backed up, and a restore has been performed at least once to prove it works. |

NFR-O1 is stated despite OPEN-9 because an untested backup is not a backup, and this
project has a history of data loss on the development machine.

## 5. Constraints

| ID | Constraint |
|---|---|
| CON-1 | **Zero budget.** No paid services or tiers, no trials that convert to charges. Free or open source and self-hostable only. Where a free tier is used, its limit and the exit path are documented. **[VERIFIED]** François, 2026-09-09. |
| CON-2 | **Team of two to three developers**, one of them part-time on operations. **[VERIFIED]** François, 2026-09-09. |
| CON-3 | **No deadline.** Time may be traded for quality. This forbids shortcuts justified by speed. **[VERIFIED]** François, 2026-09-09. |
| CON-4 | **Git is the coordination mechanism.** Shared history is not rewritten. **[VERIFIED]** François, 2026-09-09. |

**[OPEN-10]** Legal basis. The project is university-adjacent and based in Belgium, so the
GDPR very likely applies, which would make lawful basis, data subject rights, retention and
the role of the university substantive requirements rather than paperwork. This interacts
directly with FR-C: strong unlinkability is the most robust answer to most of it, since
data that cannot be linked to a person is far easier to defend. Needs confirmation, not
assumption.

## 6. Acceptance

v1 is complete when every MUST requirement has a passing test, section 7 is empty, and
NFR-Q5 validation has been carried out with real users.

## 7. Open questions

These block agreement. None may be silently assumed.

| ID | Question | Blocks |
|---|---|---|
| OPEN-1 | What is the problem, in the words of the people who have it? | Everything |
| OPEN-2 | What is explicitly out of scope for v1? | Scope control |
| OPEN-3 | Who is allowed to become a Member? | AC-2, FR-A, OPEN-5 |
| OPEN-4 | Session lifetime and inactivity timeout? | FR-A3 |
| OPEN-5 | Which identity provider? | FR-A1, CON-1 |
| ~~OPEN-6~~ | ~~How to rate limit contributions without linking them?~~ **RESOLVED 2026-09-09: Option A, fixed window.** | closed |
| OPEN-7 | Is the 24 hour moderation target sustainable? | FR-D, staffing |
| OPEN-8 | How are Moderators appointed? | FR-E3 |
| OPEN-9 | Expected load, acceptable downtime, recovery expectations? | NFR-O |
| OPEN-10 | Does the GDPR apply, and what is the lawful basis? | CON-1, FR-C |
| OPEN-11 | Is the first module written fresh, or does it salvage from the prototype? | 1.2, FR-D |
| ~~OPEN-12~~ | ~~Is anonymous contribution a real product goal?~~ **RESOLVED 2026-09-09: yes, and it is the contributor's choice per contribution.** | closed |
| OPEN-13 | What must the first module actually do? | FR-D, everything downstream |
| OPEN-14 | Which single institution does v1 serve, and when does the second arrive? | 1.5 item 1, tenancy |
| ~~OPEN-15~~ | ~~Are secondary school users in the vision?~~ **RESOLVED 2026-09-09: no.** Higher education only. | closed |
| OPEN-16 | Trusted contributors, vetted catalogue, or untrusted plugins? | FR-B7, FR-B8, security model |
| OPEN-17 | How does an AI module fit a zero budget constraint? | CON-1, vision 1.0 |
| OPEN-18 | What licence, and who governs contributions? | Outside collaboration |
| OPEN-19 | Is a minimum anonymity set required before an anonymous contribution is shown? | FR-C5 |
| ~~OPEN-20~~ | ~~Can a contributor manage their own anonymous contributions?~~ **RESOLVED 2026-09-09: no. No editing, no deletion, ever.** | closed |
| OPEN-21 | Is anonymous or attributed status publicly visible on a contribution? | FR-C5, product |
| OPEN-22 | Default mode? Can an **attributed** contribution be edited, deleted, or made anonymous later? | FR-C, product |
| OPEN-23 | Does contribution text leave the platform to a third party inference service? | FR-E4, CON-1, OPEN-10, OPEN-17 |
| OPEN-24 | Threshold for automatic removal versus holding for a human? | FR-E5, FR-E6 |
| OPEN-25 | Is per target uniqueness required (one review per course per person)? | FR-C4, design note |
| ~~OPEN-28~~ | ~~Product name and repository name?~~ **RESOLVED 2026-09-09: Studens.** | closed, BOIP check still outstanding |
| OPEN-29 | Hosting target. **Vercel** raised as a free candidate. **Verify before designing around it:** (1) whether the free Hobby tier still prohibits commercial use, which a sponsored or funded student platform could trip; (2) that a stateful modular monolith fits its serverless model, which is doubtful; (3) that it provides no database, so Postgres still needs a separate free host. Unverified as of 2026-09-09. | CON-1, architecture |
| OPEN-26 | What is the quota, and per what period? | FR-C4, design note |
| ~~OPEN-27~~ | ~~Live adversary with database write stream access in the threat model?~~ **RESOLVED 2026-09-09: no.** | closed |

OPEN-22 is narrower than it was. The anonymous side is settled by FR-C9. What remains is
the attributed side, where all three operations are technically possible, plus which mode
the interface offers first. Defaults matter more than they look: the default becomes what
most people pick, and that determines the size of the anonymity set that OPEN-19 is about.

**OPEN-17 is a real conflict, not a detail.** CON-1 forbids paid services. Hosted language
model inference is a paid service, and self-hosting a useful model needs hardware nobody on
this team currently has. Either the AI module is not free, or it is not what people expect
by "AI stuff". Better resolved now than discovered later.

### 7.1 Resolved

| ID | Question | Resolution |
|---|---|---|
| OPEN-15 | Secondary school users, and therefore minors? | **No.** Higher education only: universities and hautes écoles. All users are adults, so no parental consent regime, no heightened GDPR bar for children, and no safeguarding duty toward minors. Resolved 2026-09-09. |
| OPEN-12 | Is anonymous contribution a real product goal? | **Yes, and it is the contributor's choice.** Anonymity is a core value. Each contribution is published either anonymously or under the contributor's real account, chosen by them. Unlinkability is therefore a central design constraint, and section 3.3 applies in full. Resolved 2026-09-09. |
| OPEN-20 | Can a contributor manage their own anonymous contributions after submitting? | **No. No editing, no deletion, ever.** The strong answer, taken deliberately: it preserves FR-C2 and FR-C3 with no exception path, at a real cost in convenience. Moderators retain removal powers (FR-C10); the restriction binds the contributor, not the platform. Resolved 2026-09-09. |
| OPEN-6 | How to rate limit without linking? | **Option A, fixed window.** A counter on the member record, nothing on the contribution. No cryptography. See `design/anonymous-rate-limiting.md`. Resolved 2026-09-09. |
| OPEN-27 | Live database write stream adversary in the threat model? | **No.** Proportionality judgement for a small free project. Consequence: the residual correlation in design note 4.1 is knowingly accepted, and FR-C12 requires the privacy statement to disclose it rather than claim absolute unlinkability. Resolved 2026-09-09. |
| OPEN-28 | Product name, and therefore the repository name? | **Studens.** Latin, *studēns*, present active participle of *studeō, studēre*: "studying, dedicating oneself to". It is the origin of the participle stem *student-* behind English *student*, French *étudiant* and Dutch *student*, so it reads natively in all three of the platform's languages. Chosen over **Sodalitas** by accepting a weaker (descriptive) trademark position in exchange for immediate legibility, which suits a free non commercial platform. Selection history and rejected names in 7.2. `studens.be` was available on 2026-09-09. **The BOIP trademark search remains outstanding and is not blocked by this decision.** Resolved 2026-09-09. |

Resolved questions stay in the document rather than being deleted. A reader six months from
now needs to see that minors were considered and deliberately excluded, not wonder whether
anyone thought about it.

### 7.2 Naming: verified findings

Queried against the DNS Belgium registry (`whois.dns.be`, port 43) on 2026-09-09.

**Taken:** azimut.be (2006), kompas.be (2023), cursus.be (2000), atlas.be (2001),
agora.be (1997), penne.be (1999), boussole.be (2018), azimuts.be, studia.be,
auditoire.be, syllabus.be.

**Available:** cursia.be, boussol.be, monazimut.be, lapenne.be, monkot.be.

Second round, checked the same way on 2026-09-09 after **Cursia was set aside**:

**Available:** gradia.be, boussol.be, studea.be, balisa.be, reperia.be, azima.be, kompa.be.
**Taken:** itera.be, azimo.be, orienta.be, gradus.be.

Conclusion: short dictionary words in `.be` are long gone, so the name must be coined or
compound. That is no loss, since a coined name is also easier to register as a trademark
and easier to search for, which was the objection to Boussole in the first place.

**Cursia set aside 2026-09-09.** Any name beginning "curs" reads as *curse* in English, and
"cursed" is common internet slang in exactly the target age group. Note where the risk
actually sits: French has no word "curse" and *malédiction* is not phonetically close, so a
French reader lands on *cursus* correctly. The exposure is English, and Belgian students are
bilingual enough for it to matter. No respelling fixes it, because the root itself carries
it, so the root had to change.

**Leading candidate: Gradia.** From Latin *gradus*, step or degree, the root of *graduate*
and *grade*. It preserves the academic-progression meaning that made Cursia attractive,
carries no unwanted reading, and works in French, English and Dutch. `gradia.be` is free.
**Boussol** remains the alternative if the guidance metaphor is preferred over progression.

**Studea collision, CONFIRMED by François 2026-09-09.** *Studéa* and `studea.fr` already
exist. The earlier caution was correct.

Third round, the `stud` root, checked the same way on 2026-09-09.

Rationale for the root: "stud" identifies the audience in the first syllable, with no
explanation required. That is a real branding advantage which *Gradia* lacks, since Gradia
depends on the reader knowing that *gradus* means step.

**Taken:** studeo.be, studo.be, studium.be, studenta.be, studix.be, studino.be.
**Available:** studika.be, studorium.be, studaria.be, studely.be, studor.be, studam.be,
studel.be, studena.be, studeva.be, studara.be, studeus.be.

**Studeo is out on two independent grounds.** `studeo.be` is already registered, which
settles it. Separately, and worth recording for any other TLD: *Studeo* and *Studéa* are
phonetically near identical, and trademark assessment weighs phonetic similarity together
with how related the sectors are. Student housing and a student services platform are
adjacent, so *Studeo* carried the highest confusion risk of any name considered.

**Leading candidate: Studika.** Three syllables, unmistakably student facing, no unwanted
reading in French, English or Dutch, and phonetically distant from Studéa.
**Studorium** is the alternative with more academic weight, at four syllables.
**Gradia** remains the cleanest name in the abstract but does not signal its audience.

**Caution, unverified:** *studena* is believed to mean "cold" in several Slavic languages.
Not confirmed, and relevant only if that name is considered.

Fourth round, Latin, checked the same way on 2026-09-09.

Rationale for Latin: it reads as academic without being tied to one institution, and it
crosses French, Dutch and English without translation, which the multi-institution vision
in 1.0 will eventually need.

**Taken:** sodalis, vademecum, consilium, adiutor, auxilium, socius, tutela, aula, comes,
alumnus, sapientia, compendium, discipulus, limen, lares, scholaris, pharus, collegium
(all `.be`).

**Available:** studens.be, sodalitas.be, studiosus.be, comitatus.be, cohors.be, auspex.be,
itinerarium.be, viaticum.be, trames.be, semita.be.

**Leading candidate: Studens.** Present participle of *studere*, "studying" or "one who is
studying". It is not Latin that merely contains "stud", it is the origin of that syllable in
*student*, *étudiant*, *student* (NL) and *studente*, so it reads correctly and immediately
in all three of the platform's languages while keeping the audience signal that motivated
the third round. Clearly distinct from Studéa.

**Runner up: Sodalitas**, meaning fellowship or association, which suits the community
aspect.

**Trademark trade-off, worth recording.** *Studens* literally describes the sector, which
makes it maximally legible but a **weak mark**: descriptive terms receive thin protection
and are easy for others to work around. *Sodalitas* is suggestive rather than descriptive
and would protect better, at the cost of needing explanation. For a free, non commercial
student platform, legibility is judged the better trade.

**Avoid Viaticum**, despite `viaticum.be` being available. The classical sense is
provisions for a journey, but in Catholic usage *viaticum* is the Eucharist administered to
the dying. At a Catholic university in a Catholic country that association is a liability.

Two things are deliberately **not** verified:

- **BOIP trademark register.** Their register is a JavaScript application and returns no
  content to a plain fetch, so it could not be queried with the tools available. This
  remains **unverified**. It is a short manual search per name at `boip.int` under
  Trademarks register, worth doing only for the surviving candidates.
- **Non `.be` TLDs.** The `.be` registry answers `NOT ALLOWED` for other TLDs, as expected,
  so nothing is known here about `.app`, `.dev` or `.org`.

**Cost note (CON-1).** A `.be` registration is a paid service, roughly 10 to 15 EUR per
year, so buying a domain is a small but real breach of the zero budget constraint. It is
not required for v1: a repository can publish on a `github.io` subdomain at no cost. Treat a
domain as optionally reserving a name, never as a prerequisite.

### 7.3 Repository name

**Rejected: `DevSecOps`.** It names the practice, not the product. A reader arriving at such
a repository expects pipeline templates and scanning configuration, not a student platform,
which matters directly for the vision of outside contributors (1.0). It is also far more
generic than the names already rejected for being generic, and it ages badly if the practice
changes. DevSecOps belongs in the README, in `docs/`, and visibly in the CI configuration,
which is where it can actually be judged.

**Decision rule:** the repository is named after the product (OPEN-28). Renaming a Git
repository is cheap now (no users, no CI, no dependents) and progressively less so later,
so a working name is acceptable in the meantime.

## 8. Terminology

The documents are written in English about a French-speaking Belgian context, so some terms
do not translate the way they appear to.

| Term | Meaning here | Not |
|---|---|---|
| **Haute école** | A Belgian higher education institution offering professional bachelor's and master's degrees, outside the university system. Students are adults. | A "high school". This is a false friend and it caused a real error in an earlier draft of this document. |
| **Université** | A Belgian university, such as UCL. | |
| **Secondary school** | Pre-higher education. Permanently out of scope, OPEN-15. | |
| **Module** | A self-contained functional area of the platform, section 3.2. | A code module or npm package. |

## 9. Sources

- François Meli, project context, 2026-09-09. **Authoritative.**
- <https://github.com/Lord-Melflam/RYC>, README, `docs/PRIVACY.md`, `docs/MODERATION.md`,
  `SECURITY.md`, read 2026-09-09. **Prior art only, not authoritative**, see 0.1.
  `docs/API.md` exists and has not been read. Given its status, reading it is low priority.
