# Design note: rate limiting without linking

| | |
|---|---|
| Status | **Accepted** 2026-09-09 |
| Decision | **Option A**, fixed window. Live database adversary **out of scope**. |
| Decided by | François, 2026-09-09 |
| Date | 2026-09-09 |
| Resolves | `requirements.md` OPEN-6, OPEN-27 |
| Still open | OPEN-26 (quota and period), OPEN-35 (one person, many accounts) |
| Implements | FR-C4, constrained by FR-C2, FR-C3, FR-C5 |

## 0. Decision

Option A is adopted, with fixed windows. An adversary observing the database write stream in
real time is outside the threat model, so the residual correlation described in 4.1 is
knowingly accepted.

Three obligations follow and are not optional:

1. **No precise per submission timestamp on the member record.** Period start and count only.
2. **Fixed windows only.** A rolling window would require exactly the timestamps that 4.1
   warns about.
3. **The privacy statement must state this limit** (FR-C12). Accepting a scoped guarantee is
   fine; describing it as absolute is not.

Option B stays recorded as the upgrade path. Adopting it later adds a spent token table and
does not change the contribution schema.

## 1. The problem

FR-C4 requires that a Member cannot contribute without limit. FR-C2 forbids storing any
Member identifier on an anonymous contribution. These look contradictory: enforcing a
per-person limit seems to require knowing which person.

## 2. The key insight

They are not contradictory, because they are facts about different objects.

> **Counting is a fact about the member. Linking is a fact about the contribution.**

To enforce "at most N per period" the system needs to know *how many* a member has made. It
never needs to know *which ones*. So the counter lives on the member record, the
contribution stores nothing, and no shared key is ever written.

```
members                          anonymous_contributions
---------                        -----------------------
member_id                        contribution_id
quota_used        <-- counter    target_id
quota_period      <-- window     body
                                 created_at (coarse)
                                 status

            no column joins these two tables
```

The remaining risk is not the schema. It is **correlation**, and that is what section 4 is
about.

## 3. Options considered

### Option A: member-side quota counter (recommended)

Increment a counter on the member record; insert the contribution with no owner column.

- Simple, no cryptography, no new dependencies.
- Costs nothing at runtime and nothing in money (CON-1).
- Understandable by a new contributor in a minute, which matters for NFR-M1 and NFR-M2.
- Resists an attacker holding a database dump: nothing in the dump joins the two.
- **Does not** resist an attacker watching writes as they happen. See 4.1.

### Option B: blind signed tokens

The platform issues a Member blindly signed tokens proving eligibility. The Member spends
one per anonymous contribution. The server verifies the signature without learning which
token it issued to whom, and a spent-token table prevents reuse.

- Cryptographically unlinkable, even against a malicious operator watching live writes.
- This is the genuinely strong answer, and the correct one if the threat model includes the
  platform's own administrators acting in real time.
- Costs: a blind signature implementation, key management, key rotation, and a niche
  cryptographic dependency in the supply chain. Getting it subtly wrong yields a false
  guarantee, which is worse than an honest weaker one.
- Disproportionate for v1 with a team of two or three (CON-2). Reasonable later.

### Option C: deterministic pseudonym, rejected

Store `HMAC(server_key, member_id || target_id)` on the contribution, giving per target
uniqueness without an explicit member ID.

**Rejected.** The server holds the key, so the server can recompute the value for every
member and link every contribution. It fails FR-C3 outright. It *looks* private, which
makes it more dangerous than an obviously identified column, and it is a common mistake.

### Option D: IP or session limits, rejected as primary

Trivially bypassed by clearing a session, and storing IP addresses conflicts with the
privacy position. Acceptable only as a coarse abuse damper on top of Option A, never as the
mechanism that implements FR-C4.

### Option E: no limit, rely on moderation, rejected

Moves the entire cost of abuse onto a moderation rota the team may not be able to staff
(OPEN-7).

## 4. What Option A leaks, stated honestly

A guarantee is only worth what its weakest correlation allows. Three residual leaks.

### 4.1 Write timing

If the counter increment and the contribution insert happen together, anyone observing the
write stream (replication log, write ahead log, live database access, an audit trail) can
correlate them and defeat the scheme.

Mitigations, in increasing order of cost:

- **Never store a precise per submission timestamp on the member record.** A field like
  `last_submitted_at` reintroduces the join in plain sight. Store a period start and a
  count, nothing else.
- **Use fixed windows, not rolling windows.** This matters more than it looks. A rolling
  window ("5 per any 24 hours") requires storing the timestamp of each individual
  submission, which is precisely the correlatable data. A fixed window ("5 per calendar
  month") needs only a count and a period start. **The cheaper design is also the more
  private one.**
- **Coarsen `created_at` on the contribution.** Day level granularity, or hour buckets, is
  usually enough for the product and destroys most timing correlation.
- Optionally, delay publication by a random interval.

Option A does not defend against a live adversary with write stream access. That limit
should be written in the privacy policy rather than glossed over. Option B is the upgrade
path if that adversary is in scope.

### 4.2 The counter reveals participation volume

An administrator reading the members table learns that a Member made N contributions this
period. Combined with their visible attributed contributions, the number of anonymous ones
can be inferred.

This leaks *how many*, never *which*. That is a materially weaker disclosure and, in this
design, an acceptable one. It should still be stated rather than discovered.

### 4.3 Per target uniqueness is not achievable anonymously

**RESOLVED 2026-09-10: Option 1.** Per target uniqueness applies to the **attributed path
only** (`requirements.md` FR-C13, FR-D9). On the anonymous path the quota is the only limit,
and a determined Member can spend several of their allowance on one course. François,
2026-09-10, closing OPEN-25 and OPEN-31.

"One review per course per person" cannot be enforced anonymously without a per member, per
course marker, which is Option C and is rejected.

**Blind signatures do not rescue it either.** Option B could issue a one-time token per
member per course, spent at submission without revealing the spender. But the **issuance**
record is itself a member-and-course pair. A member issued a token for course C, and one
anonymous review of C, reproduces the same exposure one step earlier. Unlinkable issuance
would need considerably more machinery than Option B describes. Recorded so that this is not
proposed later as an easy fix.

**Two consequences of the resolution, and the second is counterintuitive.**

First, a Member can post an attributed review of a course **and** an anonymous one, and the
platform cannot detect it.

Second, that gap is load bearing. It is what stops an attacker excluding the attributed
reviewers from the candidate set for an anonymous review, so it keeps the complement problem
(`requirements.md` 3.3) probabilistic rather than certain. Which means the platform must not
publicly claim one review per person per course as a global rule: doing so would restore the
attacker's certainty. That is FR-C17, and it is the rare case where an **unenforceable rule is
safer left unstated than stated**.

## 5. Recommendation

**Option A for v1**, with fixed windows, no per submission timestamp on the member record,
and coarse timestamps on contributions. Document the 4.1 limit publicly. Keep Option B as a
recorded upgrade path: it can be adopted later without changing the contribution schema,
since it only adds a spent token table.

Rationale against the constraints: it is free (CON-1), buildable and reviewable by a small
team (CON-2), and honest about what it does not do, which is the standard this project has
set for itself elsewhere.

## 6. Verification

Per NFR-Q1, each claim needs a test that can fail.

| Claim | Test |
|---|---|
| FR-C2 holds structurally | A schema test enumerates the anonymous contribution table's columns and fails if any column could hold a member identifier. This catches a future contributor adding one. |
| Quota is enforced | Submitting past the quota is rejected. |
| No timestamp join exists | A schema test fails if the member record gains a precise submission timestamp field. |
| Timestamps are coarse | Stored `created_at` values are asserted to have no sub-day precision. |

The first and third tests are the valuable ones. They do not test behaviour; they test that
the *design* is still intact, and they fail on the pull request that would quietly break it.
That is Verification applied to a privacy property rather than to a feature.

## 7. Open questions raised here

- ~~**[OPEN-25]**~~ **RESOLVED 2026-09-10: yes, attributed path only.** Option 1. See 4.3,
  and `requirements.md` FR-C13 and FR-C17.
- **[OPEN-26]** What is the actual quota, and per what period?
- ~~**[OPEN-27]**~~ **RESOLVED 2026-09-09: no.** A live adversary with database write stream
  access is out of the threat model. Option A stands, and FR-C12 carries the obligation to
  say so publicly.
