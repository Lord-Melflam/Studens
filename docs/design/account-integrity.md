# Design note: accounts are not people

| | |
|---|---|
| Status | **Proposed** 2026-09-12 |
| Proposes | OPEN-35 |
| Implements | constrained by FR-A6, FR-C2, FR-C4, FR-C12, FR-C13, FR-C17, FR-D9 |
| Prompted by | François, 2026-09-12 |

## 0. The question

Registration is open (FR-A6) because no student roster is obtainable. So one
person can hold several accounts, and both integrity mechanisms bound accounts
rather than people:

- the contribution quota (FR-C4), five per seven days per **account**;
- one review per course per year (FR-D9), per **account**, and only on the
  attributed path anyway (FR-C13).

Someone with three Microsoft accounts has three times the quota. Is that
accepted as a speed bump, or is a cost imposed on creating an account?

## 1. What is already settled and cannot be traded

Three existing decisions remove most of the obvious answers before we start.

**FR-A6: registration is open.** Requiring an institutional email domain would
answer this question completely and is excluded. It would also exclude alumni
whose account is closed, exchange students, and anyone at an institution we have
not onboarded, which is most of the intended population over time.

**FR-C2: no member identifier on an anonymous contribution.** Anything that
detects "these three contributions came from one person" by linking them to a
member is the forbidden link, whatever it is called. That kills device
fingerprinting, IP correlation stored per contribution, and any per-contribution
token derived from the account.

**FR-C17: the uniqueness rule must not be claimed publicly.** Whatever is
decided here must not be described as making Studens resistant to multiple
accounts, because saying so is itself an attack aid.

## 2. The options

**A. Accept it, and say so.** No friction at registration. The quota is a speed
bump against volume, not an integrity guarantee, and FR-C12 requires saying that
in the privacy statement.

**B. Impose a cost at account creation.** A CAPTCHA, an email confirmation loop,
a waiting period, or proof of work. Raises the price of the tenth account without
identifying anybody.

**C. Tier by provenance.** Contributions from an unrecognised email domain are
held for moderation rather than published directly. Uses FR-A9's domain signal,
which we already have, without claiming it proves enrolment (FR-A10).

**D. Watch the target, not the author.** Detect anomalies that are facts about a
*course*: twenty reviews of one course in an hour, a burst of accounts created
the same day all contributing to the same target. Hold the burst, ask a human.

## 3. Recommendation: A plus D, and not B or C

**A, because the honest framing is already the design's framing.** The whole of
FR-C is built on refusing to claim guarantees it cannot deliver, and this is the
same move: the quota slows volume, it does not establish identity, and the
privacy statement says so plainly.

**D, because it is the only control that survives FR-C2.** This is the useful
insight in the whole question. A burst of contributions to one course is a
property of *the course*, not of any member, so measuring it needs no link
between a person and what they wrote. A count per target per hour is not the
forbidden pair. It catches the attack that actually matters, which is not "one
student wrote two reviews" but "someone is trying to move one course's average",
and it catches it whether the accounts are linked or not, which is better than
identity-based detection would be.

**Not B.** A CAPTCHA is bypassed for a few cents by anyone doing this at scale,
and email confirmation is a loop around a mailbox the provider already verified,
so it costs the honest user a step and the determined attacker nothing. Proof of
work costs a phone battery and is defeated by a laptop. Each adds a barrier at
the exact moment we are asking a stranger to trust us, for an attacker cost near
zero.

**Not C.** It is the most tempting and the most damaging. Holding contributions
from personal addresses systematically disadvantages precisely the people the
anonymity design exists for: someone using a personal account *because* they do
not want their institutional identity near what they are about to say. It also
edges toward the thing FR-A10 forbids, treating a domain as proof of enrolment,
and it would make the moderation queue permanently large, which section 3 of the
moderation note argues against on legal grounds.

## 4. What this costs, stated plainly

**A determined person can inflate a course's average.** Five accounts is twenty
minutes of work and twenty-five contributions a week. Nothing here prevents it;
D makes a *burst* visible and does nothing about a patient attacker spreading
contributions over months.

That is a real limitation of an open platform and it should be written in the
privacy statement next to the quota, not left for someone to discover. The
mitigation that actually matters is not technical: it is that the aggregate
always carries its denominator (FR-D10), so a course with six reviews reads as a
course with six reviews, and a reader can weigh it accordingly.

## 5. What would change the answer

- **Evidence of real manipulation.** None exists, because there are no users.
  Building defences against an attack nobody has attempted is how products
  acquire friction that never pays for itself.
- **An obtainable roster.** If an institution ever offers verified enrolment,
  option C becomes something quite different: not a proxy for identity, but
  identity itself, and FR-A6 would be worth revisiting deliberately rather than
  by the back door.

## 6. What to build, if this is accepted

1. **Nothing at registration.** That is the recommendation's whole point.
2. **A per-target rate signal** in the worker: contributions per course per hour,
   flagged past a threshold for a human. Needs no schema change on the
   contribution and stores nothing about a member.
3. **A sentence in the privacy statement** (FR-C12) saying the limit counts
   accounts, not people, and what that means. The public page already says the
   platform counts contributions and never which ones; this is the other half.
