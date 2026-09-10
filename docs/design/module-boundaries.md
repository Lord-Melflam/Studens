# Design note: sharing between modules without coupling them

| | |
|---|---|
| Status | **Proposed**, needs François's call |
| Proposal | **Three tiers** (platform services, reference modules, feature modules) plus one access rule. **Reject** a global shared module. |
| Raised by | François, 2026-09-10: "some aspects might be shared between modules ... or make a global module that holds most of the globally shared data?" |
| Date | 2026-09-10 |
| Implements | `requirements.md` 1.5 items 3 and 4, FR-B |
| Constrained by | FR-C1, FR-C2, FR-C5, FR-C6 |
| Raises | OPEN-32, OPEN-33, OPEN-34 |

## 0. Proposal

Three tiers, with dependencies pointing one way only:

1. **Platform services.** Identity, session, authorization, quota, audit. Provided by the
   shell, consumed by modules through the platform contract.
2. **Reference modules.** Shared, read-mostly, and carrying **no personal data at all**.
   The course catalogue lives here. One owner writes, every module reads.
3. **Feature modules.** RYC, MPA. Each owns its own personal data. No feature module reads
   another's storage or calls another directly.

Plus one access rule, which is what keeps tier 2 from rotting:

> **Ask questions, do not fetch data.** Where a module needs something about a member that
> another part of the system knows, it asks a question with a narrow answer, rather than
> requesting the data and deciding for itself.

**Reject** a single global module holding most shared data. Reasons in section 3, Option B.

For v1 this means: build the course catalogue as a reference module, and **do not build
enrolment at all**. Only MPA needs it, and MPA is not in v1 (1.4).

## 1. The problem

Modules will need some of the same things. The example raised is the **PAE**, *programme
annuel de l'étudiant*: the list of courses in a student's annual programme, with their ECTS.
MPA needs it to plan. Another module could need it later. Encoding it separately in each
module means duplicated work and, worse, two versions that drift apart.

So some sharing is needed. The question is what shape it takes, because the obvious shape,
one shared place holding the shared things, is also how a codebase becomes impossible to
change.

## 2. The key insight

**The PAE is not one thing. It is two, and they have opposite properties.**

| | Course catalogue | Enrolment (the PAE proper) |
|---|---|---|
| Content | Courses exist: code, title, ECTS, teacher, semester, institution | *This* member takes *these* courses |
| About a person? | No | **Yes** |
| Change rate | Slow, roughly once a year | Per member, per year |
| Identical for everyone? | Yes | No, that is the point of it |
| Safe to share widely? | **Yes** | **No** |

Sharing the catalogue is safe, and it is most of the value. Two modules naming the same
course by the same code is what stops the re-encoding, and it is also the only thing that
makes any later cross-module work possible at all.

Sharing enrolment is a different matter, and this is the part worth being blunt about.

> **A PAE is an identifier.**

A set of roughly ten courses drawn from a catalogue of thousands, including elective
choices, is close to unique within a cohort. A table mapping members to their course lists
therefore turns the complement problem (`requirements.md` 3.3) from an **inference** into a
**query**.

Today, working out who could have written an anonymous review of a course requires knowing
the enrolment list from outside the platform. A shared PAE store hands that list to anyone
with query access, which is the FR-C3 adversary. It would be the most damaging thing we
could add to the anonymity guarantee, and it would arrive dressed as a convenience.

**Unverified:** the near-uniqueness claim is reasoning, not measurement. It is stated as the
reason for caution. If any design ever depends on it being *false*, it must be checked
against real cohort data first.

## 3. Options considered

### Option A: each module encodes what it needs

Do nothing. RYC has its own notion of a course, MPA has another.

Rejected. It is the problem as stated: duplicated data entry, and two representations that
diverge silently until someone notices the ECTS disagree. It also makes any cross-module
feature impossible, because there is no shared identifier to join on.

### Option B: one global module holding the shared data, rejected

The shape suggested in the question: a single module holding most of what is globally
shared, which other modules depend on.

Rejected on three independent grounds, and the third is the serious one.

1. **It becomes a god module.** "Most of the globally shared data" has no admission
   criterion, so nothing is ever refused, and the cheapest place to put anything new is
   always in there. This is the god class smell at module scale.
2. **It cannot be changed.** Every module depends on it, so its shape is frozen by its own
   popularity. That is the opposite of Evolvable, which is goal 1.
3. **If it holds PAEs, it is a linkage engine.** Section 2. Putting personal enrolment data
   in the one place every module can read is the exact inverse of FR-C6, which separates
   storage paths precisely so that no single query can bridge them.

Ground 3 is not fixable by being careful with it. A store that exists to be widely read
will be widely read.

### Option C: three tiers plus an access rule, recommended

As in section 0. The dependency graph:

```
   feature modules      RYC            MPA
                         |              |
                         v              v
   reference modules    course catalogue, programmes, calendar
                         |              |
                         v              v
   platform services    identity  quota  authorization  audit

   arrows point down only. no sideways arrows, ever.
```

What makes this different from Option B is not the number of boxes. It is that the shared
tier has an **admission criterion** and a **direction**:

- Tier 2 may hold **no personal data**. That single constraint is what makes it safe to
  share with everything, and it is mechanically checkable (section 6).
- Feature modules never point at each other, so any one of them can be removed, rewritten
  or extracted without touching the others. That is what `requirements.md` 1.5 item 3, "a
  real module interface", is for.

Personal data stays with whichever module owns it, and is reached only through the access
rule below.

### Option D: shared database tables read directly by several modules, rejected

Keep one database, let modules read each other's tables where convenient.

Rejected. This is the coupling François wanted to avoid, in its least visible form. Nothing
in the code declares the dependency, so it is discovered at migration time, when a column
rename breaks a module nobody was looking at. It also destroys the one property that makes
later extraction cheap. A module's storage is private to it; sharing happens through a
published contract, never through the schema.

### Option E: direct module-to-module calls, rejected

RYC asks MPA for the member's PAE when it needs one.

Rejected for two reasons. It creates sideways dependencies, which allow cycles and mean
neither module can ship without the other. And it puts personal data in RYC that RYC does
not need, so the module with the anonymity obligation ends up holding the exact data that
breaks it. Option C's rule avoids both.

## 4. The access rule, worked through

> **Ask questions, do not fetch data.**

RYC is the case that matters, because it is the module with the anonymity obligation.

**The convenient design.** RYC requests the member's PAE, then shows them their courses and
lets them review one. Simple, and it puts a near-unique identifier inside the module whose
whole job is to not know who wrote what.

**The right design.** RYC asks one question: *may this member review course C?* The answer
is a boolean. RYC never receives the list, never stores it, and cannot leak it.

This is not a new mechanism. It is FR-C1 restated: authentication establishes *eligibility
to contribute*, never authorship. And it is the same shape as the quota check, which asks a
narrow question about a member and writes nothing linkable. The seam already exists; this
reuses it rather than adding one.

Two consequences follow, and both are new findings.

### 4.1 An eligibility check must not be logged with the member and the course together

The check happens at submission time, when identity is present. That is fine, and it is the
same moment the quota counter is touched. But a log line reading

```
2026-09-10T14:22:01  eligibility_check  member=8412  course=LINFO2145  -> true
```

is the foreign key the schema was carefully built not to contain. It is worse than a
timestamp on the member record, because it names the target directly.

So the rule that governs the quota counter extends here: **no log, metric or trace may
record a member identifier and a target identifier in the same record.** Counting checks is
fine. Naming both ends is not.

This is worth stating explicitly because a log does not feel like storage, and it is
written by infrastructure rather than by the code anyone reviews for privacy.

### 4.2 Cross-module statistics are the dangerous category, not the safe one

Shared statistics sound harmless. They are the side door.

MPA knows a member's workload. RYC knows what was rated. A join on member id undoes the
whole design, and it is the kind of thing that gets built for a dashboard by someone who
never read this document.

The rule: **cross-module aggregation happens over reference keys, never over member keys**,
wherever the anonymous path is involved. Aggregating by course is fine. Aggregating by
member across modules is the linkage.

## 5. What this proposal does not solve

Stated honestly, in the manner of the rate-limiting note.

**It does not fix the complement problem.** Section 2 explains why a shared PAE store would
make it much worse, and this proposal avoids that. It does not improve the situation that
already exists in `requirements.md` 3.3, where attributed reviews narrow the candidate set
using public data only. That remains open (OPEN-31).

**It does not remove the need for the platform to know enrolment eventually.** The boolean
in section 4 has to be answered by something, and whatever answers it holds the enrolment.
This proposal confines that knowledge to one place with no read interface, rather than
eliminating it. The confinement is the whole benefit; there is no design in which nobody
knows.

**Tier 2 will be under pressure.** "No personal data" is a clean rule and it will be
inconvenient at some point, most likely for something that looks impersonal and is not, for
instance a per-course list of reviewer counts thin enough to identify people. The rule
holds; the mechanical check in section 6 is what makes it hold.

## 6. Verification

| Claim | Test |
|---|---|
| Dependencies point one way | ESLint `no-restricted-imports` forbids feature-to-feature imports. A test asserts the config is present and that a deliberate violation fails the build, so the guard cannot be silently removed. |
| Reference modules hold no personal data | A schema test enumerates every column of every reference table and fails if any could hold a member identifier. Same shape as the FR-C2 test already specified. |
| Modules do not read each other's storage | A schema test asserts each module's tables are reachable only by their owner, by naming convention plus an allowlist. |
| No log record names a member and a target together | A test on the logging and metrics writers rejects any record carrying both field kinds. Fails closed: an unknown field pairing is a failure, not a pass. |
| No cross-module aggregation by member | Reviewed by hand at first. Automatable once the read models exist, by asserting no query groups by member across two module schemas. |

## 7. What v1 builds

Only the catalogue, and deliberately less than the proposal describes.

- **Build:** a reference module holding courses, enough for RYC to name what is being
  reviewed.
- **Do not build:** enrolment, the eligibility question, or any cross-module sharing. MPA is
  the only thing that needs enrolment and MPA is not in v1 (1.4). RYC's eligibility rule is
  not decided yet, and may not need enrolment at all, depending on OPEN-3.
- **Record now, decide later:** the tiers and the direction of dependencies, because
  splitting catalogue from enrolment costs nothing today and is a migration of the most
  sensitive table in the system later. This is a 1.5-class decision, which is why it is
  written down before the code exists.

## 8. Open questions raised here

- **[OPEN-32]** Is a course reviewable as a **code**, or as a **code plus an academic
  year**? `LINFO2145` is stable, but the offering is not: teacher, ECTS and content change
  between years. A course with a new lecturer is arguably a different thing to review, and
  averaging across years silently mixes them. Blocks FR-D and the catalogue schema.
- **[OPEN-33]** Where does the catalogue come from, and who maintains it? Hand-encoding is a
  data-entry project with a recurring per-year cost. Importing from the institution is
  cheaper and creates a dependency on their format and their permission. Interacts with
  CON-1 and with OPEN-14, since the catalogue must be tenant-scoped from the start
  (1.5 item 1).
- **[OPEN-34]** When MPA arrives, who owns enrolment: a platform service, or MPA itself? A
  platform service is right if more than one module ever needs the eligibility question;
  MPA-owned is right if it stays MPA's alone. Not urgent, but the answer determines where
  the boolean in section 4 is implemented. Do not decide it before there is a second
  consumer.
