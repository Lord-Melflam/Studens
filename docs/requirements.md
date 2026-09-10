# Platform Requirements

| | |
|---|---|
| Status | **Draft**, not agreed |
| Version | 0.2 |
| Date | 2026-09-10 |
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
student life better, grown over months and years into a catalogue of modules.

**The catalogue is open ended and driven by user needs.** More modules will come as needs
are observed; the list below is what exists today, not a plan. **[VERIFIED]** François,
2026-09-10.

Two modules are named so far, **in order of urgency as observed in the institutions**:

| # | Module | Name | What it is |
|---|---|---|---|
| 1 | **RYC** | Rate Your Courses | Course reviews, with anonymity as a per review choice and not the default (3.3). The intended first module. |
| 2 | **MPA** | My Planning Advisor | Planning and scheduling help. Vision, not v1. |

**[VERIFIED]** François, 2026-09-10, for both names and the ordering.

Module names are internal identifiers, not product names, so they need no domain or
trademark check. Only **Studens** does (7.2).

Two notes on the ordering, because it carries weight it does not yet have evidence for:

- It is a **priority claim**, not just a list. RYC is first because it answers the more
  urgent observed need. That is the right basis for ordering, and it means the order should
  change if the evidence does.
- "What we see in the institutions" is **observation, not the students' own words**, which
  is what OPEN-1 asks for. The two are close but not the same: an observed need is what a
  problem looks like from outside. Recording the distinction so that OPEN-1 is not treated
  as answered by this ordering.

**AI is not a third module.** It is a capability layered into the platform as the work
progresses, on the belief that AI used properly makes things better. **[VERIFIED]** François,
2026-09-10.

It means **product features, not developer tooling**. **[VERIFIED]** François, 2026-09-10,
resolving OPEN-30. Named candidates: summarising reviews into a qualitative overview,
automated moderation of review content (FR-E4), and improving search and recommendation.
AI coding assistants and CI pipeline tooling are explicitly **not** what this refers to.

That answer makes two things live rather than resolving them. All three candidates send review
text to a model, so **OPEN-23** (does contribution text leave the platform) and **OPEN-10**
(GDPR) apply to each. And hosted inference costs money while self-hosting needs hardware the
team does not have, so **OPEN-17** stands. None of it is in v1 (1.4), so none of it blocks.

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

**[VERIFIED]** François, 2026-09-10. Resolves OPEN-1.

**Students choose elective courses blind.**

The moment it happens is the **PAE**, *programme annuel de l'étudiant*: the point each year
where a student commits to their annual course list. The only information available at that
moment is the official syllabus description, which routinely diverges from the lived
experience of the course on the three things that decide whether the choice was right:
workload, teaching style, and how hard the evaluation actually is.

**Why the information exists but does not reach the people who need it.** Three separate
failures, and each one is fixable:

| Failure | What happens |
|---|---|
| **Information decay** | Peer feedback is given in real-time chat, mostly Discord, and is buried within weeks. Every cohort re-asks the same questions from scratch. |
| **No aggregation** | There is qualitative feedback but no numbers, so courses cannot be compared. One person's opinion cannot be told apart from a general view. |
| **Contextual obsolescence** | Feedback is undated, so a reader cannot tell whether it still holds after a change of lecturer or curriculum. |

**How students cope today.** Informal Discord servers and word of mouth. These work
socially and fail as planning tools: not searchable, not persistent, not comparable, and
restricted to whoever is in the right server. The recurring cost falls on senior students
and teaching assistants, who answer the same questions every September.

**Where this is observed.** UCLouvain, École Polytechnique de Louvain (EPL). The first year
is largely mandatory, so the problem concentrates in the elective-heavy later years of
computer science and software engineering, where it shows up as annual "PAE anxiety" among
peers. **[VERIFIED]** François, 2026-09-10, first-hand as an EPL master's student.

**What it costs when the choice is wrong:** courses that do not match the student's skills
or goals; an underestimated elective that causes burnout or failure in a core course; and
the duplicated effort of answering the same questions every year.

#### The validation test

This is the test v1 has to pass. It is the whole point of NFR-Q5, so it is written to be
failable rather than agreeable.

| | |
|---|---|
| **Pass** | A student searches a course by code, for instance `LEPL1503`, and sees a distribution of ratings, date-stamped feedback and workload estimates in one place, before their PAE deadline. |
| **Fail** | A student has to join an external messaging platform and wait for a peer to reply in order to get basic qualitative feedback on a course. |

**One limit, stated so it is not forgotten.** This is first-hand observation of peers, not
interviews. It is specific enough to build against and to fail against, which is what 1.1
needed. It is not yet evidence that the solution is wanted, so NFR-Q5 validation with real
students remains outstanding, and the pass test above is what that validation should run.

### 1.2 Product summary

A web application that authenticated users log into and then use as a host for **modules**.
Modules are self-contained functional areas, basic or advanced. **[VERIFIED]** François,
2026-09-09.

**RYC** ("Rate Your Courses"), a course review tool where **anonymity is an option and not
the default** (3.3), is the intended first module as a *concept*. **[VERIFIED]** François,
2026-09-09. The existing RYC repository is a discarded prototype and is not the module. See
0.1. Whether the module is written fresh here, or salvages anything from that repository, is
**[OPEN-11]**.

### 1.3 In scope for v1

- The shell: authentication, session, navigation between modules.
- The module contract: how a module is defined, mounted, and isolated.
- **One** module, built well enough to be genuinely used.
- The pipeline: build, test, security checks, deploy.

### 1.4 Out of scope for v1

Named explicitly, because the vision in 1.0 is large and scope control is the main risk to
a project with no deadline. Everything here is *deferred*, not rejected.

**[VERIFIED]** François, 2026-09-10, for the whole list. Resolves OPEN-2.

- A second module. **MPA** (My Planning Advisor) is vision, not v1.
- Any AI capability. Not deferred as a *module*, because it is not one (1.0): deferred as a
  capability, meaning v1 ships with none of it and assumes none of it. See OPEN-30.
- **RYC analytics.** The trendline, distribution graphs, workload index and teaching quality
  rating are v2. See 3.4 for each one's reason.
- **Semantic search and recommendations.** Code and title matching only in v1.
- **Any synchronisation with institutional systems.** No student roster integration, no
  enrolment import, no verification against university records. FR-A6 is the direct
  consequence of this being impossible rather than merely deferred.
- Third party module authors. The contract is designed with them in mind (1.5), but v1
  ships with modules written by the core team only.
- More than one institution. v1 serves **UCLouvain** (OPEN-14 resolved), with tenancy kept
  possible in the schema and the interface defaulted to it (1.5 item 1).
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
| 5 | **Shared data is split by whether it is about a person.** The course catalogue and a student's enrolment (PAE) are separate things, stored separately, even though both look like "programme data". | A single shared store holding member enrolment is a linkage engine: it turns "who could have written this anonymous review" from an inference into a query. Splitting them now costs nothing; separating them later is a migration of the most sensitive table in the system. See `design/module-boundaries.md` section 2. **[DERIVED]** 2026-09-10. |

Note what is deliberately absent: multi-tenant routing, an institution admin UI, a plugin
loader, a module marketplace. Those are the expensive parts, and none is needed to keep the
corresponding door open.

### 1.6 Institution and implementation strategy

**[VERIFIED]** François, 2026-09-10. Resolves OPEN-14 and OPEN-11.

**v1 serves UCLouvain**, and the second institution arrives only after v1 has demonstrated
adoption and stability there. The reason given is the right one: building multi-tenant
routing before product-market fit adds operational complexity and splits attention. Candidate
institutions afterwards, by proximity and demand, include ULB, ULiège, UMons and partner
hautes écoles.

What is built now to keep that door open is only what 1.5 item 1 already requires: the tenant
column in the schema, and an interface that defaults to UCLouvain rather than assuming it.

**Unverified:** the intention to fetch a registry of Belgian higher education institutions
from a public educational API. No such API has been identified or checked. Treat it as a hope,
not a plan, until one is found.

**The first module is written fresh.** The prototype was a scaffolded proof of concept whose
value was validation, not longevity, so its code is not carried over.

**But the stack is retained**, meaning the prototype's languages, core libraries and
frameworks, in order to avoid re-running an evaluation that was already made. This resolves
most of the stack question, and it should be read as a deliberate decision rather than an
inheritance. Two conditions on it:

- **The architecture is not part of the stack.** The prototype claimed microservices. That
  claim carries no weight here (0.1), and retaining React, Express, Postgres and Prisma says
  nothing about how the application is structured. The architecture-style decision is separate
  and still open.
- **Docker is not currently usable** in the development WSL environment, so any Compose-based
  workflow has a prerequisite outside this repository.

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
| FR-A6 | MUST | Registration is **open to the public**. No institutional gating, no roster check, no invitation. **[VERIFIED]** François, 2026-09-10. Resolves OPEN-3. |
| FR-A7 | MUST | Authentication supports third party OAuth providers (Google, Microsoft named) and plain email addresses, so that no one is excluded by their email provider. |
| FR-A8 | MUST | Integrity is maintained **after** submission (moderation, reporting, sanctions), not by restricting entry. This is the trade FR-A6 makes. |
| FR-A9 | MUST | A Member's email **domain** may be recorded as a trust signal, and may be shown on attributed contributions. It must never render on an anonymous one (FR-C16). |
| FR-A10 | MUST | A trust signal is described as what it is: evidence of holding an address at a domain. It must not be labelled as proof of current enrolment. |

#### Why registration is open, and what it costs

**[VERIFIED]** François, 2026-09-10.

There is no public roster of active UCLouvain students available to a third party, and no
route to one for a student project. Gating on institutional verification would therefore mean
either an integration nobody will grant us, or friction that kills adoption. So the platform
runs on **good faith at the door and moderation after the fact**.

That is the right call for a zero-budget project with no institutional standing. It has two
consequences that must not be quietly forgotten, because they weaken claims made elsewhere
in this document.

**A domain is not an enrolment check.** `@student.uclouvain.be` proves someone holds, or once
held, an address at that domain. Alumni keep addresses. So the tier means "plausibly
affiliated", never "currently enrolled", and FR-A10 exists to stop the interface saying
otherwise.

**One person can be many Members, so per-member limits bound less than they appear.** Open
registration with free email providers means the quota (FR-C4) and per course uniqueness
(FR-D9, FR-C13) are limits per **account**, not per person. Anyone willing to make accounts
can exceed both. This is not an argument for closing registration; it is an argument for
never describing either limit as an integrity guarantee. The honest description is a speed
bump that stops casual flooding, backed by moderation for anything determined. See
**[OPEN-35]**.

**[OPEN-5]** Identity provider. Narrowed by FR-A7: OAuth plus email, so **not** UCL SSO as
the only route, and SSO is no longer needed to answer OPEN-3. What remains is which specific
providers, and whether self-managed credentials exist at all, since supporting them means
owning password storage, reset flows and breach risk. Cost must be zero either way (CON-1).

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
| FR-B9 | MUST | Shared, impersonal, read-mostly data (the course catalogue and similar) lives in a **reference module** that holds **no personal data** in any column. Feature modules read it; only its owner writes it. **[DERIVED]** 2026-09-10, `design/module-boundaries.md`. |
| FR-B10 | MUST | Dependencies point one way: feature module to reference module to platform service. No feature module depends on another feature module, directly or through shared tables. Extends FR-B3 and FR-B6. |
| FR-B11 | MUST | Where a module needs something the platform knows about a Member, it asks a question with a narrow answer, rather than fetching the underlying data. **Ask questions, do not fetch data.** |
| FR-B12 | MUST | No log, metric or trace record may carry a Member identifier and a contribution target identifier together. This is FR-C5 applied to telemetry, which is written by infrastructure rather than by reviewed code. |
| FR-B13 | MUST | Cross-module aggregation is keyed on reference data, never on a Member, wherever the anonymous path is involved. |

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

**Transparent by default. Anonymity is a choice, not an obligation.** In RYC the default is
to publish under the contributor's real account; the contributor opts in to anonymity for a
given review. **[VERIFIED]** François, 2026-09-10. Resolves the default half of OPEN-22.

That choice is a genuine product improvement and a significant engineering complication.
The traps below are not hypothetical; they are the standard ways optional anonymity fails.

#### The complement problem, and why transparency by default makes it worse

Recorded here because François has flagged it as an open worry ("figure out how to avoid
bad surprises") and it has a precise form. **[DERIVED]**, 2026-09-10, from the default
decision above. Not yet reviewed by François.

FR-C2 through FR-C6 protect an anonymous review by making sure nothing **inside** the
record points at its author. They say nothing about what the **other** records reveal.

Take a course with a cohort of 12 students, where each student may leave one review. Nine
students publish attributed reviews. One anonymous review appears. The author of that
anonymous review is one of the **three** students who did not publish attributed. If eleven
publish attributed, the anonymous author is identified with certainty, and no property of
the anonymous record itself was breached to do it.

Three things follow, and they are uncomfortable:

1. **The attack uses only public data.** No database access, no timestamps, no correlation.
   A reader with the enrolment list and the page in front of them can do it. That puts it
   inside the FR-C3 threat model, not outside it.
2. **Higher attributed participation makes it worse.** A transparent default drives exactly
   that, so the default chosen for good product reasons works against the guarantee. This is
   a real tension, not a bug to fix in code.
3. **It is worst in small cohorts**, which is most electives and every seminar. This is the
   same underlying issue as OPEN-19, arriving from the other direction: OPEN-19 asks whether
   there are enough anonymous reviews to hide in, and this asks whether there are enough
   **silent** members to hide among.

**How this was resolved, and what is left standing.** The attack depends on a rule: that a
member may leave only one review per course, so that publishing attributed removes you from
the candidate set. **[VERIFIED]** François, 2026-09-10, Option 1: the rule is enforced on the
**attributed path only** (FR-C13). Two things follow, and they pull in opposite directions.

The good half: per course uniqueness **cannot** be enforced anonymously, because doing so
requires a member-and-course marker, which is the rejected Option C of
`design/anonymous-rate-limiting.md` and a direct breach of FR-C2. So in fact nothing stops a
member from posting an attributed review of a course **and** an anonymous one. An attacker
cannot safely exclude the attributed reviewers, and the complement narrows to a probability
rather than a certainty.

The bad half: that only holds **while the platform does not claim otherwise**. Announcing
"one review per course per person" as a global rule tells an attacker to exclude every
attributed reviewer, which hands them the certainty the engineering had denied them. The rule
would then be unenforceable **and** actively harmful. Hence FR-C17: the uniqueness claim is
scoped to the attributed path in public wording, and the anonymous path is never described as
limited to one per course.

This is an uncomfortable place to be. The guarantee partly rests on an enforcement gap rather
than on a mechanism, which is weaker than the rest of FR-C and must be described honestly
under FR-C12. It is not a reason to add the marker: adding it would replace a probabilistic
exposure with a certain one.

The remaining mitigations all cost product value: withhold cohort size, do not list attributed
reviewers per course, or suppress anonymous reviews below a threshold (OPEN-19). None is free,
and none is chosen yet. **OPEN-19 is now the only structural lever left**, which promotes it
from a refinement to a decision that matters.

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
| FR-C13 | MUST | Per course uniqueness (FR-D9) is enforced on the **attributed** path only. On the anonymous path the quota (FR-C4) is the only limit. **[VERIFIED]** François, 2026-09-10, Option 1. |
| FR-C14 | MUST | An **attributed** contribution can be edited by its author. Contrast FR-C9, which is not a policy choice but a structural consequence. **[VERIFIED]** François, 2026-09-10. Resolves OPEN-22. |
| FR-C15 | MUST | Whether a contribution is anonymous or attributed **is** publicly visible: attributed shows the author, anonymous shows an explicit badge. **[VERIFIED]** François, 2026-09-10. Resolves OPEN-21. |
| FR-C16 | MUST | **No trust tier, domain, institution or other author attribute renders on an anonymous contribution.** The anonymous badge is the only marker it carries. **[DERIVED]** 2026-09-10. |
| FR-C17 | MUST | The platform must not publicly state or imply that one person can leave only one anonymous review of a course. It cannot enforce that, and asserting it narrows the candidate set for an attacker. **[DERIVED]** 2026-09-10. |

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

### 3.4 First module: RYC (FR-D)

**[VERIFIED]** François, 2026-09-10. Resolves OPEN-13. The v1 / v2 split is his call of the
same date: build the core, defer the analytics.

RYC answers the problem in 1.1: it replaces "ask in Discord and hope" with a searchable,
persistent, comparable record of what a course is actually like.

The shape borrowed deliberately is an **app store review page**, not a discussion forum.
One considered review per person per course, not a thread. This drives several decisions
below, including FR-D9.

#### v1

| ID | Priority | Requirement |
|---|---|---|
| FR-D1 | MUST | A Member can find a course by its **code** (for instance `LEPL1503`) with instant, typeahead search. |
| FR-D2 | MUST | A Member can find a course by words in its **title**. Exact and prefix matching only in v1; semantic matching is deferred (1.4). |
| FR-D3 | MUST | Each course has a page showing its identity, its aggregate ratings, and its reviews, newest first. |
| FR-D4 | MUST | Every review displays the **academic year it concerns** and the date it was submitted. This answers the contextual obsolescence failure in 1.1 and is not optional. |
| FR-D5 | MUST | A review carries an **overall rating**, 1 to 5. |
| FR-D6 | MUST | A review carries **workload** as self-reported hours per week. |
| FR-D7 | MUST | A review carries **perceived difficulty** on a fixed scale. |
| FR-D8 | MUST | A review carries **review text**, with a minimum length to prevent low-effort entries. 150 characters proposed. See OPEN-37 for the interaction with the anonymous path. |
| FR-D9 | MUST | **On the attributed path only:** one review per Member per course per academic year. Not enforceable on the anonymous path, see below and FR-C13. |
| FR-D10 | MUST | A course page shows the count of reviews it is aggregating, so a reader can judge how much weight the average carries. |
| FR-D11 | SHOULD | A review carries an **advice** field, "tips for success in this course". |
| FR-D12 | SHOULD | A Member can see their own attributed reviews in one place, in order to edit them (FR-C14). |

#### Deferred to v2

Listed because they were specified and deliberately set aside, not forgotten. François's
call, 2026-09-10.

| Feature | Why it waits |
|---|---|
| **Sentiment trendline**, year over year | Cannot work at launch: it needs several years of data before it says anything. Nothing is lost by waiting, and FR-D4 keeps the data being collected for it. |
| **Distribution graphs** ("30% found this very difficult") | Over a handful of reviews this is both uninformative and identifying. Blocked on OPEN-19. |
| **Workload index** (reported hours against official ECTS) | Needs ECTS from the catalogue, so it is blocked on OPEN-33. Cheap once that lands. |
| **Teaching quality** as a fourth separate rating | Deferred to keep the submission form short. Partly covered by FR-D5 and the review text. |
| **Semantic search and recommendations** | Needs a model. See OPEN-17. |

#### Two consequences worth reading before implementing

**Courses are identified by code plus academic year.** **[DERIVED]** 2026-09-10, resolving
OPEN-32. It follows from FR-D4 and from the deferred trendline: detecting whether a course
improved after a change of lecturer is only meaningful if a review is attached to a specific
year's offering. A course code alone would silently average an old lecturer's course with a
new one, which is the exact failure the trendline exists to expose. The catalogue must
therefore carry a year dimension from the first schema (`design/module-boundaries.md`).

**Rich reviews are easier to attribute.** Three numbers plus 150 or more characters of prose
is a detailed record. Within a cohort of a dozen students, writing style alone can identify
an author, and no schema decision prevents that. This is a real cost of FR-D8's quality
goal, it is not fixable in code, and FR-C12 therefore has to disclose it rather than
pretending the anonymity guarantee is stronger than it is. See OPEN-37.

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
directly with FR-C: strong unlinkability is the strongest answer to most of it, since
data that cannot be linked to a person is far easier to defend. Needs confirmation, not
assumption.

## 6. Acceptance

v1 is complete when every MUST requirement has a passing test, section 7 is empty, and
NFR-Q5 validation has been carried out with real users.

## 7. Open questions

These block agreement. None may be silently assumed.

| ID | Question | Blocks |
|---|---|---|
| ~~OPEN-1~~ | ~~What is the problem, in the words of the people who have it?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-2~~ | ~~What is explicitly out of scope for v1?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-3~~ | ~~Who is allowed to become a Member?~~ **RESOLVED 2026-09-10.** | closed |
| OPEN-4 | Session lifetime and inactivity timeout? | FR-A3 |
| OPEN-5 | Which identity provider? | FR-A1, CON-1 |
| ~~OPEN-6~~ | ~~How to rate limit contributions without linking them?~~ **RESOLVED 2026-09-09: Option A, fixed window.** | closed |
| OPEN-7 | Is the 24 hour moderation target sustainable? | FR-D, staffing |
| OPEN-8 | How are Moderators appointed? | FR-E3 |
| OPEN-9 | Expected load, acceptable downtime, recovery expectations? | NFR-O |
| OPEN-10 | Does the GDPR apply, and what is the lawful basis? | CON-1, FR-C |
| ~~OPEN-11~~ | ~~Is the first module written fresh, or does it salvage from the prototype?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-12~~ | ~~Is anonymous contribution a real product goal?~~ **RESOLVED 2026-09-09: yes, and it is the contributor's choice per contribution.** | closed |
| ~~OPEN-13~~ | ~~What must the first module actually do?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-14~~ | ~~Which single institution does v1 serve, and when does the second arrive?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-15~~ | ~~Are secondary school users in the vision?~~ **RESOLVED 2026-09-09: no.** Higher education only. | closed |
| OPEN-16 | Trusted contributors, vetted catalogue, or untrusted plugins? | FR-B7, FR-B8, security model |
| OPEN-17 | How does **any** AI capability fit a zero budget constraint? Reframed 2026-09-10: AI is not a module (1.0), so the cost question applies wherever it lands, not to one deferrable feature. | CON-1, vision 1.0, OPEN-30 |
| OPEN-18 | Who governs contributions? Review authority, merge rights, and how an outside module is accepted. **Licence part resolved 2026-09-09: MIT.** | Outside collaboration, OPEN-16 |
| OPEN-19 | Is a minimum anonymity set required before an anonymous contribution is shown? Sharpened 2026-09-10 by the complement problem in 3.3: the set that matters may be the **silent** members, not the anonymous ones. | FR-C5, OPEN-31 |
| ~~OPEN-20~~ | ~~Can a contributor manage their own anonymous contributions?~~ **RESOLVED 2026-09-09: no. No editing, no deletion, ever.** | closed |
| ~~OPEN-21~~ | ~~Is anonymous or attributed status publicly visible on a contribution?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-22~~ | ~~Can an attributed contribution be edited, deleted, or made anonymous later?~~ **RESOLVED 2026-09-10.** | closed |
| OPEN-23 | Does contribution text leave the platform to a third party inference service? | FR-E4, CON-1, OPEN-10, OPEN-17 |
| OPEN-24 | Threshold for automatic removal versus holding for a human? | FR-E5, FR-E6 |
| ~~OPEN-25~~ | ~~Is per target uniqueness required (one review per course per person)?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-28~~ | ~~Product name and repository name?~~ **RESOLVED 2026-09-09: Studens.** | closed, BOIP check still outstanding |
| OPEN-29 | Hosting target. **Vercel** raised as a free candidate. **Verify before designing around it:** (1) whether the free Hobby tier still prohibits commercial use, which a sponsored or funded student platform could trip; (2) that a stateful modular monolith fits its serverless model, which is doubtful; (3) that it provides no database, so Postgres still needs a separate free host. Unverified as of 2026-09-09. | CON-1, architecture |
| OPEN-26 | What is the quota, and per what period? | FR-C4, design note |
| ~~OPEN-27~~ | ~~Live adversary with database write stream access in the threat model?~~ **RESOLVED 2026-09-09: no.** | closed |
| ~~OPEN-30~~ | ~~Where does AI actually sit?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-31~~ | ~~May a Member publish both an attributed and an anonymous review on the same course?~~ **RESOLVED 2026-09-10.** | closed |
| ~~OPEN-32~~ | ~~Is a course reviewable as a code, or as a code plus academic year?~~ **RESOLVED 2026-09-10.** | closed |
| OPEN-33 | Where does the course catalogue come from, and who maintains it? Hand-encoding is recurring data entry; importing depends on the institution's format and permission. | CON-1, OPEN-14, FR-B9 |
| OPEN-34 | When MPA arrives, who owns enrolment: a platform service or MPA itself? Do not decide before there is a second consumer. | FR-B11, 1.0 |
| OPEN-35 | Open registration means one person can hold many accounts, so the quota (FR-C4) and per course uniqueness (FR-D9) bound accounts, not people. Is that accepted as a speed bump, or is some cost imposed on account creation? | FR-A6, FR-C4, FR-D9 |
| OPEN-36 | Do attributed contributions show a **full name** or a **username**? A real name is stronger accountability, more identifying under the GDPR, and makes the complement problem sharper. | FR-C15, OPEN-10, 3.3 |
| OPEN-37 | Does the FR-D8 minimum review length apply on the **anonymous** path? Longer text is better data and a better stylometric fingerprint. Options: same minimum, a lower one, or a warning at submission time. | FR-D8, FR-C12, 3.3 |

**OPEN-19 is now the load-bearing one.** With OPEN-25 and OPEN-31 resolved as Option 1, the
complement problem in 3.3 has no structural mitigation left except a minimum anonymity set.
It was a refinement when it was written; it is now the only lever. It cannot be answered
before there is a view on how thin real course pages will be at launch, which makes it the
first thing to revisit after the catalogue exists.

**OPEN-17 is a real conflict, not a detail.** CON-1 forbids paid services. Hosted language
model inference is a paid service, and self-hosting a useful model needs hardware nobody on
this team currently has. OPEN-30 confirmed all three intended uses are product features over
review text, which makes the conflict concrete rather than hypothetical. Nothing in v1
depends on it (1.4), so it does not block, but it should not be treated as solved by having
been deferred.

### 7.1 Resolved

| ID | Question | Resolution |
|---|---|---|
| OPEN-15 | Secondary school users, and therefore minors? | **No.** Higher education only: universities and hautes écoles. All users are adults, so no parental consent regime, no heightened GDPR bar for children, and no safeguarding duty toward minors. Resolved 2026-09-09. |
| OPEN-12 | Is anonymous contribution a real product goal? | **Yes, and it is the contributor's choice.** Anonymity is a core value. Each contribution is published either anonymously or under the contributor's real account, chosen by them. Unlinkability is therefore a central design constraint, and section 3.3 applies in full. Resolved 2026-09-09. |
| OPEN-20 | Can a contributor manage their own anonymous contributions after submitting? | **No. No editing, no deletion, ever.** The strong answer, taken deliberately: it preserves FR-C2 and FR-C3 with no exception path, at a real cost in convenience. Moderators retain removal powers (FR-C10); the restriction binds the contributor, not the platform. Resolved 2026-09-09. |
| OPEN-6 | How to rate limit without linking? | **Option A, fixed window.** A counter on the member record, nothing on the contribution. No cryptography. See `design/anonymous-rate-limiting.md`. Resolved 2026-09-09. |
| OPEN-27 | Live database write stream adversary in the threat model? | **No.** Proportionality judgement for a small free project. Consequence: the residual correlation in design note 4.1 is knowingly accepted, and FR-C12 requires the privacy statement to disclose it rather than claim absolute unlinkability. Resolved 2026-09-09. |
| OPEN-18 (licence part) | Which licence? | **MIT.** Permissive, chosen over AGPL with the trade-off understood: anyone may host a derivative commercially without contributing back, in exchange for the lowest possible barrier to the outside contributors the vision depends on (1.0). Inbound equals outbound, so no contributor licence agreement is needed. The remaining half of OPEN-18, contribution governance, stays open. Resolved 2026-09-09. |
| OPEN-1 | What is the problem, in the words of the people who have it? | **Students choose elective courses blind at PAE time.** Full statement, root causes, current coping (Discord and word of mouth) and a failable pass/fail test in 1.1. Caveat recorded: first-hand observation of peers, not interviews, so NFR-Q5 validation with real students is still outstanding. Resolved 2026-09-10. |
| OPEN-2 | What is explicitly out of scope for v1? | **Listed in 1.4.** Second module, all AI, RYC analytics, semantic search, any institutional system integration, third party module authors, more than one institution, secondary education. Resolved 2026-09-10. |
| OPEN-3 | Who is allowed to become a Member? | **Anyone.** Open public registration via OAuth or email, no institutional gating, because no student roster is obtainable by a third party. Integrity moves to post-submission moderation (FR-A6 to FR-A10). Two costs recorded in 3.1: a domain is not an enrolment check, and one person can hold many accounts. See OPEN-35. Resolved 2026-09-10. |
| OPEN-11 | Is the first module written fresh, or does it salvage from the prototype? | **Written fresh, stack retained.** No code carried over; the prototype's languages, core libraries and frameworks are kept to avoid re-running the evaluation. Its microservices claim is explicitly not retained. See 1.6. Resolved 2026-09-10. |
| OPEN-13 | What must the first module actually do? | **Specified in 3.4**, FR-D1 to FR-D12. Search by code and title, course page, overall rating, workload hours, difficulty, review text with a minimum length, academic year on every review, one review per member per course on the attributed path. Analytics deferred to v2. Resolved 2026-09-10. |
| OPEN-14 | Which single institution does v1 serve, and when does the second arrive? | **UCLouvain**, second only after v1 shows adoption and stability. Preparation limited to the tenant column and an interface defaulted to UCLouvain. See 1.6. Resolved 2026-09-10. |
| OPEN-21 | Is anonymous or attributed status publicly visible? | **Yes.** Attributed shows the author, anonymous shows an explicit badge (FR-C15). Constrained by FR-C16: no author attribute may render on an anonymous contribution. Resolved 2026-09-10. |
| OPEN-22 | Can an attributed contribution be edited, deleted, or made anonymous later? | **Editing: yes** (FR-C14). Conversion to anonymous is not offered: anyone who saw it already knows the author, and FR-C9 would then forbid deletion, leaving a contribution the author cannot remove whose authorship is known. Resolved 2026-09-10. |
| OPEN-25 | Is per target uniqueness required? | **Yes, attributed path only** (Option 1). Not enforceable anonymously without a member-and-course marker, which FR-C2 forbids. FR-C13. Resolved 2026-09-10. |
| OPEN-30 | Where does AI sit? | **In the product, not the development pipeline.** Review summarisation, automated moderation, search improvement. Not coding assistants or CI tooling. Does not resolve OPEN-17 or OPEN-23. Resolved 2026-09-10. |
| OPEN-31 | May a Member publish both attributed and anonymously on the same course? | **Policy says no, and the platform cannot enforce it.** Resolved with OPEN-25 as Option 1. The enforcement gap is what keeps the complement attack probabilistic rather than certain, hence FR-C17. See 3.3. Resolved 2026-09-10. |
| OPEN-32 | Course code, or code plus academic year? | **Code plus academic year.** [DERIVED] from FR-D4 and the deferred trendline: averaging across a change of lecturer is the failure the trendline exists to expose. Resolved 2026-09-10. |
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
| **RYC** | Rate Your Courses. The first module, section 1.0. | Not the discarded prototype repository of the same name, see 0.1. |
| **MPA** | My Planning Advisor. The second named module, section 1.0. Vision, not v1. | |

## 9. Sources

- François Meli, project context, 2026-09-09 and 2026-09-10. **Authoritative.**
  2026-09-10 added: module names RYC and MPA and their ordering, the open ended catalogue,
  AI as a capability rather than a module, and transparency as the default in RYC. Later the
  same day, written answers to nine open questions (OPEN-1, 2, 3, 11, 13, 14, 21, 25, 30, 31),
  supplied as documents, plus the v1/v2 split of the RYC feature set and Option 1 on per
  course uniqueness. Role and date placeholders in those documents were left unfilled and are
  deliberately not recorded: there is no engineering team, design lead, faculty contact or
  governance committee, and no launch date.
- `design/anonymous-rate-limiting.md` (Accepted 2026-09-09) and
  `design/module-boundaries.md` (Proposed 2026-09-10). Design notes in this repository.
- <https://github.com/Lord-Melflam/RYC>, README, `docs/PRIVACY.md`, `docs/MODERATION.md`,
  `SECURITY.md`, read 2026-09-09. **Prior art only, not authoritative**, see 0.1.
  `docs/API.md` exists and has not been read. Given its status, reading it is low priority.
