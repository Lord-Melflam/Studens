# Design note: getting the course catalogue

| | |
|---|---|
| Status | **Accepted** 2026-09-10 for the method. Not built. |
| Decision | **Scrape uclouvain.be**, with the whole structure discovered at runtime and nothing hardcoded. |
| Decided by | François, 2026-09-10 |
| Resolves | `requirements.md` OPEN-33 |
| Implements | FR-B9 (the catalogue is a reference module), supports FR-D1 to FR-D4 |
| Raises | OPEN-38 |

## 0. Decision

There is no UCLouvain API, so the catalogue is built by scraping the public course pages.

The structure is **discovered, not configured**. One root URL yields the faculties, each
faculty yields its programmes, each programme yields its courses. No list of faculties,
programmes or course codes is written into the source. François's requirement, 2026-09-10:
"Things need to be automated as much as possible to avoid hardcoding stuffs. For evolution
purpose, it's a must."

That requirement is the whole design. Everything below serves it.

## 1. Why scraping

Checked on 2026-09-10:

- **No API.** UCLouvain publishes no course or programme endpoint, and no developer portal.
- **Their "Open Data" service is research data**, not the course catalogue. Different thing.
- **The pages are static server-rendered HTML.** No JavaScript application to drive, so a
  plain HTTP fetch and an HTML parse is enough.
- **The pages carry every field the module needs**, verified against
  `uclouvain.be/cours-2025-linfo2145`: ECTS (`5.00 crédits`), code, title, teacher, language
  of instruction, quarter, formal and recommended prerequisites, `Thèmes abordés`, `Contenu`.

PDF versions of programmes also exist (`prog-2025-dati2m.pdf`). Not used: HTML is easier to
parse and carries the same content.

## 2. The chain

Verified end to end on 2026-09-10.

```
  /fr/catalogue-formations/formations-par-faculte-<year>
        |
        |  20 faculty links
        v
  /fr/catalogue-formations/faculte-<year>-<faculty>
        |
        |  programme links
        v
  /prog-<year>-<programme>            (also -programme, -programme_annual_blocks)
        |
        |  course links
        v
  /cours-<year>-<code>                ECTS, title, teachers, language, quarter, prerequisites
```

Base is `https://uclouvain.be`. An `/en-` prefix appears on English variants of course URLs
and is stripped to normalise.

**The 20 faculties, as discovered rather than as a configuration list:** agro, drt, drtb,
educ, epl, espb, espo, fasb, fial, fsm, fsp, ieeb, loci, lsm, mede, phlb, psp, sc, teco,
timb.

Recorded here as an observation, not as input to the code. If UCLouvain adds, merges or
renames a faculty, the crawl finds it. If this list were in the source, it would be wrong
within a year, which is the failure the no-hardcoding rule exists to prevent.

**Note on the Saint-Louis faculties.** Five of the twenty (drtb, espb, ieeb, phlb, timb) are
the former Université Saint-Louis Bruxelles. Different campus, different city, arguably a
different student population. Worth knowing before treating "UCLouvain" as one homogeneous
thing, and it interacts with tenancy (1.5 item 1) sooner than the multi-institution vision
does.

## 3. The year in the URL

**[VERIFIED]** François, 2026-09-10.

The URL carries **one** year, and it is the **first** year of the academic year: academic
year *x to y* appears as `x`. So 2025-2026 is `cours-2025-...`. The academic year starts in
mid-September, which means the calendar year and the academic year disagree for roughly three
and a half months every year.

Two rules follow:

1. **Derive the default from the date, not the calendar year.** Before mid-September, the
   current academic year is `x-1`. Using `now().year` naively produces a URL that does not
   exist for a third of the year, and the failure would look like "UCLouvain changed their
   site" rather than "our date arithmetic is wrong".
2. **Probe, do not assume.** Try `x-1`, `x` and `x+1` and use what answers. This also picks
   up next year's catalogue as soon as UCLouvain publishes it, with no code change.

The probe is a **discovery step that runs once and caches its answer**, not a cost paid on
every request or every course.

**This is also where OPEN-32 came from.** UCLouvain itself identifies a course as code plus
year. That was a derivation on 2026-09-10; the URL structure makes it an observation.

## 4. Is this allowed

**robots.txt: yes.** Fetched 2026-09-10. A standard Drupal file. It disallows `/admin/`,
`/search/`, `/user/register`, `/user/password`, `/user/login`, `/user/logout`,
`/comment/reply/`, `/node/add/`, `/filter/tips`, `/core/`, `/profiles/`, `/media/oembed` and
various README files. **Neither `/cours-` nor `/prog-` nor `/fr/catalogue-formations/` is
disallowed.**

Note `/search/` **is** disallowed, so the catalogue search interface must not be used as an
entry point. The chain in section 2 avoids it, which is one more reason to prefer it.

There is **no `Crawl-delay`** and no `Sitemap` directive, so politeness is entirely on us.

**Unverified:** the site's terms of use have not been read. robots.txt is a technical signal,
not a licence. Worth reading before the first full crawl, and worth noting that we are
reading published academic information rather than extracting personal data, which is a
better position to be in than the reverse.

### Politeness rules, self-imposed

Because nothing forces them, and because a student project hammering the university's own
website is the fastest way to get blocked and to deserve it:

- One request at a time, with a delay between requests. No parallel fan-out.
- A `User-Agent` naming the project and a contact address, so an administrator who notices
  the traffic can ask us to stop instead of guessing.
- Full crawls run **rarely**: once per academic year is the natural cadence, since that is
  how often the catalogue changes, plus a manual trigger.
- Conditional requests and caching wherever the server supports them.

## 5. Prior art, and why none of it is used

`github.com/tdaron/epl-opinions`, found via a Discord message from a peer on 2026-04-27,
which described it as a dead personal project whose parsing logic should still work. Read
2026-09-10.

It is the same product idea at the same faculty: "Website to share students opinions about
EPL courses". Created 2025-08-20, last pushed 2025-08-22, then abandoned. That is worth
recording as **evidence the problem in 1.1 is real and felt by other people**, independently
of anything technical.

**Its code cannot be used.** The repository has **no licence** (`license: null` on the GitHub
API), which means all rights are reserved by default. Publishing a link, in Discord or
anywhere else, is publication and not permission; GitHub's terms grant viewing and forking
within GitHub, not use or redistribution outside it. Since Studens is public and MIT,
incorporating unlicensed code would make our own licence statement false and would promise
downstream users rights we do not hold. Attribution does not cure that: a credit is a
courtesy, a licence is permission.

**Facts are not copyrightable**, so what section 2 and section 3 record, meaning which URLs
hold the data and which labels to look for, is legitimately learned from it and from direct
inspection of the site.

**Two things it does that this design deliberately does not.** Both are the reason the code
would be a poor starting point even with a licence.

It hardcodes its targets, six programmes in a literal list, which is exactly the
hardcoding the no-hardcoding rule forbids and would need editing every year and for every
new faculty. And its extraction swallows every error:

```python
def parse_info(self, soup, name):
    try:
        div = soup.find("div", string=lambda t: name in t)
        return div.find_next_sibling("div").text.strip()
    except:
        return None
```

A bare `except` returning `None`. Any layout change yields silent nulls rather than a
failure, so the catalogue would quietly fill with missing data and nobody would know. It also
extracts description, content and teachers but **not ECTS**, which is the field the deferred
workload index needs.

If his code ever becomes worth using, the fix is one message asking him to add a licence
file. Until then, ours is written from scratch, and a credit for the pointer is the honest
form of thanks.

## 6. How this one is built differently

Three properties, each answering a failure above.

**Fail loudly, never silently.** A field that cannot be parsed is an error that fails the
ingestion run for that course, not a `None` written to the database. A catalogue with wrong
data is worse than a catalogue that refused to update, because the first is invisible.

**Validate at the field level.** ECTS must parse as a number, a course code must match the
expected shape, a year must be plausible. Type-correct nonsense is the characteristic output
of a scraper against a changed page.

**Ingest into a snapshot, promote atomically.** A run writes a complete new snapshot and only
replaces the live catalogue if the whole run succeeded and passed validation. A partial or
broken crawl therefore cannot take the site down or empty a course page. This matters
disproportionately because the catalogue is a reference module (FR-B9) that every feature
module reads.

Concretely, the verification obligations:

| Claim | Test |
|---|---|
| Nothing is hardcoded | A test asserts no faculty code, programme code or course code appears as a literal in the ingestion source |
| The chain still works | An integration test runs the full chain against a small fixed subset and fails if any step yields zero results |
| Parse failures are loud | A test feeds deliberately malformed HTML and asserts the run fails rather than storing nulls |
| ECTS is present and numeric | A validation test over an ingested snapshot fails if any course has a missing or non-numeric ECTS |
| Year arithmetic is right | Unit tests at the September boundary, specifically a date before and after the mid-September rollover |
| A broken run cannot corrupt the live catalogue | A test aborts a run mid-way and asserts the live snapshot is unchanged |

## 7. Scrape everything, launch narrow

**[VERIFIED]** François, 2026-09-10, on the scope of the crawl. The launch scoping is a
recommendation, marked **[DERIVED]**, awaiting confirmation.

The crawl covers **all 20 faculties**, because with a discovered chain that costs nothing
extra in code and hardcoding EPL would breach the rule in section 0. UCLouvain has more than
35,000 students across those faculties.

But the **module** launches scoped to EPL. The reason is not technical: thousands of courses
with zero reviews each makes every page look abandoned, and it makes the small-cohort problem
in OPEN-19 worse everywhere at once instead of in one place we can watch. A complete
catalogue with a scoped module gives the honest version of both, and widening is a
configuration change rather than a migration.

## 8. Open questions raised here

- **[OPEN-38]** How are courses reconciled **across years** when the code or title changes?
  A renamed course, a merged course, or a code change breaks the year-over-year link that
  FR-D4 and the deferred trendline depend on. This is fuzzy matching rather than parsing, and
  it is the one place in this document where a model would genuinely earn its place. Not
  needed until there are two years of data.
