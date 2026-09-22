# The Studens mark, and the files derived from it

`apps/web/src/Brand.tsx` is the source of truth. It draws the mark as inline
SVG so the running application ships no image and makes no request for one.
Everything in this directory is a **derivation** of that component, for the
places a React component cannot reach: an email, and an account on somebody
else's service.

## Why this directory exists at the top level

The root is meant to hold almost nothing (`docs/CONTRIBUTING.md`, "Where a file
goes"), so a new directory there needs a reason. This one holds a single kind
of thing, the mark and the files derived from it, and it is consumed from two
places that have nothing to do with each other: the worker, which embeds the
logo in outgoing mail, and a person setting a picture on an account somewhere
else. Under `docs/` it would be documentation, which it is not. Under
`apps/worker/` it would claim the avatar has something to do with mail, which
it does not.

## What is here

| File | What it is for |
|---|---|
| `avatar.svg`, `avatar.png` | 512x512. A profile picture for an account on a service that has no idea what Studens is: GitHub, the mailbox the relay sends from, anywhere a picture is asked for. The mark is inside the inscribed circle, so a service that crops to a circle loses nothing. |
| `mail-logo.svg` | 96x96, the small mark that goes at the end of every message. The bytes actually sent live in `apps/worker/src/logo.ts`, because the worker is compiled by `tsc`, which emits JavaScript and nothing else: an asset beside it would need a copy step that does not exist, and the failure mode of a missing copy step is a broken image in a suspension notice. |

Both carry their own dark background rather than being transparent with dark
ink. A transparent mark drawn in `#1B4A8F` disappears against the dark
background that a mail client in dark mode, or a service with a dark profile
page, puts behind it.

## Regenerating

```bash
rsvg-convert -w 512 -h 512 brand/avatar.svg    -o brand/avatar.png
rsvg-convert -w 96  -h 96  brand/mail-logo.svg -o /tmp/mail-logo.png
base64 -w0 /tmp/mail-logo.png     # paste into apps/worker/src/logo.ts
```

`rsvg-convert` is not a dependency of this project and is not in CI. That is
the accepted cost of keeping the raster files tracked rather than built: they
change perhaps once a year, and a build step for them would be machinery
nobody runs.

**The residual risk is named rather than hidden.** A test keeps the SVG
geometry here identical to `Brand.tsx`, so the mark cannot drift in one place
only. Nothing checks that `avatar.png` and `logo.ts` were re-rendered after an
SVG changed, because checking it would mean running the renderer in CI. If you
change the mark, run the three commands above in the same change.
