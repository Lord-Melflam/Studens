# Design note: choosing the architecture style

| | |
|---|---|
| Status | **Accepted** 2026-09-10 |
| Decision | **Option C: modular monolith with enforced boundaries, plus one worker process**, one Postgres with a schema per module and a role per schema, on the single Always Free VM. |
| Decided by | François, 2026-09-10, after reviewing the concrete schema in section 12 |
| Date | 2026-09-10 |
| Decides | `CLAUDE.md` open decision "Architecture style" |
| Constrained by | FR-C2, FR-C6, FR-C13, FR-B3, FR-B9 to FR-B13, CON-1, CON-3, section 5.2 |
| Depends on | **OPEN-16**, see section 6 |
| Raises | OPEN-39, OPEN-40, OPEN-41 |
| Corrects | FR-B9 and FR-C3, both found to be wrong when the schema was drawn. See section 13 |

## 0. Why this is decided now and not earlier

The first sketch of this question (monolith against microservices) was made before anything
was known. It is answerable now because five things have since become facts rather than
guesses:

| Fact | Source |
|---|---|
| Deployment is **one** ARM VM, 2 OCPU and 12 GB, no budget for a second | 5.2, resolved 2026-09-10 |
| Load is a few hundred active users with a calendar spike | 4.4, OPEN-9 |
| The database is **relational, with transactions**, and that is load bearing | CC-4, `anonymous-rate-limiting.md` |
| v1 ships **one** feature module plus a reference module | 1.3, 1.4, 3.4 |
| The anonymity invariant is a **cross-tier** property | FR-C13, FR-C6 |

The last one turns out to be decisive, and it was not visible before the rate-limiting design
existed.

## 1. The candidates

Six, not two. The usual framing (monolith against microservices) hides four options that are
live for this project.

| | Style | Shape |
|---|---|---|
| **A** | Unstructured monolith | One deployable, one database, no enforced internal boundaries |
| **B** | Modular monolith | One deployable, one database, boundaries declared and enforced at build time |
| **C** | Modular monolith **plus worker** | B, plus a second process for background work, same codebase and database |
| **D** | Microservices | Independent deployables, database per service, network calls between them |
| **E** | Serverless / FaaS | Per-request functions, managed platform, external database |
| **F** | Plugin host | One deployable that loads module code at runtime, possibly third-party code |

## 2. Criteria, derived from our own documents

Not a generic checklist. Each criterion is something this project has already committed to,
in the priority order of `CLAUDE.md` Goals, with the hard constraint first because it
overrides preference.

1. **Preserves the anonymity invariant.** FR-C2, FR-C6, FR-C13. Not negotiable.
2. **Verifiable.** Goal 4, the two V's. Can the invariant be *proven*, not just reviewed?
3. **MEA.** Goal 1. Maintainable, Evolvable, Adaptable, which behave differently here.
4. **A small app that genuinely works.** Goal 2, CON-3.
5. **DevSecOps runnable by one to three people.** Goal 3.
6. **Fits one Always Free VM at zero cost.** CON-1, 5.2.
7. **Leaves the outside-contributor path open.** Vision 1.0, FR-B7.
8. **Leaves the tenancy path open.** 1.5 item 1.

## 3. The decisive criterion: the anonymity invariant is cross-tier

This is the argument that settles the question, so it comes first and in detail.

**What the invariant requires.** FR-C13 enforces a quota that lives on the **member record**
(platform tier). The contribution is written to the **anonymous store** (module tier). Both
must happen, or neither, and the accepted design in `anonymous-rate-limiting.md` does it with
one atomic conditional update:

```sql
UPDATE members SET quota_used = quota_used + 1
 WHERE member_id = ? AND quota_used < limit;
-- then, in the same transaction, insert the contribution
```

Two writes, two tiers, one transaction, and **no shared key between them**.

**What each style does to it.**

**A, B, C.** One database, so one transaction. The two writes commit or roll back together
and nothing correlates them in the schema. The invariant holds by construction.

**D, microservices.** Database per service means the quota and the contribution live in
different databases. A single transaction is not available, so the options are two-phase
commit or a saga. Both fail, and the second fails in a way worth spelling out:

> A saga coordinates two operations by carrying a **correlation identifier** and persisting
> its progress in a saga log. That log necessarily records "member X's quota increment
> belongs with contribution Y". That is exactly the member-and-target pair FR-C2 forbids and
> `anonymous-rate-limiting.md` rejected as Option C. The coordination mechanism *is* the
> forbidden link.

Worse, sagas need compensating actions, and the compensating action for "an anonymous
contribution was published" does not exist in any reliable form.

**So microservices and this anonymity design are close to incompatible.** Not
"harder", not "more work": the mechanism that makes distributed consistency possible is the
mechanism the privacy design exists to prevent. That is a requirement-derived exclusion, not
a preference.

**E, serverless.** Neutral on this criterion. Functions can share one database and one
transaction. It fails on other criteria instead.

**F, plugin host.** Neutral if plugins are trusted, fatal if not. See section 6.

**One honest qualification.** The monolith does not make correlation vanish. Both writes land
in the same transaction, so the database's write-ahead log contains them together. That is
the same family of exposure as write-timing correlation, which `anonymous-rate-limiting.md`
section 4.1 already documents and which OPEN-27 placed out of scope. The difference is real
but narrow: in the monolith it is a **transient log entry inside an accepted scope limit**,
whereas in microservices it is a **persistent, queryable business record**. Recorded so the
monolith is not credited with more than it earns.

## 4. Verifiability: the invariant must be testable, not just reviewable

Goal 4 asks for verification, and FR-C8 already specifies the mechanism: an automated test
that fails if an identifier ever reaches the anonymous path.

**That test is a schema test.** It enumerates the columns of the anonymous contribution table
and fails if any could hold a member identifier. It works because there is one schema to
enumerate. Across N services with N databases, no such test exists: unlinkability becomes a
property of the *system*, provable only by reasoning about every service and every message
between them. From the SQA reading, that is the move from a decidable static check to a
distributed property with no practical oracle.

**The safety kernel pattern applies directly.** The SQA material's design-for-verification
advice is to concentrate a critical property in a small kernel that can be verified
exhaustively, rather than spreading it across the system. Here that kernel is the **only code
path that writes to the anonymous store**. In a modular monolith it can be one small module,
small enough to review line by line and to test to MC/DC. In microservices there is no
kernel, because the property spans process boundaries.

This criterion points the same way as section 3, for an independent reason. That matters:
two unrelated derivations reaching the same answer is stronger than one.

## 5. The remaining criteria

| Criterion | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Preserves the anonymity invariant | yes | yes | **yes** | **no** | yes | conditional |
| Invariant is mechanically verifiable | yes | yes | **yes** | **no** | yes | conditional |
| Maintainable | **no** | yes | **yes** | yes | partly | partly |
| Evolvable | **no** | yes | **yes** | yes | partly | yes |
| Adaptable | **no** | yes | **yes** | yes | partly | yes |
| Small app that works | yes | yes | **yes** | **no** | partly | no |
| Runnable by 1 to 3 people | yes | yes | **yes** | **no** | yes | no |
| Fits one free VM | yes | yes | **yes** | **no** | **no** | yes |
| Outside-contributor path stays open | **no** | yes | **yes** | yes | yes | yes |
| Tenancy path stays open | partly | yes | **yes** | yes | yes | yes |

Reasons for each **no**, since a table is not an argument:

**A fails MEA outright.** Without enforced boundaries, Lehman's second law (increasing
complexity) applies with nothing to resist it: modules reach into each other because it is
the cheapest thing to do, and the boundary can never later be turned into the public
extension point the vision needs. FR-B6 exists precisely to make this failure impossible.
A is the baseline, not a candidate.

**D fails four criteria beyond section 3.** On one VM it has all the cost and none of the
benefit: no independent scaling (there is one machine), no fault isolation beyond process
isolation, a shared kernel, and a network hop replaced by localhost. The CC material's own
warning list applies in full (a distributed system, a partitioned database, testing and
deployment that must be handled as code with runtime discovery), and it recommends Kubernetes
or a microservice-aware PaaS, neither of which is free. And the scalability cube is explicit
that microservices are the **Y axis**, functional decomposition, which is for conflicting
resource requirements and independent release cadence. With one feature module, measured load
of a few hundred users, and one deployment target, there is no Y-axis problem to solve.

**E fails on hosting, already decided.** 5.2 chose one VM after rejecting Vercel on verified
grounds. Serverless is not available at zero cost with a long-running process and a real
Postgres. Worth noting it is not *foreclosed*: FR-A3 keeps session state in a token, so the
backend is stateless by REST constraint 2, which is exactly what a future move to functions
would need. The door stays open at no cost.

**F fails now and may be needed later.** Section 6.

## 6. The one real argument for more separation, and what to do about it

The vision wants a catalogue of modules with outside contributors. That is the only
requirement pulling away from a monolith, and it deserves a straight answer.

**It depends entirely on OPEN-16**, which asks whether contributors are trusted, whether the
catalogue is vetted, or whether modules are untrusted plugins. The three answers have
different architectural consequences:

| OPEN-16 answer | Consequence |
|---|---|
| **Trusted contributors**, code reviewed and merged by the core team | In-process modules are correct **permanently**. B or C is the end state, not a stage |
| **Vetted catalogue**, third-party code reviewed before admission | Same as above, with the review as the control. B or C still correct |
| **Untrusted plugins**, third-party code running without review | **In-process is wrong.** Untrusted code sharing a process with database access defeats FR-C entirely, and no lint rule constrains it |

So the architecture decision has a **dependency**, and it should be recorded as one. But it
does not block, for two reasons. v1 ships modules written by the core team only (1.4). And
even the third answer does not imply microservices: it implies process isolation **for
untrusted modules specifically**, which is a hybrid where the trusted core stays a monolith
and untrusted code runs in a sandbox with no direct database access. That is a smaller and
later change than adopting microservices now, and adopting them now would not even prepare
for it.

**What keeps that door open costs nothing.** FR-B10's one-way dependency rule and FR-B11's
ask-questions-do-not-fetch-data rule are precisely what make a module extractable later:
replace an in-process call with a network call and the module's storage becomes its own
database. That is the CC-2 argument, and it is already recorded as a requirement.

## 7. The refinement: why the proposal is C and not B

Plain B is not quite right, because two workloads already exist that must not run in a
request path, and both were identified before this note:

| Workload | Why it cannot be in the request path |
|---|---|
| **Moderation** (FR-E4 to FR-E6, filters and possibly model passes) | Slow, and the submission response must not wait for it |
| **Catalogue ingestion** (`catalogue-ingestion.md`) | A full crawl of 20 faculties with a self-imposed delay between requests. Long, network-bound, yearly |

The CC material's answer to this is not a microservice, it is a **worker**: the Heroku worker
dyno pattern, which it calls a typical design strategy, moving computationally intensive work
out of the web layer onto a queue. Same codebase, same database, separate process, no network
protocol between them beyond the queue.

**This is the "conflicting resource requirements" item from the monolithic-hell list**, and it
is the one item on that list that genuinely applies to us today. Answering it with a worker
rather than a service split is the proportionate response.

**One consequence for FR-C, and it is not obvious.** A moderation queue holds an anonymous
contribution while it waits. If the queue entry carries a submitter reference so the pipeline
can sanction the author, unlinkability is broken **in the queue** even though the final
storage is clean. FR-E7 makes author sanctions impossible on the anonymous path, and CC-13
already flagged this; the worker is where it becomes concrete. The queue is storage, even
though it looks like plumbing.

## 8. Sub-decision: one database, one schema per module

Recommended, and worth separating from the main choice because it is where FR-B3 stops being
a convention.

FR-B6 requires that violations of FR-B3 fail the build. A lint rule (`no-restricted-imports`)
catches imports. It does **not** catch a module issuing SQL against another module's tables,
because that is a string, not an import.

**A schema per module, in one database, with a distinct database role per module**, makes
that violation impossible rather than merely detected: the role has no grant on the other
module's tables, so the database refuses. Mechanical enforcement by the strongest available
mechanism, which is the SQA "design for verification" principle applied to the boundary.

And because the schemas share **one database**, a transaction still spans them, so section 3
survives intact. This is the specific combination that gets enforcement and transactions at
once. Neither a shared schema (no enforcement) nor separate databases (no transaction) does.

**The complication, stated because rule 8 requires the cost.** The cross-tier transaction in
section 3 touches both the platform and the module tier, so it cannot run under a role
restricted to one of them. The shape the constraint forces is that **the platform owns that
transaction**: the module calls a platform service to submit a contribution, the platform
opens one transaction, performs the conditional quota update, and writes the contribution.
That is FR-B11 again ("ask questions, do not fetch data"), and it places the invariant inside
the platform, which is what makes the safety kernel in section 4 a real thing rather than a
metaphor. Recorded as **OPEN-39**, since the exact division of labour is an implementation
decision and should not be settled in prose.

## 9. Costs accepted

Rule 8 requires naming them, not just the benefits.

- **One deployable means one blast radius.** A fault anywhere can take the whole application
  down. The mitigations are the worker split (slow work cannot block the web path) and
  NFR-O1's tested backup. Fault isolation is genuinely worse than D would give, on one VM.
- **One language and framework for everything.** Already accepted for a different reason:
  OPEN-11 retained the prototype's stack, so the "cannot adopt a new framework per module"
  cost of a monolith is a cost we already chose to pay.
- **Deployment is all-or-nothing.** FR-B5 wants a module disabled without redeploying the
  others, which becomes a feature-flag problem rather than a deployment problem. That is a
  weaker form of the requirement, and it should be acknowledged rather than glossed.
- **The boundaries are only as good as their enforcement.** If FR-B6's build gate is ever
  removed or made advisory, this degrades to option A, which fails MEA outright. The gate is
  load bearing infrastructure, not a nicety.

## 10. What would change the answer

Rule 8's fourth requirement. Each of these is observable, so the decision can be revisited on
evidence rather than on feeling.

| Trigger | Response |
|---|---|
| **OPEN-16 resolves to untrusted third-party modules** | Sandbox untrusted modules in their own process with no database access. Trusted core stays as is |
| A module appears with resource needs a worker cannot absorb | Extract that module only. FR-B10 and FR-B11 make it mechanical |
| The codebase exceeds what one developer can hold. Observable as onboarding time and review latency, not as a line count | Tighten boundaries first, since Lehman's laws predict this regardless of style. Split only if that fails |
| Multi-institution becomes multi-**deployment** rather than multi-tenant | Re-examine. One deployable per institution is a different problem from one deployable serving many |
| Measured load exceeds one VM | Scale on the X axis first (clone behind a load balancer, which stateless sessions already allow). The Y axis is still not the answer to a load problem |

None of these is true today, and three of them are not decidable today.

## 11. Open questions raised here

- **[OPEN-39]** Where exactly does the cross-tier transaction live, given a database role per
  module? Section 8 argues the platform must own it. The division of labour between platform
  and module for a contribution submission is an implementation decision and should be made
  against real code, not prose.
- **[OPEN-40]** Does the worker share the web process's deployment, or is it deployed
  separately? Same codebase either way. Shared is simpler; separate lets the worker be
  restarted without touching the web path, which matters given the Oracle reclamation risk in
  5.2.

## 12. What the database actually looks like

Drawn before the decision was confirmed, because a style that cannot be written down as a
schema is not a decision. One database, one schema per module, one distinct role per schema.

```
  platform                      (role: studens_platform)
    tenants          tenant_id, name
    members          member_id UUID, provider, provider_subject, email_domain,
                     display_name, tenant_id, role, created_at
    member_quota     member_id, window_start DATE, used INT      <- no per-submission time
    sessions         session_id, member_id, issued_at, last_seen, revoked_at
    audit_log        entry_id, actor_member_id, action, target_kind, target_id, at

  ref                           (role: studens_ref, read-only to other modules)
    institutions     institution_id, name
    faculties        faculty_id, institution_id, code
    programmes       programme_id, faculty_id, code, year
    courses          course_id, institution_id, code, year, title, ects,
                     language, quarter
    course_teachers  course_id, teacher_name

  ryc                           (role: studens_ryc)
    reviews_attributed   review_id UUID, member_id FK, course_id FK,
                         rating, workload_hours, difficulty, body, advice,
                         created_at, updated_at, status
    reviews_anonymous    review_id UUID, course_id FK, rating,
                         workload_hours, difficulty, body, advice,
                         created_at DATE, status
                         ^ no member column exists, in any form
```

Three properties of `reviews_anonymous` are load bearing and none is incidental:

- **No member column, of any kind.** FR-C6 becomes structural rather than a matter of
  application code being correct forever.
- **`review_id` is a random UUID, never a sequence.** A `bigserial` publishes insertion
  order, and FR-C5 forbids identifiers acting as a de facto link. CC-E adds that it must not
  be content-derived either, or an attacker who guesses the text can confirm the row exists.
- **No academic year column.** `course_id` already identifies code plus year (OPEN-32), so
  there is nothing that can drift out of agreement with it.

The quota is two columns and carries no timestamp, which is what
`anonymous-rate-limiting.md` requires.

**Cost of the role-per-schema part.** Per-module roles mean per-module connection strings, so
several pools rather than one, and one ORM client per schema. Against Postgres's default 100
connections on a 2 OCPU box that is comfortable, but it is real configuration rather than
free.

**One wrinkle, named now rather than discovered later.** FR-A5 lets a Member revoke active
sessions, which needs server-side session state, while CC-3 wanted a stateless backend.
`platform.sessions` is the compromise: a revocation check rather than a session store, so
statelessness survives in the sense that matters, which is that any instance can serve any
request.

## 13. Three problems the schema surfaced

Drawing it found two requirements that were wrong and one implementation trap. Recorded here
because the finding, not just the fix, is the useful part.

### 13.1 FR-B9 was too strong and would have been violated on day one

FR-B9 as written required a reference module to hold **"no personal data in any column"**.
But `ref.course_teachers.teacher_name` is personal data, and 5.1 established that lecturer
names are the sharpest data protection exposure in the project.

So the rule was violated by the first reference module we build.

**The intent was right and the wording was wrong.** Tier 2 must be safe to share with every
module, and it is safe because nothing in it identifies a **platform user**. Teacher names are
third-party data from a public source and threaten nobody's unlinkability. Corrected to say
no data about **Members**.

The lesson is worth keeping: an over-broad rule that is violated immediately is worse than a
narrower one, because it teaches everyone to ignore the rule rather than to obey it.

### 13.2 Tenancy would have stamped an author attribute onto anonymous rows

1.5 item 1 requires a tenant column so multi-institution stays possible. The obvious
implementation stamps `tenant_id` from the submitting Member.

On `reviews_anonymous` that writes an attribute of the author onto the anonymous record,
which FR-C16 forbids. With one institution the harm is small; with several it narrows the
candidate set directly.

**Fix: derive the anonymous row's tenant from the course, never from the author.** A review of
a UCLouvain course belongs to the UCLouvain tenant whoever wrote it, and it is already
reachable through `course_id`, so the column does not need to exist on that table.

The edge case makes it worth stating as a rule rather than leaving to judgement: for an
exchange student reviewing a host institution's course, author-derived and course-derived
tenancy genuinely differ. Course-derived is correct on the anonymous path.

### 13.3 A series of backups defeats FR-C3 as written

The important one.

FR-C3 promised that an administrator holding stored data, explicitly naming **"a dump, a
backup, or query access to the live tables"**, cannot link an anonymous contribution to a
Member.

Holding **one** backup that is true: there is no join column. Holding **two**, taken a day
apart, it is not. Diff them, and `member_quota.used` moved from 2 to 3 for member X while
`reviews_anonymous` gained a handful of rows dated that day. On the measured numbers in 4.4,
a few hundred active users producing a handful of reviews a day, that narrows authorship to
roughly one in five, and repeated across a term the picture sharpens.

**Why the existing scope limit does not cover it.** `anonymous-rate-limiting.md` section 4.1
documents this correlation as a **live adversary** problem, and OPEN-27 placed live
adversaries out of scope. Backups are not a live adversary. They are stored data, which
FR-C3 explicitly includes. So the exclusion we relied on does not reach this case, and NFR-O1
requires the backups to exist.

**It is bounded, not fatal.** The leak is no finer than `created_at` granularity, which is
already day-coarse and already disclosed, and no finer than the quota window.

**Resolution: tighten the claim, not the backup.** FR-C3 now states what it actually
delivers: no linkage from any single stored snapshot, and a bounded correlation across
snapshots taken within one quota window. FR-C12 then obliges the privacy statement to say so.

The design does not change. The promise does. Weakening the backup was considered and
rejected: an untested backup is not a backup, and this project has lost data twice
(`CLAUDE.md`, known pitfalls). What remains genuinely open is the backup **cadence and
retention** relative to the quota window, since those two numbers set the bound. Recorded as
**OPEN-41**.
