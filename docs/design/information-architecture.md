# Design note: the shape of the product

| | |
|---|---|
| Status | **Proposed** 2026-09-12, for review before any of it is built |
| Decision | Three zones in one deployable: a public site, sign-in and onboarding, then the app |
| Prompted by | François, 2026-09-12: "I see our app like a really structured thing", and the current shell being "too blunt" |
| Implements | FR-A1, FR-A6, and new FR-F |
| Constrained by | 1.7 (one deployable), 3.3 (the complement problem), FR-C16, FR-A10, FR-C19, OPEN-14 |

## 0. What was wrong

What exists is a working spine with no product around it. A visitor with no
account sees nothing at all; a member lands directly on a list of two buttons.
There is no public face, no sign-up path, and no moment where the product asks
who you are and what you want from it.

That is not a missing feature, it is a missing **structure**, and structure is
the thing that is expensive to retrofit. Hence this note before any screen.

## 1. Three zones, one deployable

```
PUBLIC                    AUTH                    APP
no account needed         transitional            signed in
indexable, shareable      never linked to         everything behind a session
```

**One deployable**, per 1.7. `apps/web` serves all three from one build.

**Rejected: a separate static marketing site.** It would render faster and
index better, which genuinely matters for a page whose job is to explain the
product to a stranger. It was rejected for now because it doubles what has to be
built, deployed and kept visually in step, and because the design tokens would
then live in two places, which is exactly the divergence the shared LaTeX
preamble was extracted to prevent.

**Cost accepted.** The public pages are served by a single-page application, so
first paint is slower than static HTML and a search engine sees an empty
document unless it runs scripts.

**What would change it.** Evidence that people are not finding Studens, at which
point pre-rendering just the public routes is a contained change: they share
nothing with app state, which is a property worth protecting deliberately rather
than discovering later.

## 2. The route map

```
PUBLIC
  /                     what Studens is, the problem from 1.1, how it works
  /modules              RYC today, what is coming, and what is deliberately absent
  /a-propos             an independent project, affiliated with nobody
  /confidentialite      FR-C12 in plain French: what anonymity does NOT protect
  header, right         Se connecter  ·  Créer un compte

AUTH
  /connexion            Microsoft, Google. Both buttons do the same thing:
                        FR-A6 means there is no separate "register" flow, an
                        unknown subject simply becomes a Member
  /api/auth/...         the OIDC endpoints, built

ONBOARDING              first sign-in only, resumable, one step per screen
  /bienvenue/1          welcome, and what we will and will not ask
  /bienvenue/2          username
  /bienvenue/3          language and theme
  /bienvenue/4          your studies          (optional, see 4)
  /bienvenue/5          your institution
  → /app

APP
  /app                  module home
  /app/ryc/...          the module owns everything below its own segment
  /app/moi              profile, preferences, sessions (FR-A5), my reviews (FR-D12)
```

**"Se connecter" and "Créer un compte" lead to the same screen.** FR-A6 settled
that registration is open and FR-A7 that there are no passwords, so there is
nothing to distinguish: a provider subject we have not seen becomes a Member.
Two labels exist because a visitor looking to join and a visitor coming back
look for different words, not because there are two paths.

## 3. Onboarding, and why it is a sequence

One question per screen with a Next button, in the register of setting up a new
machine for the first time. The alternative, one long form, asks a person to
absorb every question before answering any, and the first thing this product
asks anyone is a question about anonymity.

Four rules:

1. **Resumable.** Progress is stored per step, so closing the tab at step 3 does
   not start again at step 1. This also makes every step individually testable.
2. **Only step 2 is required.** A username is needed because something has to
   appear on an attributed review (OPEN-36). Everything else can be skipped and
   set later from `/app/moi`. A first run that cannot be escaped is a first run
   people lie to.
3. **Nothing is asked that the product cannot use.** See 4, where this is
   partly overruled and the overrule is recorded.
4. **It ends on the institution**, which is the step that makes the product feel
   like it belongs to the person's own school, and the natural last beat before
   the app opens.

## 4. What is collected, and what it costs

**Decided by François, 2026-09-12**, over my recommendation. The recommendation
and the reason are kept because a decision without its cost recorded is a
decision that gets re-made.

| Step | Field | Consumer today | Kept |
|---|---|---|---|
| 2 | username | attributed reviews (OPEN-36) | required |
| 3 | display language, theme | the interface | optional |
| 4 | programme, year of study | **none.** MPA will need them | optional |
| 4 | interests | **none** | optional |
| 5 | institution | theme, and scoping what a member sees | optional |
| 5 | notification preferences | **none.** Nothing sends notifications | optional |

**What I argued.** Every attribute attached to a member is an attribute that can
narrow the candidate set for an anonymous contribution. Section 3.3 is built on
exactly that arithmetic, and programme plus year of study is close to
identifying inside a thirty-student cohort. Under GDPR minimisation, a field
with no consumer is data we are accountable for holding and cannot justify by
pointing at a use.

**What was decided.** Collect them anyway, so that the profile is complete from
the first run rather than asked for again later, and so MPA arrives to data that
already exists.

**The mitigations, which are not optional and which make the decision safe:**

- **None of these fields renders on any review, attributed or anonymous.**
  FR-C16 already forbids author attributes on the anonymous path. This goes
  further and forbids them on the attributed path too, because a public
  "3rd year, SINF" beside a named review sharpens the complement attack against
  every *anonymous* review of the same course. The named reviewer consented for
  themselves; they cannot consent on behalf of the silent ones.
- **Every one of them is optional and skippable**, and `/app/moi` can empty them.
- **They are not shown to other members at all** in v1, because nothing needs to.

## 5. Institutions

**Data, not code.** A table seeded from a list, so adding one is a row.

**Name and colour, never the mark.** Confirmed 2026-09-12, consistent with
`frontend-design.tex` 2.3: the marks are trademarked whatever their copyright
status, and EPL's CC BY-SA fights our MIT licence. A grid of university logos on
a sign-up page is the sharpest possible implied endorsement, and the footer
disclaimer is weaker there than anywhere else on the site. Each institution is a
card with its name, its city and its colours, which also feeds the
per-institution theme that was already planned.

**Self-declared, and never displayed as more.** FR-A10 holds: the email domain
is evidence of holding an address at a domain, and a picked institution is
weaker still. Nothing in the interface may present either as proof of enrolment.
Where the pick disagrees with the domain, the pick wins and nothing is said:
exchange students, alumni and people with a personal Google account are all
ordinary, and FR-A6 chose open registration knowing this.

**Tenancy is untouched.** FR-C19 derives an anonymous contribution's tenant from
the target, never from the author, and that does not change because a member now
names their own institution. The field is a preference, not a tenant.

**The list.** Verified 2026-09-12 against the Wikipedia list of universities in
Belgium. Eleven universities: five in the Flemish Community (KU Leuven, UGent,
UAntwerpen, VUB, UHasselt), six in the French Community (UCLouvain, ULiège, ULB,
UMons, UNamur, and Saint-Louis Brussels, which merged into UCLouvain in 2023 and
is therefore listed as part of it rather than separately), plus the Autonome
Hochschule Ostbelgien in the German-speaking Community. Hautes écoles and
hogescholen are numerous and are not reliably enumerable from a general source,
so they come as a later seed from the official registries.

**All are shown; only UCLouvain is selectable.** Decided by François. Only
UCLouvain's catalogue is ingested, so choosing another today would land a member
in an empty product. The rest are visible and marked as not yet available, which
shows where this is going without lying about where it is. The copy has to carry
that, because a grid of disabled cards reads as broken unless it says why.

## 6. The app home

The current screen is a list of two buttons and was called blunt, correctly. It
should say what a member can do now, what is new since they last looked, and
what is coming, with the modules as the substance rather than as a menu.

Deliberately not specified further here. It is a visual problem, it is the
cheapest thing in this note to change later, and it should be drawn in
`frontend-design.tex` before it is built.

## 7. How a developer tests it

An onboarding you complete once is an onboarding nobody can re-test, and this
one is five screens deep behind a sign-in.

- `/app/moi` carries **Recommencer l'introduction**, which clears the stored
  progress. Available to everyone, not only in development: a member who wants
  to redo their setup is an ordinary case.
- The development sign-in creates a member **with no onboarding progress**, so
  the wizard is what you land on, every time, until you finish it.
- Each step is its own route, so any step can be opened directly.
- Onboarding state is one column, so resetting it in `psql` is one statement.

## 8. What this changes in the existing specification

- **FR-A1 grows.** Authenticating is no longer the whole of becoming a member;
  there is a first run afterwards. The new requirements are FR-F.
- **A public zone exists**, which nothing in FR-B contemplated: the shell was
  the whole frontend. FR-B16 to FR-B18 still hold inside `/app`.
- **FR-C16 is extended** by 4 above, from the anonymous path to both paths, for
  the profile fields specifically.
- **OPEN-14 is unaffected.** v1 still serves UCLouvain. The picker shows the
  others as unavailable rather than implying multi-institution works.
