# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The prokuolimo.fi website for Pro Kuolimo ry, a Finnish volunteer association
protecting Lake Kuolimo. Hand-written static HTML/CSS/JS. **No build step, no
framework, no server code** — fonts, images and data all ship with the site.
Content is in Finnish; keep it that way, including code comments and commit
messages.

**No external network requests at runtime, with one scoped exception:** the map
pages fetch OpenStreetMap tiles. Leaflet itself is vendored in
`assets/vendor/leaflet/`, like the fonts. `kartta.html` and `kirjaa.html` build
their map on load; `nakosyvyys.html` embeds the same map but **builds it only
once the section scrolls near the viewport**, so that page still loads asking
nothing from outside — its register table and per-point charts must keep working
with no network. The remaining seven pages request nothing external at all, and
that is worth keeping.

## Commands

```bash
python3 -m http.server 8000                 # dev server (required — see below)
python3 tools/check-links.py                # internal links, anchors, images
python3 tools/check-links.py --ulkoiset     # also HEAD-checks external PDF links
./tools/build-images.sh                     # regenerate assets/img from media-source (ImageMagick)
python3 tools/extract-nakosyvyys.py X.pdf > data/nakosyvyys.json
python3 tools/johda-pistesijainnit.py X.pdf > data/mittauspisteet.json
```

There is no test suite. `check-links.py` is the regression check — run it after
touching any page, JSON file, or the `NAV` array; it exits non-zero on failure.

**The site must be served over HTTP.** Opening a page via `file://` breaks it
completely: ES modules and `fetch()` both fail, which means no header, no
footer, and no data-driven content.

## Publishing

**Standing instruction from the repo owner: always push finished work to GitHub
without asking.** `origin` is `teppotk/prokuo` and GitHub Pages builds from
`main` at the repo root, so a push to `main` is a live deploy to
<https://teppotk.github.io/prokuo/>. The working rhythm is therefore: make the
change, run `check-links.py`, commit in Finnish, `git push origin main`, wait
for the Pages build, and check the result on the live URL — not only locally.

```bash
gh api repos/teppotk/prokuo/pages/builds/latest --jq '.status + " " + .commit'
```

Two things this standing permission does not cover, because they are not
"updates": deleting published material, and anything that would put credentials
or personal data into a public repo. Ask first for those.

Verifying live matters more here than in most projects. Pages serves everything
with `max-age=600`, the field page installs a service worker, and the map calls
a third-party tile service — three ways for a deploy to behave differently from
`localhost`, each of which has already bitten this site once.

## Architecture

**Eight pages at the repo root** (`index`, `kuolimo`, `toiminta`, `nakosyvyys`,
`aineistot`, `uutiset`, `yhdistys`, `liity`). Prose and factual content live
directly in the HTML so they work without JS and are indexable.

**Two further pages.** `kartta.html` is public but reached from
`nakosyvyys.html`, not from the menu. `kirjaa.html` is the field-logging tool
and *is* in `NAV` — put there so testers can find it while the prototype is
being tried out. It keeps `noindex` and the `robots.txt` `Disallow`, which stop
search engines but not people, and the passphrase is currently switched off, so
treat the page as public. When the testing round ends, the honest options are to
take it out of `NAV` again or to switch the passphrase back on. Both pages are in
`check-links.py`'s scope like any other page; `kartta.html` is in `sitemap.xml`
and `kirjaa.html` deliberately is not.

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

## Maps and field logging

`kartta.html` + `assets/js/kartta.js` render the register on a Leaflet map with
a round-by-round timeline. `kirjaa.html` + `assets/js/kirjaa.js` is the tool a
volunteer uses in the boat. `assets/js/kartta-apu.js` holds what they share
(map creation, marker icons, distance).

- Markers are `L.divIcon`s carrying `data-bin`, not Leaflet circles, so the
  colours come from the same `--b1`…`--b6` ramp as the register table and dark
  mode needs no extra logic. The measured number is always printed on the
  marker — the same "never colour alone" rule as the table.
- The class bins live in `assets/js/luokat.js`, **not in `site.js`**, and that is
  load-bearing. GitHub Pages serves everything with `max-age=600`, so for ten
  minutes after a deploy a browser can pair a freshly fetched new module with a
  stale cached `site.js`. A new module importing a newly added `site.js` export
  then dies on `SyntaxError: does not provide an export named …`, which no
  `try`/`catch` on the page can see — it took down both map pages at once once
  already. **Never add an export to `site.js` for a new module to import; put
  shared new code in a new file**, which cannot be stale.
- A saved row in the list is clickable: it puts that entry's own coordinate and
  point back into the map and the form, so a volunteer can see where an earlier
  measurement went and add a new reading to the same point. The whole row is a
  hit target via an `::after` overlay on a real `<button>`, because a `<button>`
  may only contain phrasing content and the row's `<dl>` of fields may not live
  inside one.
- The point `<select>` opens on a placeholder, not on a real point. A browser
  selects the first `<option>` by default, and a silently preselected point
  collects other points' measurements. For the same reason nothing auto-selects
  a point from a GPS fix either: the nearest point is only *shown* in the status
  line, and choosing it is an explicit press of "Lähin piste". Saving is blocked
  until a location has actually been set (`tila.lahde === "aloitus"`), so the
  centroid the marker starts from can never reach the data.
- The passphrase on `kirjaa.html` is **currently switched off**:
  `TUNNUS_KAYTOSSA = false`, so the gate opens on any submit including an empty
  one. Turning it back on means that constant *and* restoring the input's
  `required` attribute and the gate's wording in `kirjaa.html` — without
  `required` removed, an empty form never fires `submit` at all, which is why
  the two go together. The hash (`kuolimo2026`) stays in `TUNNUS_TIIVISTE`; a new
  one comes from `prokuolimoTiiviste("…")` in the console. Even switched on it
  was never security, only a doorbell, so nothing sensitive may be logged there.
- Logged measurements live in `localStorage` only and are exported as JSON or
  CSV (semicolon-separated, decimal comma, BOM — Finnish Excel). Database
  storage is an open decision, not a finished one; keep the export path working.
- Choosing a point zooms the map in to `PISTEEN_ZOOM` (13) instead of only
  panning. The opening view is fitted to all thirty points, where they sit in one
  clump and none can be identified, so without this the volunteer re-did the same
  zoom by hand every time. 13 leaves roughly a couple of kilometres on screen —
  the bay, the far shore and the neighbouring points — which is what lets someone
  confirm they picked the right point. An existing closer zoom is never undone.
- **Testing note:** Leaflet's animated zoom never finishes under Chrome headless
  with `--virtual-time-budget`, so `map.getZoom()` keeps its old value and zoom
  controls, wheel, double-click and `setView` all look broken. Assert zoom against
  a copy of `kartta-apu.js` with `zoomAnimation: false`, and measure the level from
  the pixel distance between two point markers rather than from tile URLs.
- `kirjaa.html` must send a `Referer` to the tile server. Its
  `<meta name="referrer">` is `origin`, never `no-referrer`: OpenStreetMap's
  volunteer servers block traffic they cannot attribute to an app and answer
  with an "Access blocked" PNG under **HTTP 200**, so it fails as a broken-looking
  map rather than an error. `origin` sends only `https://…github.io/`, so the
  logging page's own path still does not leak.
- `kirjaa-sw.js` is a service worker that caches the logging page's own files
  and already-viewed map tiles, because the lake has poor coverage. It passes
  everything else straight through, so it must not affect the other pages, and
  it is network-first on purpose: its `RUNKO` list includes `site.css` and
  `site.js`, and serving those from cache would freeze the whole site's styling
  for anyone who had once opened the logging page. Still bump `VERSIO` when a
  `RUNKO` file changes, so stale caches get swept.

## The näkösyvyys register

`nakosyvyys.html` plus `assets/js/nakosyvyys.js` is the site's signature
element and its most fragile part. The dataset is *derived*, not authored:
`tools/extract-nakosyvyys.py` pairs point labels with values by geometry from
the association's PDF report, using a deliberately strict positional rule and
skipping anything ambiguous (it reports skips on stderr). The source report is
`aineistot/2025-11-19-pro-kuolimo-nakosyvyysmittaustulokset.pdf`.

Consequences to respect:

- The PDF is the authoritative source. Never hand-edit `data/nakosyvyys.json`
  to "fix" a value; fix the extractor or the `ALIAS` table and re-run it.
- `data/mittauspisteet.json` is derived too, by `tools/johda-pistesijainnit.py`,
  which reads the orange location markers off the slide images. The report has no
  coordinates at all, so the map image was fitted to the coordinate system using
  the points' own place names as control points (OpenStreetMap, least squares,
  RMS ≈ 0.6 km). **Every position is an estimate, roughly a kilometre out**, and
  carries `"tarkkuus": "arvio"` to say so. Volunteers correct positions in the
  field via `kirjaa.html`, and a correction becomes `"tarkkuus": "mitattu"` —
  so re-running the tool would overwrite real measurements. Check the diff.
- Missing cells are real (some points are not measured on some rounds, and the
  March round is measured from the ice with far fewer points). Render them as
  gaps, never as zeros.
- The trend charts' y axis runs **downwards**: 0 m, the water surface, is the top
  edge and depth increases toward the bottom, so clearing water pushes the curve
  *down*. Upwards read as backwards — a rising line looked like improvement while
  the axis measured depth. The surface is drawn as a rule heavier than the
  gridlines, and a `--humus` gradient hazes the top of the plot and fades out
  with depth. That gradient is an axis hint anchored to the scale, not data: it
  is deliberately faint (0.22), because at half opacity it read as a filled area
  chart and buried the line. `--humus` is its own token precisely so it is never
  confused with the `--b` ramp, which means measured class on the map and table.
- The per-point trend section on `nakosyvyys.html` is **small multiples, one
  series each** — thirty lines in one plot would be unreadable and there is no
  palette that separates thirty series. The y scale is shared (0–7 m) so points
  are comparable, which flattens the curves; the charts are therefore taller
  than wide-format sparklines would be. The change figure is the **same-month
  year-over-year** difference (June 2024 vs June 2025 and so on, at most three
  pairs), because consecutive rounds differ by season and cannot be subtracted.
  Direction is not colour-coded: the sign carries it, and `--nieria` stays
  reserved. Two years is not a trend, and the section says so.
- Round summary bars encode two things on purpose: segment proportions show the
  class distribution, and total bar width shows sample size relative to the
  largest round. Do not normalise the widths to 100 %.

## Design system

Tokens live in `:root` in `assets/css/site.css`. **The site is dark only.** It
used to ship a light palette with a chosen dark set under
`prefers-color-scheme: dark`, but a reader on a phone in light mode then saw a
white site — and, worse, the näkösyvyys ramp ran the opposite way in the two
modes (darker = clearer in light, lighter = clearer in dark), which read as
nonsense to anyone comparing devices. There is now one palette and one ramp
direction. `:root` carries `color-scheme: dark`, which is what makes native
controls — selects, date and time pickers, checkboxes, scrollbars — render dark
too; do not drop it. Each page carries a single `theme-color` meta.

Re-introducing a light theme means re-introducing that contradiction, so if it
ever comes back, the ramp has to keep one meaning in both.

- Type roles: Fraunces (voice, headings), Archivo (information, body and UI),
  IBM Plex Mono (measurement — numbers, dates, identifiers, captions).
  Self-hosted in `assets/fonts/` as latin + latin-ext subsets.
- `--b1` … `--b6` are a single-hue sequential water ramp for näkösyvyys classes,
  **lighter = clearer water** (the ramp reads as more light reaching deeper).
  Each has a paired `--bN-fg` text colour chosen so the
  number on top clears 4.5:1. **Changing a background step without rechecking its
  `-fg` pair breaks contrast.** Known issue, measured not guessed: the two
  darkest steps sit close to the page background — `--b1` reaches only 1.27:1
  against `--paper` and `--b2` 1.84:1, below the 2:1 an ordinal ramp wants. The
  value printed on the cell is unaffected (`--b1` against `--b-on-dark` is
  12.3:1), so no data is lost, but the murkiest cells blend into the page.
  Fixing it means re-spacing the whole ramp, which touches the register table,
  the map markers, the legend and the trend charts at once — a deliberate design
  pass, not a token tweak.
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

## Documents

Every report, plan, instruction sheet and presentation the association
publishes lives in `aineistot/` — 73 files, ~140 MB, copied byte-for-byte from
the old WordPress site. Filenames are ASCII, lowercase, hyphenated (ä→a, ö→o)
so no URL needs percent-encoding. The site has **no runtime dependency on
prokuolimo.fi** any more; every document link is relative.

- These are official monitoring reports and public records. Do not recompress,
  re-render or otherwise alter them — provenance matters more than repo size.
- Adding a document means two edits: the file into `aineistot/` and a row in
  `data/aineistot.json`. `check-links.py` validates the `"url"` fields of both
  data files against the filesystem, so a typo fails the check.

`media-source/` (original photographs, input to `build-images.sh`) is the only
working directory that is not part of the deployed site.

Absolute `https://prokuolimo.fi/` URLs remain only in `canonical`/`og:` tags and
`sitemap.xml`, pointing at the eventual production address. Everything else is
relative, which is why the site also works from a subdirectory such as the
GitHub Pages preview at `teppotk.github.io/prokuo/`.
