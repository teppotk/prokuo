# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The prokuolimo.fi website for Pro Kuolimo ry, a Finnish volunteer association
protecting Lake Kuolimo. Hand-written static HTML/CSS/JS. **No build step, no
framework, no server code, no external network requests at runtime** — fonts,
images and data all ship with the site. Content is in Finnish; keep it that way,
including code comments and commit messages.

## Commands

```bash
python3 -m http.server 8000                 # dev server (required — see below)
python3 tools/check-links.py                # internal links, anchors, images
python3 tools/check-links.py --ulkoiset     # also HEAD-checks external PDF links
./tools/build-images.sh                     # regenerate assets/img from media-source (ImageMagick)
python3 tools/extract-nakosyvyys.py X.pdf > data/nakosyvyys.json
```

There is no test suite. `check-links.py` is the regression check — run it after
touching any page, JSON file, or the `NAV` array; it exits non-zero on failure.

**The site must be served over HTTP.** Opening a page via `file://` breaks it
completely: ES modules and `fetch()` both fail, which means no header, no
footer, and no data-driven content.

## Architecture

**Eight pages at the repo root** (`index`, `kuolimo`, `toiminta`, `nakosyvyys`,
`aineistot`, `uutiset`, `yhdistys`, `liity`). Prose and factual content live
directly in the HTML so they work without JS and are indexable.

**Shared chrome comes from custom elements**, not from duplicated markup:
`<site-header>` and `<site-footer>` are defined in `assets/js/site.js` and
render into the light DOM (not shadow DOM) so `site.css` applies. The `NAV`
array in that file is the single source of truth for navigation — adding a page
means creating the HTML file *and* adding a `NAV` entry, nothing else. Each page
also carries a `<noscript>` nav as a fallback.

**List-shaped content is JSON + one render module per page.** The pattern is
consistent and worth following for anything new:

- `data/*.json` holds the content so the association can edit it without touching code.
- The page contains a hook element (`data-news`, `data-docs`, `data-links`,
  `data-nakosyvyys`) wrapping a `[data-status]` loading message and a `<noscript>` note.
- A module in `assets/js/` finds the hook, calls `loadJSON()` from `site.js`, and
  replaces the hook's `innerHTML`. `loadJSON` writes a Finnish error message into
  `[data-status]` on failure, so pages degrade instead of going blank.
- All interpolated JSON values go through `esc()` from `site.js`.

`site.js` also exports `fiDate()` (ISO → `7.5.2026`) and `fiNum()` (decimal
comma). Finnish number formatting is not optional: decimal comma everywhere,
measured values wrapped in `<span class="num">` so they get the monospace
treatment.

**Contact details are intentionally duplicated** in the `YHTEYS` object in
`site.js` (footer) and in `yhdistys.html` (full board list). Update both.

## The näkösyvyys register

`nakosyvyys.html` plus `assets/js/nakosyvyys.js` is the site's signature
element and its most fragile part. The dataset is *derived*, not authored:
`tools/extract-nakosyvyys.py` pairs point labels with values by geometry from
the association's PDF report, using a deliberately strict positional rule and
skipping anything ambiguous (it reports skips on stderr). A copy of the source
report is in `lahteet/`.

Consequences to respect:

- The PDF is the authoritative source. Never hand-edit `data/nakosyvyys.json`
  to "fix" a value; fix the extractor or the `ALIAS` table and re-run it.
- Missing cells are real (some points are not measured on some rounds, and the
  March round is measured from the ice with far fewer points). Render them as
  gaps, never as zeros.
- Round summary bars encode two things on purpose: segment proportions show the
  class distribution, and total bar width shows sample size relative to the
  largest round. Do not normalise the widths to 100 %.

## Design system

Tokens live in `:root` in `assets/css/site.css`; dark mode is a *separate set of
chosen values* under `prefers-color-scheme: dark`, not an inversion.

- Type roles: Fraunces (voice, headings), Archivo (information, body and UI),
  IBM Plex Mono (measurement — numbers, dates, identifiers, captions).
  Self-hosted in `assets/fonts/` as latin + latin-ext subsets.
- `--b1` … `--b6` are a single-hue sequential water ramp for näkösyvyys classes,
  darker = clearer water. Each has a paired `--bN-fg` text colour chosen so the
  number on top clears 4.5:1 in both schemes. **Changing a background step
  without rechecking its `-fg` pair breaks contrast.**
- `--nieria` is the Arctic char's spawning colour and is reserved for membership
  CTAs and focus rings. Don't spend it on decoration.
- Photo credits belong in `<figcaption>`; the char photo is credited to
  Esa Hirvonen / Luonnonvarakeskus and that credit must stay visible.
- Components rendered on `.band--deep` (dark water sections) need explicit light
  overrides — several already exist in the CSS. Check any new component there.

## Text scaling (the audience is elderly — do not regress this)

Body text is 19px and the smallest size used anywhere is 14px (`--fs-micro`).
The site must stay usable when the reader raises their browser's font size.
Rules that exist for that reason:

- **Never set `text-size-adjust`.** `100%` suppresses Android Chrome's "text
  size" accessibility setting. iOS does not need it because every page has a
  `width=device-width` viewport.
- **Never write `font-size: clamp(min, Xvw, max)`.** A pure `vw` preferred
  value ignores the user's font setting. Always include a rem term:
  `clamp(2.05rem, 1.45rem + 2.4vw, 3.05rem)`.
- **Grid/flex minima must be able to shrink**: `minmax(min(15rem, 100%), 1fr)`,
  `minmax(0, 12rem)`, and `min-width: 0` on flex items. A plain `minmax(15rem, …)`
  demands 360px once the root font is 24px and pushes the page sideways.
- `body` sets `overflow-wrap: anywhere` (not `break-word`) because only
  `anywhere` shrinks min-content width, which is what stops long Finnish
  compounds from widening a track. Short identifiers, button labels and measured
  numbers opt back out via the `overflow-wrap: normal` group in the CSS — keep
  that list short, and never put a raw email address or URL inside a `.btn`.
- Avoid `white-space: nowrap` on anything that can grow with the font size.
- The register table's description is a `<p id="record-selite">` above the
  scroll container, associated via `aria-describedby`. A wide `<caption>`
  inside the scroll container widened the page.

Verified with Chrome's own default-font-size setting (the only faithful test —
it scales media-query `rem` too) at 16, 20 and 24px across widths 380–1380 on
all eight pages: no horizontal overflow. Known limitation: at 32px (200%)
combined with a 380px viewport, the register page scrolls ~70px sideways;
nothing is clipped or lost.

## Content rules

Factual claims carry a source link: lake figures cite Järviwiki/SYKE, measurement
results cite the association's report PDF. Keep it that way — the whole point of
the redesign is that the association's arguments are checkable.

External document links point at the live WordPress `wp-content/uploads/`
directory on prokuolimo.fi. They were all verified working. If WordPress is
decommissioned those files must be migrated and the URLs in
`data/aineistot.json` and `data/uutiset.json` updated.

`media-source/` (original photos) and `lahteet/` (source PDFs) are working
directories and are not part of the deployed site.
