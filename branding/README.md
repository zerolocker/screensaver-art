# Living Art — Brand & Logo

The brand foundation distilled from the strategy docs, and the reasoning behind
the logo mark. Assets in this folder are the source of truth; the mark's
geometry is **generated** by [`generate-logo.mjs`](generate-logo.mjs) (edit the
script, not the SVGs).

## Brand foundation (what the logo has to express)

**Story.** A solo maker kept wishing his Mac looked as good idle as it does in
use. Aerial is gorgeous but finite — you've seen every clip a hundred times. So
he built a screensaver that hangs *centuries of art, gently animated by AI* on
the idle screen, and quietly adds **one new curated piece every night**. You
never see the same wall twice.

**Positioning.** *A curated daily art channel* — not another wallpaper engine.
The one-liner everywhere: **"Turn your screensaver into a living gallery."**
The wedge is **curation + daily freshness**, the two things free incumbents
(Aerial, Wallpaper Engine's Workshop, Lively) structurally can't offer.

**Audience.** Aesthetic-minded Mac users: designers, writers, devs who stare at
a screen all day and care how it looks; the desk-setup crowd; the AI-art-curious
who enjoy the imagery but don't want to prompt it themselves. Sell the
*feeling*, not the tech.

**Voice.** Quiet, tasteful, gallery-like; indie-maker honest. "No ads, no
noise, just beautiful screens." Never hypey — the art does the talking.

**Existing visual language** (already live on the site and in the app):
near-black canvas `#0b0b0c`, brand mint `#9ee8a2` (`--primary`), dark-green ink
`#0d2114` (`--primary-foreground`), Playfair Display serif headlines with an
italic green accent, Inter body, frosted pills, rounded tiles with a soft mint
glow. The logo had to live inside this system — the placeholder it replaces was
a stock Lucide "Layers" icon that said nothing about art or motion.

## The mark: the living swirl

A single tapered brushstroke that winds into a spiral — **classic art in
motion**. It compresses the brand into one gesture:

- **Classic art** — the swirl is the most recognizable shorthand for painterly
  motion in art history: Van Gogh's Starry Night sky, Hokusai's cresting wave.
  (An earlier hand-saved spiral icon — `interesting-spiral-icon-for-later-use.svg`,
  since removed from `public/` — pointed the same way; this is that instinct
  made into clean, scalable geometry.)
- **Living** — a brushstroke with a thick head and a tapering tail reads as
  movement, wind, breath: art that isn't static.
- **The daily cycle** — the spiral returns on itself: a new piece every night,
  the gallery always turning.

It is drawn as pure geometry (a log-spiral centerline with a tapered stroke
width, emitted as one filled path), so it stays crisp from a 1024px app icon
down to a 16px favicon, and it deliberately contains no letterform, sparkle, or
"AI" cliché — the brand is the *gallery*, not the model.

The mark was selected from a 14-candidate exploration (swirl weight/turn/
direction variants, a rotating brushstroke "bloom", literal gallery-frame
marks, a nightly "moonrise", and other sketches). The swirl won because it is
the only concept that says *classic art* and *motion* in a single gesture and
still survives the 16px favicon.

## Assets & usage

| File | What / where |
|---|---|
| `logo-tile.svg` | The app-icon form: ink swirl on the mint rounded tile. Source for the favicon and all raster icons. |
| `logo-mark-ink.svg` | Bare swirl in ink — for use on mint or light surfaces. |
| `logo-mark-mint.svg` | Bare swirl in mint — for the near-black site/marketing surfaces. |
| `living-art-screensaver-web/public/icon.svg` | Favicon (a copy of the tile; written by the generator). |
| `living-art-screensaver-web/lib/logo-path.ts` | Generated path constant shared by `components/logo-mark.tsx` (header + footer) and the OG image. |
| `living-art-screensaver-web/public/apple-icon.png` | 180×180 raster of the tile. |
| `electron-app/build/icon.png` | 1024×1024 raster of the tile (electron-builder derives the platform icons from it). |

**Lockups.** In-product/UI: the mint tile badge + "Living Art Screensaver" in
Inter semibold (the header pattern). Marketing/social: the bare mint swirl +
*Living Art* in Playfair Display italic — matching the site's italic-green
headline accent.

**Rules of thumb.** The mark always sits in exactly one of the two brand
colors (never gradients, never outlined); give it clear space of at least half
its width; on photography/art, prefer the frosted-pill treatment already used
by the screensaver's UpsellPill rather than stamping the swirl over the art.

## Regenerating

```bash
node branding/generate-logo.mjs   # rewrites the SVGs + lib/logo-path.ts
```

To re-rasterize the PNGs (180 apple-icon, 1024 electron icon), render
`logo-tile.svg` at the target size with any SVG rasterizer — e.g. headless
Chromium with a transparent background:

```bash
chromium --headless --no-sandbox --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot=electron-app/build/icon.png page-embedding-the-svg.html
```
