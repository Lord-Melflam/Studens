# Design note: moderation

| | |
|---|---|
| Status | **Proposed** 2026-09-12. Three questions, one system, so one note. |
| Proposes | OPEN-7 (is 24 hours sustainable), OPEN-8 (how Moderators are appointed), OPEN-24 (auto-removal threshold) |
| Implements | FR-E1 to FR-E7, constrained by FR-C9, FR-C10, FR-C16, FR-B12 |
| Prompted by | François, 2026-09-12: prepare the moderation trio |

## 0. What changed while preparing this

I went looking for the sustainable service level and found a legal floor
underneath the question. It moves all three answers, so it comes first.

**The Digital Services Act applies to Studens.** Checked against the regulation
text on 2026-09-12 rather than recalled.

| Article | What it requires | Applies to us |
|---|---|---|
| 16, notice and action | An easily accessible, user-friendly mechanism for anyone to report content they consider illegal | **Yes.** Every hosting provider, regardless of size |
| 17, statement of reasons | On removing or restricting content, tell the affected user clearly what was decided, why, and what redress exists | **Yes**, and see 0.1 |
| 19 | Exempts micro and small enterprises from the internal complaints system, trusted flaggers and some transparency reporting | **Exempt.** This is the expensive half |
| 6, liability | A host is not liable for user content while it has no actual knowledge of illegality **and acts expeditiously once it has** | **Yes**, and it sets the real deadline |

Three consequences.

**There is no report button.** Article 16 is not optional and nothing in the
product implements it. That is a larger gap than any of the three questions
asked, and it is now the first thing moderation needs.

**"Expeditiously" is the standard, not twenty-four hours.** Article 6 conditions
the liability shield on acting once you *know*. It does not name a number, and
naming one ourselves creates an obligation the law did not impose. See OPEN-7.

**A report is actual knowledge.** From the moment a notice arrives, the shield
depends on acting. That makes the size of the queue a legal exposure and not
only an operational one, which is the argument against anything that grows it.

### 0.1 Article 17 collides with FR-C9, and the collision is structural

Article 17 says the affected recipient must be informed of the decision and the
reasons for it. **On the anonymous path we cannot inform anybody**, because we
cannot know who wrote it. That is not an implementation gap; it is FR-C9
working, and FR-C9 is settled.

**Proposed:** the statement of reasons is **published in the place the
contribution occupied**, rather than sent to a person. Anyone who wrote it sees
it by returning to the page, which is the only channel that exists, and every
reader sees that something was removed and why, rather than finding a silent
hole.

Two things this buys beyond compliance. A removal that leaves a visible,
reasoned gap is much harder to abuse quietly than one that erases without trace.
And it is the only redress an anonymous author can have: they can contest a
public reason, where they could never prove authorship to contest a private one.

**It should be checked by the same qualified person who confirms 5.1.** This is
a non-lawyer reading a regulation, and the argument that a published statement
of reasons satisfies a duty to inform the recipient is exactly the kind of
reasoning that needs someone qualified to agree with it.

## 1. OPEN-7: is a 24 hour target sustainable?

**No, and it should not be promised.**

It was never measured, there is no moderator, and a team of two cannot commit to
a daily response without someone being on call every day including August. A
target that is missed is worse than no target: it is a promise on the record
that the platform failed to keep, at exactly the moment someone is complaining
about content.

**Proposed instead:**

- **Publish no fixed delay.** Say what actually happens: reports are read and
  acted on as quickly as we can, and content that is plausibly illegal or
  identifies a third party is held first and examined after.
- **Measure it from the first day** and publish the real figure later, once it
  is a fact rather than an intention. FR-E1's audit log already carries the
  timestamps needed.
- **Keep the queue small enough to clear**, which is what section 3 is about.

**Cost accepted.** No service level is a worse answer for someone reporting a
defamatory review about them, and they are the person with the strongest claim
on a fast answer.

**What would change it.** A measured median over a full academic year, including
a session period. Then publish the measurement, not an aspiration.

## 2. OPEN-8: how is a Moderator appointed?

The question was already sharpened into a security one: an unanswered appointment
path is a privilege escalation path. It is now also a legal one, because a
moderator is the person through whom the platform acquires actual knowledge.

**Proposed: appointed by an Administrator, one at a time, recorded.**

- No self-service, no election, no automatic promotion by tenure or reputation.
  Each of those is a way to acquire the power without a human deciding to grant
  it, and reputation systems in particular are gameable by exactly the person
  you least want moderating.
- **Every appointment and removal is an `AuditLog` entry** naming the
  administrator who made it. FR-B12 permits naming an actor there because the
  actor is a moderator, never an author.
- **A Moderator cannot appoint a Moderator.** Only an Administrator can, so the
  set of people who can grow the set is small and named.
- **The powers are content powers only.** Hold, publish, remove, with a reason.
  Never: read authorship, never sanction a person on the anonymous path (FR-E7),
  never see anything the anonymity design forbids. A moderator who could unmask
  would be a second door into FR-C.

**Cost accepted.** It does not scale, and it makes the owner a bottleneck on
recruiting. That is the right shape at this size: the failure mode of the
alternative is far worse than the failure mode of being slow to add people.

**What would change it.** Enough volume that one person cannot appoint fast
enough, which is a good problem and a long way off.

**Open inside this proposal.** Whether a Moderator may be a student of the same
institution whose courses they moderate. Independence argues no; the pool argues
yes. Recommendation: yes, with the constraint that a moderator does not decide
on a contribution about a course they have reviewed themselves, enforced socially
at first because enforcing it mechanically on the anonymous path is impossible.

## 3. OPEN-24: what is removed automatically?

**Nothing is removed automatically. Ever.**

This is the sharpest of the three and the easiest to get wrong, because an
automatic threshold looks like the obvious way to keep the queue small.

**Why not.** A report threshold that removes content is a brigading tool.
Coordinating five accounts is trivial under open registration (FR-A6, and see
OPEN-35), and the content it would remove is precisely the content this platform
exists to protect: an argued negative review of a course that a group would
rather was not there. `requirements.md` already records that removing honest
negative reviews is the one thing a course review platform must not do.

**Proposed instead, two mechanisms that are not the same thing:**

| | Trigger | Effect | Who decides |
|---|---|---|---|
| **Hold** | A report arrives, or an automated check fires | Hidden from public view, queued | Nobody yet: it is a queue entry |
| **Remove** | A human read it | Replaced by a published statement of reasons | A Moderator, always |

- **Holding is automatic and reversible.** A single report holds nothing on its
  own; a report naming a third party, or alleging illegality, holds immediately,
  because the cost of holding a good review for a day is much lower than the
  cost of hosting a defamatory one knowingly.
- **Removal is always a human act**, and always leaves a reason in place of the
  content (0.1).
- **Automated checks may hold, never remove**, and must be dull: a third party's
  name, contact details, a URL. Not sentiment, not a score. A classifier that
  holds "too negative" reviews is a censorship machine wearing an algorithm.

**On reporting volume as a signal.** The count of reports is evidence about the
reporters as much as about the content, so it is shown to the moderator and never
acted on by itself. Many reports from accounts created the same week is a
brigading signature, and noticing that requires no link between a member and a
contribution: it is a fact about the reports.

**Cost accepted.** Every removal needs a person, so the queue is bounded by human
attention, which is the scarcest thing this project has. That is the point: it
forces the queue to stay small rather than letting automation hide that it is not.

**What would change it.** A category of content where holding is too slow and the
harm is immediate and unambiguous. Nothing in a course review platform is
obviously in that category, and if one appears it should be named specifically
rather than handled by a general threshold.

## 4. What this implies that was not asked

1. **Build the report mechanism first** (Article 16). It does not exist, it is
   legally required, and every other part of moderation assumes notices arrive.
2. **A removed contribution's slot keeps a statement of reasons** (Article 17
   and 0.1). That is a schema change: a removal reason on the row, and a render
   path for it.
3. **The `status` column already supports this** (`published`, held, removed)
   and nothing writes anything but `published` yet.
4. **`AuditLog` needs the appointment events**, which it does not have.
