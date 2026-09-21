<!--
Keep this short. The point is not ceremony, it is that a reviewer can tell what
you decided and why without reading the whole diff twice.
-->

## What this changes, and why

<!-- One paragraph. The problem first, then what you did about it. -->

## Requirements it serves

<!--
Name the IDs, for instance FR-C9, FR-D28, NFR-S3. A change that serves no
requirement is fine, say so; a change that CONTRADICTS one is not, and the
place to argue that is docs/requirements.md, in this PR.
-->

## The justification

<!--
Hard rule 8. Four things, one line each is enough:

  Alternatives rejected, and why
  Cost accepted by choosing this
  What would change the answer
  (If any of the three is missing, this is a guess rather than a decision,
   and it should be marked [OPEN] instead.)
-->

## Anything that can grow (NFR-O4)

- [ ] Every list, page, table, query, file and queue this change adds or
      touches has a bound, a page or a step, **or** its size is fixed by
      construction and I can say why in one line.

<!--
This is not about speed. The failures were legibility first: 976 programmes as
a 143,112 pixel page, "25 of 25" because 25 was the window, 349 courses in one
programme, a register that only grows. Every one looked fine at the size it
was written for. The cheap answer is almost always right: draw a screenful,
offer the rest.
-->

## Gates

- [ ] `npm run gates` passes locally
- [ ] `npm run gates:db` passes locally, or this change cannot touch the database
- [ ] If this adds or changes a gate: I broke the thing it checks on purpose and
      watched it fail. Paste the failure message.

<!--
That last one is not a formality. Two gates in this repository were found to be
worthless because nobody had done it: an isolation script where every check ran
as the table owner, and a lint config that never matched .tsx at all. See
LESSONS.md section 1.
-->

## Before merging

- [ ] No credentials, keys, personal data or local paths in the diff. The
      repository is public, so anything committed is permanently cloneable.
- [ ] No AI attribution anywhere: no `Co-Authored-By` for a tool, no
      "Generated with" line.
- [ ] No em dashes and no double dashes in prose.
- [ ] Docs updated in this PR if behaviour changed: `docs/requirements.md`,
      `docs/TIMELINE.md`, and `docs/LESSONS.md` if something went wrong on the
      way and the rule is worth more than the memory of it.
