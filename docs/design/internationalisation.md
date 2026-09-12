# Design note: three languages

| | |
|---|---|
| Status | **Proposed** 2026-09-12, implemented in the same pull request |
| Decision | French, Dutch and English. Locale in the URL path. Catalogs owned by the package that renders them. No dependency. |
| Implements | new FR-G |
| Constrained by | FR-B4, FR-B16, CON-1 |
| Still open | a native check of the Dutch before any Flemish institution is launched into |

## 0. Why now

The name was chosen because **Studens** reads natively in French, Dutch and
English (README, "The name"), and the product was French only. That is a claim
the product did not honour.

It is also structural rather than cosmetic. Belgian higher education is
legislated separately by the Flemish Community and the French Community, so a
platform meant for both cannot be monolingual, and every screen written in one
language is a screen to revisit later. The cost grows with every pull request,
which is why this came before the first-run sequence rather than after it.

## 1. The decisions

### 1.1 The locale lives in the path

`/fr/a-propos`, `/nl/a-propos`, `/en/a-propos`.

**Rejected: a cookie or a stored preference alone.** A cookie cannot be shared.
A Flemish student sending a link to a French speaking friend would send a page
in Dutch, or worse, a page in whichever language the recipient last used, so the
same URL would show different things to different people. It is also invisible
to a crawler, which matters for the one zone whose job is to be found.

**Cost accepted.** Every route carries a prefix and every internal link has to
build one. That is one function, `localePath`, and `linkProps` calls it, so no
component knows the prefix exists. A visitor arriving with no prefix is
redirected to what their browser asks for, with `replaceState` so that Back does
not bounce them out again.

**What would change it.** Nothing foreseeable. This is the ordinary answer and
the alternatives are worse for a public site.

### 1.2 No i18n library

**Rejected: i18next and its relatives.** Their real value is extraction tooling
and a plural engine. The platform already ships the plural engine as
`Intl.PluralRules`, which knows that French treats zero as singular and English
does not, and getting that wrong by hand is exactly the failure a library is
supposed to prevent. What remains is a dictionary lookup and a string
substitution, which is eighty lines.

The project has made the same call about react-router and about an OIDC client:
a dependency is a thing to understand, update and be exposed by, and it should
earn more than eighty lines.

**Cost accepted.** No extraction tooling, so a new string is added by hand in
three places, and the gate below is what stops one being forgotten.

**What would change it.** Plural categories beyond `one` and `other`, which
Polish, Russian and Arabic all need. Or translators who want `.po` files rather
than a repository.

### 1.3 Catalogs belong to the package that renders them

The shell owns the shell's strings; RYC owns RYC's, prefixed `ryc.`. They are
merged once, at start.

**Rejected: one `locales/` directory.** Easier for a translator, and it is a
file every module must edit, which is the coupling FR-B4 exists to prevent. It
would also put RYC's vocabulary inside the shell's tree, which FR-B16 forbids
and which the public zone work has already run into three times.

A module's public presentation is therefore built **from the translator** rather
than stored as text: `presentation: (t) => ModulePresentation`.

### 1.4 A missing key is loud

A key absent from Dutch falls back to French. That is right for the reader and
wrong for everyone else, because **nobody ever notices a page that quietly
reverts**. So:

- the development build warns on every fallback, naming the key and the locale;
- `missingKeys()` reports what is absent, and a test asserts it is empty;
- a test asserts no string is empty, since a blank renders as nothing at all
  while a missing key at least renders as a bug report;
- a test renders the landing page in all three languages and asserts the three
  differ, because if two matched, one was falling back and the switcher was
  decoration.

This is the same shape as the isolation script that could not confirm its own
role, and the test suite that skipped its most important cases in green.

### 1.5 What is NOT translated

**Anything that comes from an institution.** Course titles, descriptions and
assessment methods are published by the university in the university's language,
and a Dutch-speaking student at UCLouvain reads French course descriptions
because that is what UCLouvain publishes. Translating them would mean inventing
an official-looking text that nobody has approved, on a page whose whole claim
is that the official record is one link away.

The interface says so, on every page, rather than leaving a reader to conclude
the product is half-finished.

## 2. What is not done yet

- **The app zone and RYC's own screens are still French only.** The mechanism is
  in place and the strings are not. The public zone came first because it is
  where a stranger decides whether this is for them.
- **The Dutch has not been checked by a native speaker.** It was written by the
  same hand as the French. For English that is a small risk. For Dutch it is
  not: this product asks students to trust it with something they are nervous
  about saying, and clumsy Dutch reads as "not for you". **This must be closed
  before any Flemish institution is launched into**, and it is cheap to close:
  one careful reader.
- **No `hreflang` links and no per-language sitemap.** Both belong with
  deploying rather than here.
