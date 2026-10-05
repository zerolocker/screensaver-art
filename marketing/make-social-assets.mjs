#!/usr/bin/env node
// Marketing asset engine — turn gallery pieces into a ready-to-post social clip.
//
// The nightly post is ALL of the night's pieces in one 9:16 clip, for Instagram,
// TikTok, YouTube and Pinterest alike: each piece in the order given, dissolving
// into the next, under one music bed written for the set. A single piece still
// renders on its own, in 9:16 and in 2:3 for Pinterest. It writes the
// per-platform captions too.
//
// Each piece is framed for a phone. A landscape (16:9) piece is reframed: the art
// zoomed over a blurred copy of itself, the piece's title in a pill just under it.
// A portrait piece (taller than wide, e.g. a tall painting animated at 9:16)
// already fills a phone, so its frames go out as they are, scaled to the canvas,
// and it never gets a 2:3; the poster pins its 9:16. Each piece keeps its own
// length and plays exactly once — these are authored pieces, and half of them are
// deliberately non-looping. Reuses art you already generate: the marginal cost of
// a day's social content is ~one ffmpeg run plus one Lyria call.
//
// There is no brand or marketing text in the clip (founder call, 2026-09-12): a
// post that reads as an ad gets scrolled past, and words on screen pull attention
// off the art. The title pill is the only text, and it mirrors the one the
// screensaver itself shows. The caption carries the pitch (lib/captions.mjs).
//
// It also writes a `meta.json` next to the clips: the hand-off to
// `post-social.mjs`, which publishes them. That file is why the poster never has
// to re-derive a title, a style or (critically) a landing-page slug.
//
// Usage:
//   node marketing/make-social-assets.mjs --titles "Mount Fuji" "The Milkmaid" "Irises" "Haystacks" \
//     --music-prompt "$MUSIC_PROMPT"                 # the night's post: four pieces, one clip
//   node marketing/make-social-assets.mjs --latest 4  # the four newest, oldest first
//   node marketing/make-social-assets.mjs --title "Splash Fountain"   # one piece, 9:16 + 2:3
//   node marketing/make-social-assets.mjs --src a.mp4 --title "A" --style "Baroque" \
//     --src b.mp4 --title "B" --style "Ukiyo-e"       # local files, one clip
//
// Flags:
//   --titles <t>…    these gallery pieces, in this order: each an exact title or a unique substring
//   --title <t>      one gallery piece, matched the same way (after --src: that source's title)
//   --latest [N]     the N newest gallery pieces, oldest first (default 4)
//   --src <path|url> a video file instead of a gallery piece; repeat it for a set
//   --style <text>   override the derived art style (after --src: that source's style)
//   --formats <list> one piece only: comma list of 9x16,2x3 (default: both). A set is 9:16 only.
//   --duration <sec> trim each piece to at most N seconds (default: its own length)
//   --music-prompt <text>  generate one bed from this prompt (Lyria) and score the clip with it;
//                          also records it as `music_prompt` on every piece's gallery.json entry
//   --audio <file|url>     score with an existing audio file instead of generating one
//   --gain <dB>            bed level, negative = quieter (default: -9)
//   --out <dir>      output base dir (default: marketing/out)
//
// Requires: ffmpeg on PATH, and python3 with Pillow for the title pill (Pillow is
// already a curation dependency; without it the title falls back to ffmpeg's own
// square text box). No npm deps (Node ≥18 built-ins + fetch).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { captionsMarkdown, postName, titleLine } from './lib/captions.mjs'
import { assetSlug, deriveMeta, galleryVideos, REPO_ROOT, webSlugForSrc } from './lib/pieces.mjs'
import { DEFAULT_GAIN_DB, fitBed, generateBed } from './lib/music.mjs'

/** Renders the title pill PNG; see the script for how it mirrors the screensaver's. */
const TITLE_PILL = path.join(REPO_ROOT, 'marketing', 'lib', 'title_pill.py')

/** Font for the fallback title, when the pill can't be rendered. Both ship with macOS. */
const FALLBACK_FONT = ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync)

const CANVAS_W = 1080

/**
 * One canvas per format. The poster sends 9:16 to Instagram, TikTok and YouTube,
 * whose players are 9:16 (any other shape gets black bars), and 2:3 to Pinterest,
 * whose recommended pin shape it is (a taller pin can be cut off in the feed).
 * A set, or a portrait piece, has only a 9:16, which Pinterest also takes: a set
 * can't mix shapes, and cropping a tall painting to 2:3 would cut the art.
 */
const FORMATS = {
  '9x16': { w: CANVAS_W, h: 1920 },
  '2x3': { w: CANVAS_W, h: 1620 },
}

/**
 * How far past the canvas width the art is zoomed. At 1.5× the clip keeps the
 * middle two-thirds of the piece and shows it half again as large. In a feed the
 * width is fixed, so a letterbox never makes the art bigger; only cropping does.
 * Founder call, 2026-09-12. The curation agent opens its set with a piece whose
 * subject survives the crop (AUTOMATED_CURATION.md step 8a).
 */
const ART_ZOOM = 1.5

/** Space between the bottom of the art and the top of the title pill, in canvas px. */
const TITLE_GAP = 20

/**
 * Seconds one piece takes to dissolve into the next in a set. The screensaver
 * crossfades between pieces too, over 1.5s; a feed moves faster.
 */
const CROSSFADE = 1

/** A landscape piece's frame rate on its own, and a set's when its pieces' rates differ. */
const DEFAULT_RATE = '30'

const VIDEO_OUT = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
const AUDIO_OUT = ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2']

const log = (s) => process.stdout.write(`${s}\n`)
const warn = (s) => process.stderr.write(`${s}\n`)

// ── arg parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { titles: [], srcs: [], gain: DEFAULT_GAIN_DB, out: path.join(REPO_ROOT, 'marketing', 'out') }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    // A --title or --style after a --src describes that source.
    const lastSrc = a.srcs.at(-1)
    if (arg === '--latest') {
      a.latest = /^\d+$/.test(argv[i + 1] || '') ? parseInt(next(), 10) : 4
    } else if (arg === '--titles') {
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) a.titles.push(next())
    } else if (arg === '--title') {
      if (lastSrc) lastSrc.title = next()
      else a.titles.push(next())
    } else if (arg === '--src') a.srcs.push({ src: next() })
    else if (arg === '--style') {
      if (lastSrc) lastSrc.style = next()
      else a.style = next()
    } else if (arg === '--formats') a.formats = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (arg === '--duration') a.duration = Math.max(1, parseInt(next(), 10) || 0) || undefined
    else if (arg === '--music-prompt') a.musicPrompt = next()
    else if (arg === '--audio') a.audio = next()
    else if (arg === '--gain') a.gain = parseFloat(next())
    else if (arg === '--out') a.out = path.resolve(next())
    else if (arg === '--help' || arg === '-h') a.help = true
  }
  // With one source, --title and --style may also come before --src.
  if (a.srcs.length === 1) {
    a.srcs[0].title ??= a.titles.pop()
    a.srcs[0].style ??= a.style
  }
  return a
}

// ── choosing the pieces ─────────────────────────────────────────────────────

/** One gallery piece by title: an exact match, else the only title containing `query`. */
function findPiece(videos, query) {
  const q = query.toLowerCase()
  const exact = videos.filter((e) => (e.title || '').toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  const matches = videos.filter((e) => (e.title || '').toLowerCase().includes(q))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new Error(`no gallery entry title contains "${query}"`)
  throw new Error(`"${query}" matches ${matches.length} pieces; give more of the title:\n  ` +
    matches.map((e) => e.title).join('\n  '))
}

/** The gallery entries (or entry-shaped --src sources) to render, in the order they play. */
function selectEntries(a) {
  if (a.srcs.length) {
    return a.srcs.map(({ src, title, style }) => ({
      title: title || path.basename(src).replace(/\.[^.]+$/, ''), tags: [], src, styleOverride: style, fromSrc: true,
    }))
  }
  const videos = galleryVideos()
  if (a.titles.length) return a.titles.map((t) => findPiece(videos, t))
  return videos.slice(-a.latest) // newest are appended last
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function resolveSource(src, tmp) {
  if (/^https?:\/\//i.test(src)) {
    log(`  ↓ downloading ${src}`)
    const res = await fetch(src)
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${src}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const local = path.join(tmp, 'source.mp4')
    writeFileSync(local, buf)
    return local
  }
  const abs = path.resolve(src)
  if (!existsSync(abs)) throw new Error(`source not found: ${abs}`)
  return abs
}

/**
 * Write the score's prompt onto the `gallery.json` entry of every piece it scored.
 *
 * `music_prompt` sits alongside `image_prompt` and `video_prompt` as a
 * curation-only field — the shared `ArtItem` type deliberately omits all three,
 * because no client reads them. A set shares one bed, so each of its pieces
 * carries the same prompt: the field always says what played under that piece.
 */
function recordMusicPrompt(srcs, prompt) {
  const galleryPath = path.join(REPO_ROOT, 'gallery.json')
  const items = JSON.parse(readFileSync(galleryPath, 'utf8'))
  for (const src of srcs) {
    const entry = items.find((e) => e.src === src)
    if (!entry) {
      warn(`  ⚠ no gallery.json entry for ${src} — music_prompt not recorded`)
      continue
    }
    entry.music_prompt = prompt
    log(`  ✓ gallery.json: music_prompt recorded on "${entry.title}"`)
  }
  writeFileSync(galleryPath, JSON.stringify(items, null, 2) + '\n')
}

/**
 * How long the source clip is, its frame size as displayed (the zoomed art's
 * height follows from it), its frame rate, and whether it is portrait.
 *
 * The length is the clip's length, full stop. An earlier version looped the
 * source to a fixed 12s target, which meant every 8s piece silently replayed its
 * first four seconds — on pieces `gallery.json` explicitly marks `looping: false`,
 * i.e. ones authored *not* to repeat. The art decides the length; we don't pad it.
 *
 * The size is the displayed one: a clip stored sideways with a 90° rotation flag
 * is turned upright by ffmpeg as it decodes, so that is the frame the filters
 * see, and the one that decides portrait. There is no aspect field in
 * gallery.json; the video itself is the source of truth.
 */
function probeVideo(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate:stream_tags=rotate:stream_side_data=rotation:format=duration',
    '-of', 'json', file,
  ], { encoding: 'utf8' })
  let info = {}
  try { info = JSON.parse(r.stdout || '{}') } catch { /* reported below */ }
  const duration = parseFloat(info.format?.duration)
  const stream = info.streams?.[0] ?? {}
  // Newer files carry a display matrix, older ones a `rotate` tag.
  const rotation = Number(stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
    stream.tags?.rotate ?? 0)
  const sideways = Math.abs(rotation) % 180 === 90
  const width = sideways ? stream.height : stream.width
  const height = sideways ? stream.width : stream.height
  if (r.status !== 0 || !(duration > 0) || !(width > 0) || !(height > 0)) {
    throw new Error(`could not read the duration and frame size of ${path.basename(file)}`)
  }
  return { duration, width, height, rate: stream.r_frame_rate, portrait: height > width }
}

/** "24/1" → 24. */
const rateValue = (rate) => {
  const [num, den = 1] = String(rate).split('/').map(Number)
  return num / den
}

const even = (n) => 2 * Math.round(n / 2)

/**
 * Where the zoomed art and its title sit on one canvas.
 *
 * The art is centred vertically and the title hangs just under it. On 9:16 that
 * puts the title near the top of the area Instagram's caption covers; lifting the
 * art would clear it, but the founder chose to see a real post first (2026-09-12).
 */
function layout({ w, h }, video) {
  // Veo's clips carry ~3 near-black rows along the top and bottom edges, which the
  // zoom would thicken into visible lines. Trim ~0.55% off each edge (4 rows of a
  // 720p clip) before anything else sees the frame.
  const edge = Math.ceil(video.height / 180)
  const srcH = video.height - 2 * edge
  const zoomW = even(w * ART_ZOOM)
  const zoomH = even((zoomW * srcH) / video.width)
  const artH = Math.min(zoomH, h)
  const artY = even((h - artH) / 2)
  return { edge, srcH, zoomW, zoomH, artH, artY, titleY: artY + artH + TITLE_GAP }
}

/**
 * Render the title pill once per piece: both canvases are the same width, so one
 * PNG serves every format. Returns null if python3 or Pillow isn't available, and
 * the render falls back to ffmpeg's text box rather than dropping the title.
 */
function renderTitlePill(text, dir) {
  const out = path.join(dir, 'title-pill.png')
  const r = spawnSync('python3', [TITLE_PILL, '--text', text, '--out', out, '--frame-width', String(CANVAS_W)],
    { encoding: 'utf8' })
  if (r.status === 0 && existsSync(out)) {
    try {
      return { file: out, ...JSON.parse(r.stdout.trim().split('\n').pop()) }
    } catch { /* unreadable geometry: use the fallback */ }
  }
  const why = r.error?.message || (r.stderr || '').trim().split('\n').pop() || `exit ${r.status}`
  warn(`  ⚠ title pill not rendered (${why}) — falling back to ffmpeg's text box`)
  return null
}

/**
 * The title without Pillow: ffmpeg's own text box. Square corners instead of the
 * pill, but the title still ships. Nothing measures the text here, so the size
 * comes from the character count (SF Pro averages ~0.55 em a character) to stay
 * inside the pill's 85%-of-width cap.
 */
function titleDrawtext({ w, y, titleFile, titleText }) {
  if (!FALLBACK_FONT) return null
  const size = Math.max(20, Math.min(32, Math.floor((0.85 * w) / (titleText.length * 0.55))))
  const pad = Math.round(size * 0.7)
  return `drawtext=fontfile=${FALLBACK_FONT}:textfile=${titleFile}:fontsize=${size}:fontcolor=0xF5F5F5` +
    `:box=1:boxcolor=0x141414@0.6:boxborderw=${pad}:x=(w-text_w)/2:y=${y + pad}`
}

// ── filters ─────────────────────────────────────────────────────────────────
// Each piece's filter reads its inputs (`src`, `pillSrc`) and writes `out`; in a
// set, `tag` keeps one piece's intermediate labels apart from the next one's.

/** A landscape piece, reframed: the art zoomed over a blurred copy of itself, its title under it. */
function reframeFilter({ w, h, lay, pill, titleFile, titleText, src = '0:v', pillSrc = '1:v', out = 'outv', tag = '' }) {
  const [bg, fg, bgb, art, base] = ['bg', 'fg', 'bgb', 'art', 'base'].map((label) => `[${label}${tag}]`)
  const chain = [
    // Trim the clip's dark edge rows (see layout) before either copy is made.
    `[${src}]crop=iw:${lay.srcH}:0:${lay.edge},split=2${bg}${fg}`,
    // A blurred, darkened copy of the clip fills the canvas…
    `${bg}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=26,eq=brightness=-0.12:saturation=1.08${bgb}`,
    // …and the art sits on it, zoomed and cropped to the canvas width (crop keeps the centre).
    `${fg}scale=${lay.zoomW}:${lay.zoomH},crop=${w}:${lay.artH}${art}`,
    `${bgb}${art}overlay=0:${lay.artY}${base}`,
  ]
  if (pill) {
    // The PNG carries a transparent margin for the pill's shadow; offset by it so
    // the visible pill starts TITLE_GAP below the art.
    chain.push(`${base}[${pillSrc}]overlay=(W-w)/2:${lay.titleY - pill.margin},format=yuv420p[${out}]`)
  } else {
    const text = titleDrawtext({ w, y: lay.titleY, titleFile, titleText })
    chain.push(`${base}${text ? `${text},` : ''}format=yuv420p[${out}]`)
  }
  return chain
}

/**
 * A portrait piece, as it is: no crop, zoom, blur or title, only scaled to the
 * canvas. It fits inside rather than fills, so a portrait clip that isn't exactly
 * 9:16 keeps its own shape instead of being cropped or stretched.
 */
function asIsFilter({ w, h, src = '0:v', out = 'outv' }) {
  return [`[${src}]scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,` +
    `setsar=1,format=yuv420p[${out}]`]
}

/**
 * The bed under `duration` seconds of art. It arrives fitted to at least that
 * length, so it only needs levelling and a fade at each end — a hard cut on a
 * sustained pad is very audible. The fades scale with the clip so a short piece
 * doesn't end up nearly all fade. It sits well under the art on purpose (§11.2:
 * the picture leads).
 */
function bedFilter({ index, gain, duration }) {
  const fadeIn = Math.min(1, duration / 8).toFixed(2)
  const fadeOut = Math.min(1.5, duration / 5)
  const out = Math.max(0, duration - fadeOut).toFixed(2)
  return `[${index}:a]volume=${gain}dB,afade=t=in:st=0:d=${fadeIn},` +
    `afade=t=out:st=${out}:d=${fadeOut.toFixed(2)}[outa]`
}

function ffmpeg(args, what) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${what}`)
}

// ── one piece ───────────────────────────────────────────────────────────────

/** Fetch and measure one piece, and render its title pill if it gets one. */
async function preparePiece(entry, a, tmp) {
  mkdirSync(tmp, { recursive: true })
  const { title, style } = deriveMeta(entry, entry.styleOverride ?? a.style)
  log(`• ${title}  [${style}]`)
  const input = await resolveSource(entry.src, tmp)
  // The source's own length is the piece's length. --duration only ever trims:
  // with no looping there is nothing to pad a longer target with.
  const video = probeVideo(input)
  const duration = a.duration ? Math.min(a.duration, video.duration) : video.duration
  if (a.duration && a.duration > video.duration) {
    warn(`  ⚠ --duration ${a.duration}s exceeds the source (${video.duration.toFixed(1)}s) — using the source length`)
  }
  log(`  ${duration.toFixed(1)}s${duration < video.duration ? ` (trimmed from ${video.duration.toFixed(1)}s)` : ''}`)
  if (video.portrait) log(`  portrait (${video.width}×${video.height}): as-is, no reframe or title`)
  const titleText = titleLine(title, style)
  const pill = video.portrait ? null : renderTitlePill(titleText, tmp)
  const titleFile = pill || video.portrait ? null : path.join(tmp, 'title.txt')
  if (titleFile) writeFileSync(titleFile, titleText)
  return {
    entry, title, style,
    // The gallery tag ("Japanese", "Modern"…) the hashtags and the pin's wording build on.
    era: entry.tags?.[0] ?? null,
    webSlug: entry.fromSrc ? null : webSlugForSrc(entry.src),
    input, video, duration, titleText, pill, titleFile,
  }
}

/** What the captions need to know about a piece. */
const captionPiece = ({ title, style, era, webSlug }) => ({ title, style, era, webSlug })

function renderFormat({ piece, fmtKey, outFile, bed, gain }) {
  const { input, video, duration, pill } = piece
  const fmt = FORMATS[fmtKey]
  const asIs = video.portrait
  const chain = asIs ? asIsFilter(fmt)
    : reframeFilter({ ...fmt, lay: layout(fmt, video), pill, titleFile: piece.titleFile, titleText: piece.titleText })
  // Input order decides the filter's stream indices: art, [title pill], [bed].
  if (bed) chain.push(bedFilter({ index: pill ? 2 : 1, gain, duration }))
  ffmpeg([
    // The art plays once, at its own length. The still title pill repeats, and -t bounds it.
    '-i', input,
    ...(pill ? ['-loop', '1', '-i', pill.file] : []),
    ...(bed ? ['-i', bed] : []),
    '-filter_complex', chain.join(';'),
    '-map', '[outv]',
    ...(bed ? ['-map', '[outa]', ...AUDIO_OUT] : ['-an']),
    '-t', String(duration),
    // A portrait piece keeps its own frame rate, so every source frame appears
    // exactly once; 24 → 30 would repeat every fourth one.
    ...(asIs ? [] : ['-r', DEFAULT_RATE]),
    ...VIDEO_OUT,
    outFile,
  ], fmtKey)
}

/** One piece on its own: a 9:16 and (landscape only) a 2:3, its captions and its meta.json. */
function writePiecePost({ piece, a, bed, scratch }) {
  const { entry, title, style, era, webSlug, video, duration } = piece
  const slug = assetSlug(title) || 'piece'
  const dir = path.join(a.out, slug)
  mkdirSync(dir, { recursive: true })
  const fitted = bed && fitBed({ bed, length: duration, outFile: path.join(scratch, 'bed-fitted.wav') })
  // A portrait piece never gets a 2:3: the poster pins its 9:16, uncropped.
  const fmtKeys = video.portrait ? ['9x16'] : (a.formats ?? Object.keys(FORMATS))
  const formats = {}
  for (const fmtKey of fmtKeys) {
    const name = `${slug}_${fmtKey}.mp4`
    const outFile = path.join(dir, name)
    renderFormat({ piece, fmtKey, outFile, bed: fitted, gain: a.gain })
    formats[fmtKey] = name
    log(`  ✓ ${path.relative(REPO_ROOT, outFile)} (${(statSync(outFile).size / 1e6).toFixed(1)} MB)`)
  }
  writeFileSync(path.join(dir, 'captions.md'), captionsMarkdown([captionPiece(piece)]))
  // The hand-off to post-social.mjs. Everything it needs to publish this
  // piece — above all `webSlug`, the permanent landing page — is recorded
  // here at render time, so the poster never re-derives it.
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1,
    assetSlug: slug,
    webSlug,
    title,
    style,
    era,
    galleryTitle: entry.title ?? null,
    src: entry.src,
    date: entry.date ?? null,
    duration: Number(duration.toFixed(3)),
    musicPrompt: a.musicPrompt ?? null,
    formats,
    renderedAt: new Date().toISOString(),
  }, null, 2) + '\n')
  log(`  ✓ ${path.relative(REPO_ROOT, path.join(dir, 'captions.md'))} + meta.json`)
}

// ── a set ───────────────────────────────────────────────────────────────────

/**
 * A set's timing. Every segment is brought to one frame rate and an exact frame
 * count, so each dissolve starts exactly where its offset says. The rate is the
 * pieces' own when they all share one, so no frame is repeated; else 30.
 */
function planSet(pieces) {
  const rates = new Set(pieces.map((p) => p.video.rate))
  const [shared] = rates
  const rate = rates.size === 1 && rateValue(shared) >= 15 && rateValue(shared) <= 60 ? shared : DEFAULT_RATE
  const fps = rateValue(rate)
  // A piece shorter than three crossfades would be nearly all transition.
  const fadeFrames = Math.round(Math.min(CROSSFADE, ...pieces.map((p) => p.duration / 3)) * fps)
  const frames = pieces.map((p) => Math.round(p.duration * fps))
  const total = frames.reduce((sum, n) => sum + n, 0) - fadeFrames * (pieces.length - 1)
  return { rate, fps, fadeFrames, frames, duration: total / fps }
}

/** The set as one 9:16 clip, in one ffmpeg run, so the art is encoded only once. */
function renderSet({ pieces, plan, outFile, bed, gain }) {
  const fmt = FORMATS['9x16']
  const { rate, fps, fadeFrames, frames } = plan
  const inputs = []
  const input = (...args) => inputs.push(args) - 1
  const chain = []
  let joined = null
  let length = 0
  pieces.forEach((p, i) => {
    const src = `${input('-i', p.input)}:v`
    if (p.video.portrait) {
      chain.push(...asIsFilter({ ...fmt, src, out: `seg${i}` }))
    } else {
      // The pill is a still looped into a stream; -t ends it with its piece.
      const pillSrc = p.pill ? `${input('-loop', '1', '-t', String(Math.ceil(p.duration) + 1), '-i', p.pill.file)}:v` : null
      chain.push(...reframeFilter({
        ...fmt, lay: layout(fmt, p.video), pill: p.pill, titleFile: p.titleFile, titleText: p.titleText,
        src, pillSrc, out: `seg${i}`, tag: i,
      }))
    }
    // tpad clones the last frame in case a source ends a frame short of its stated length.
    chain.push(`[seg${i}]fps=${rate},tpad=stop_mode=clone:stop_duration=1,trim=end_frame=${frames[i]},` +
      `setpts=PTS-STARTPTS,setsar=1[n${i}]`)
    if (i === 0) {
      joined = 'n0'
      length = frames[0]
      return
    }
    const out = i === pieces.length - 1 ? 'outv' : `x${i}`
    chain.push(`[${joined}][n${i}]xfade=transition=fade:duration=${(fadeFrames / fps).toFixed(4)}` +
      `:offset=${((length - fadeFrames) / fps).toFixed(4)}[${out}]`)
    joined = out
    length += frames[i] - fadeFrames
  })
  if (bed) chain.push(bedFilter({ index: input('-i', bed), gain, duration: plan.duration }))
  ffmpeg([
    ...inputs.flat(),
    '-filter_complex', chain.join(';'),
    '-map', '[outv]',
    ...(bed ? ['-map', '[outa]', ...AUDIO_OUT] : ['-an']),
    '-t', plan.duration.toFixed(3),
    ...VIDEO_OUT,
    outFile,
  ], 'the set')
}

/** A set as one post: its 9:16 clip, captions naming every piece, and a meta.json listing them. */
function writeSetPost({ pieces, a, bed, scratch }) {
  const [first] = pieces
  const title = postName(pieces)
  const slug = assetSlug(title) || 'set'
  const dir = path.join(a.out, slug)
  mkdirSync(dir, { recursive: true })
  const plan = planSet(pieces)
  log(`Set: ${pieces.length} pieces, ${plan.duration.toFixed(1)}s at ${plan.fps} fps`)
  const fitted = bed && fitBed({ bed, length: plan.duration, outFile: path.join(scratch, 'bed-fitted.wav') })
  const name = `${slug}_9x16.mp4`
  const outFile = path.join(dir, name)
  renderSet({ pieces, plan, outFile, bed: fitted, gain: a.gain })
  log(`  ✓ ${path.relative(REPO_ROOT, outFile)} (${(statSync(outFile).size / 1e6).toFixed(1)} MB)`)
  writeFileSync(path.join(dir, 'captions.md'), captionsMarkdown(pieces.map(captionPiece)))
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1,
    assetSlug: slug,
    // The pin links to the first piece's page: a pin has one link, and the
    // first piece is the one its title names.
    webSlug: first.webSlug,
    title,
    style: first.style,
    era: first.era,
    date: pieces.map((p) => p.entry.date).filter(Boolean).sort().at(-1) ?? null,
    duration: Number(plan.duration.toFixed(3)),
    musicPrompt: a.musicPrompt ?? null,
    formats: { '9x16': name },
    pieces: pieces.map((p) => ({
      ...captionPiece(p),
      galleryTitle: p.entry.title ?? null,
      src: p.entry.src,
      date: p.entry.date ?? null,
      duration: Number(p.duration.toFixed(3)),
    })),
    renderedAt: new Date().toISOString(),
  }, null, 2) + '\n')
  log(`  ✓ ${path.relative(REPO_ROOT, path.join(dir, 'captions.md'))} + meta.json`)
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help || (!a.srcs.length && !a.titles.length && !a.latest)) {
    log('Usage: node marketing/make-social-assets.mjs\n' +
      '       [--titles <t> <t>… | --title <t> | --latest N | --src <path|url> [--title <t>] [--style <s>]…]\n' +
      '       [--style <text>] [--formats 9x16,2x3] [--duration <sec, trims each piece>]\n' +
      '       [--music-prompt <text> | --audio <file|url>] [--gain -9] [--out <dir>]')
    process.exit(a.help ? 0 : 1)
  }
  if (a.srcs.length && a.titles.length) throw new Error('pass --src files or gallery --titles, not both')
  const unknown = (a.formats ?? []).filter((f) => !FORMATS[f])
  if (unknown.length) throw new Error(`unknown format(s) ${unknown.join(', ')} (use ${Object.keys(FORMATS).join(', ')})`)
  if (a.musicPrompt && a.audio) throw new Error('pass either --music-prompt or --audio, not both')

  const entries = selectEntries(a)
  const isSet = entries.length > 1
  if (isSet && a.formats?.some((f) => f !== '9x16')) {
    throw new Error('a set renders 9:16 only (its pieces can\'t share a 2:3 clip); drop --formats')
  }

  const scratch = mkdtempSync(path.join(tmpdir(), 'lart-social-'))
  try {
    // Fetch and measure every piece first: a missing source then costs nothing,
    // rather than a paid music call.
    log(`Preparing ${entries.length} piece(s) → ${a.out}`)
    const pieces = []
    for (const [i, entry] of entries.entries()) pieces.push(await preparePiece(entry, a, path.join(scratch, String(i))))

    let bed = null
    if (a.musicPrompt) {
      log(`Music: generating a bed for this post…\n  ${a.musicPrompt}`)
      bed = generateBed({ prompt: a.musicPrompt, outFile: path.join(scratch, 'bed.mp3') })
    } else if (a.audio) {
      bed = /^https?:\/\//i.test(a.audio) ? await resolveSource(a.audio, scratch) : path.resolve(a.audio)
      if (!existsSync(bed)) throw new Error(`audio not found: ${bed}`)
    }
    if (bed) log(`  ✓ bed ready, mixing at ${a.gain} dB`)

    if (isSet) writeSetPost({ pieces, a, bed, scratch })
    else writePiecePost({ piece: pieces[0], a, bed, scratch })

    // The prompt is the durable half of the score: record it on the pieces
    // themselves so the catalog says how each one sounded, and the MP3 can stay
    // disposable.
    if (a.musicPrompt && !a.srcs.length) recordMusicPrompt(pieces.map((p) => p.entry.src), a.musicPrompt)
    log('Done.')
  } finally {
    // Sources, pills and the bed are scratch by design — the prompt in
    // gallery.json is what makes the score reproducible.
    rmSync(scratch, { recursive: true, force: true })
  }
}

main().catch((err) => {
  warn(`Error: ${err.message}`)
  process.exit(1)
})
