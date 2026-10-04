#!/usr/bin/env node
// Renders a gallery piece as vertical social clips: 9:16 (Instagram, TikTok,
// YouTube) and 2:3 (Pinterest), with the art zoomed over a blurred copy of itself,
// its title in a pill underneath, and optional music written for it. Also writes
// the captions and `meta.json`, the hand-off to post-social.mjs. The clip plays
// once at the source's length. No brand text in the clip: the caption sells.
// See marketing/README.md.
//
// Usage:
//   node marketing/make-social-assets.mjs --latest 4              # render the night's batch
//   node marketing/make-social-assets.mjs --title "Splash Fountain" \
//     --music-prompt "$MUSIC_PROMPT"                              # score the one being posted
//   node marketing/make-social-assets.mjs --title "Art Nouveau"
//   node marketing/make-social-assets.mjs --src ./clip.mp4 --title "My Piece" --style "Baroque"
//   node marketing/make-social-assets.mjs --title x --formats 9x16 --duration 15
//
// Flags:
//   --latest [N]     process the N newest gallery.json entries (default 4)
//   --title <substr> process the gallery entry whose title contains <substr> (case-insensitive)
//   --src <path|url> use this MP4 directly (skip gallery lookup); pair with --title/--style
//   --style <text>   override the derived art style (shown in the title pill + captions)
//   --formats <list> comma list of 9x16,2x3 (default: both)
//   --duration <sec> trim to at most N seconds (default: the source clip's own length)
//   --music-prompt <text>  generate music from this prompt (Lyria) and record it
//                          as `music_prompt` on the piece's gallery.json entry
//   --audio <file|url>     score with an existing audio file instead of generating one
//   --gain <dB>            music level (default: -9)
//   --out <dir>      output base dir (default: marketing/out)
//
// Requires ffmpeg, and python3 with Pillow for the title pill (without Pillow the
// title falls back to a plain ffmpeg text box). No npm deps (Node ≥18).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { captionsMarkdown, titleLine } from './lib/captions.mjs'
import { artworkOf, assetSlug, deriveMeta, galleryVideos, REPO_ROOT, webSlugForSrc } from './lib/pieces.mjs'
import { DEFAULT_GAIN_DB, generateBed } from './lib/music.mjs'

/** Renders the title pill PNG. */
const TITLE_PILL = path.join(REPO_ROOT, 'marketing', 'lib', 'title_pill.py')

/** Font for the fallback title. Both ship with macOS. */
const FALLBACK_FONT = ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync)

const CANVAS_W = 1080

/** 9:16 for Instagram, TikTok and YouTube; 2:3 for Pinterest. */
const FORMATS = {
  '9x16': { w: CANVAS_W, h: 1920 },
  '2x3': { w: CANVAS_W, h: 1620 },
}

/**
 * Art width as a multiple of the canvas width. 1.5 shows the middle two-thirds
 * of the piece, bigger: in a fixed-width feed only cropping enlarges the art.
 */
const ART_ZOOM = 1.5

/** Space between the bottom of the art and the top of the title pill, in canvas px. */
const TITLE_GAP = 20

// ── arg parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {
    formats: Object.keys(FORMATS),
    gain: DEFAULT_GAIN_DB, out: path.join(REPO_ROOT, 'marketing', 'out'),
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--latest') {
      const n = /^\d+$/.test(argv[i + 1] || '') ? parseInt(next(), 10) : 4
      a.latest = n
    } else if (arg === '--title') a.title = next()
    else if (arg === '--src') a.src = next()
    else if (arg === '--style') a.style = next()
    else if (arg === '--formats') a.formats = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (arg === '--duration') a.duration = Math.max(1, parseInt(next(), 10) || 0) || undefined
    else if (arg === '--music-prompt') a.musicPrompt = next()
    else if (arg === '--audio') a.audio = next()
    else if (arg === '--gain') a.gain = parseFloat(next())
    else if (arg === '--out') a.out = path.resolve(next())
    else if (arg === '--help' || arg === '-h') a.help = true
  }
  return a
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function resolveSource(src, tmp) {
  if (/^https?:\/\//i.test(src)) {
    process.stdout.write(`  ↓ downloading ${src}\n`)
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

/** Record the music prompt on the piece's `gallery.json` entry (a curation-only field). */
function recordMusicPrompt(src, prompt) {
  const galleryPath = path.join(REPO_ROOT, 'gallery.json')
  const items = JSON.parse(readFileSync(galleryPath, 'utf8'))
  const entry = items.find((e) => e.src === src)
  if (!entry) {
    process.stderr.write(`  ⚠ no gallery.json entry for ${src} — music_prompt not recorded\n`)
    return
  }
  entry.music_prompt = prompt
  writeFileSync(galleryPath, JSON.stringify(items, null, 2) + '\n')
  process.stdout.write(`  ✓ gallery.json: music_prompt recorded on "${entry.title}"\n`)
}

/** The source clip's duration and frame size. The clip is never looped to pad it. */
function probeVideo(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file,
  ], { encoding: 'utf8' })
  let info = {}
  try { info = JSON.parse(r.stdout || '{}') } catch { /* reported below */ }
  const duration = parseFloat(info.format?.duration)
  const { width, height } = info.streams?.[0] ?? {}
  if (r.status !== 0 || !(duration > 0) || !(width > 0) || !(height > 0)) {
    throw new Error(`could not read the duration and frame size of ${path.basename(file)}`)
  }
  return { duration, width, height }
}

const even = (n) => 2 * Math.round(n / 2)

/**
 * Where the art and its title sit: art centred vertically, title just under it.
 * On 9:16 the title may fall under Instagram's caption; lifting the art would fix that.
 */
function layout({ w, h }, video) {
  // Veo clips have a few near-black rows at the top and bottom, which the zoom
  // would turn into visible lines. Trim ~0.55% off each edge.
  const edge = Math.ceil(video.height / 180)
  const srcH = video.height - 2 * edge
  const zoomW = even(w * ART_ZOOM)
  const zoomH = even((zoomW * srcH) / video.width)
  const artH = Math.min(zoomH, h)
  const artY = even((h - artH) / 2)
  return { edge, srcH, zoomW, zoomH, artH, artY, titleY: artY + artH + TITLE_GAP }
}

/**
 * Render the title pill once; both canvases share a width. Returns null without
 * python3 or Pillow, and the caller falls back to ffmpeg's text box.
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
  process.stderr.write(`  ⚠ title pill not rendered (${why}) — falling back to ffmpeg's text box\n`)
  return null
}

/**
 * Fallback title: ffmpeg's text box. Font size is estimated from the character
 * count (~0.55 em each) to stay within 85% of the width.
 */
function titleDrawtext({ w, y, titleFile, titleText }) {
  if (!FALLBACK_FONT) return null
  const size = Math.max(20, Math.min(32, Math.floor((0.85 * w) / (titleText.length * 0.55))))
  const pad = Math.round(size * 0.7)
  return `drawtext=fontfile=${FALLBACK_FONT}:textfile=${titleFile}:fontsize=${size}:fontcolor=0xF5F5F5` +
    `:box=1:boxcolor=0x141414@0.6:boxborderw=${pad}:x=(w-text_w)/2:y=${y + pad}`
}

function buildFilter({ w, h, lay, pill, titleFile, titleText, audio, audioIndex, gain, duration }) {
  const chain = [
    // Trim the dark edge rows (see layout).
    `[0:v]crop=iw:${lay.srcH}:0:${lay.edge},split=2[bg][fg]`,
    // A blurred, darkened copy fills the canvas…
    `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=26,eq=brightness=-0.12:saturation=1.08[bgb]`,
    // …and the art sits on it, zoomed and centre-cropped to the canvas width.
    `[fg]scale=${lay.zoomW}:${lay.zoomH},crop=${w}:${lay.artH}[art]`,
    `[bgb][art]overlay=0:${lay.artY}[base]`,
  ]
  if (pill) {
    // Offset by the PNG's transparent shadow margin.
    chain.push(`[base][1:v]overlay=(W-w)/2:${lay.titleY - pill.margin},format=yuv420p[outv]`)
  } else {
    const text = titleDrawtext({ w, y: lay.titleY, titleFile, titleText })
    chain.push(`[base]${text ? `${text},` : ''}format=yuv420p[outv]`)
  }
  if (audio) {
    // Cut the ~30s track to the clip with fades at both ends (a hard cut is
    // audible). Fades scale with the clip so short pieces aren't all fade.
    const fadeIn = Math.min(1, duration / 8).toFixed(2)
    const fadeOut = Math.min(1.5, duration / 5)
    const out = Math.max(0, duration - fadeOut).toFixed(2)
    chain.push(`[${audioIndex}:a]volume=${gain}dB,afade=t=in:st=0:d=${fadeIn},` +
      `afade=t=out:st=${out}:d=${fadeOut.toFixed(2)}[outa]`)
  }
  return chain.join(';')
}

function renderFormat({ input, video, fmtKey, outFile, duration, pill, titleFile, titleText, bed, gain }) {
  const fmt = FORMATS[fmtKey]
  const lay = layout(fmt, video)
  // Input order decides the filter's stream indices: art, [title pill], [bed].
  const audioIndex = pill ? 2 : 1
  const filter = buildFilter({ ...fmt, lay, pill, titleFile, titleText, audio: !!bed, audioIndex, gain, duration })
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    // The art plays once. Only the still pill and the music loop, bounded by -t.
    '-i', input,
    ...(pill ? ['-loop', '1', '-i', pill.file] : []),
    ...(bed ? ['-stream_loop', '-1', '-i', bed] : []),
    '-filter_complex', filter,
    '-map', '[outv]',
    ...(bed ? ['-map', '[outa]', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'] : ['-an']),
    '-t', String(duration),
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile,
  ]
  const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${fmtKey}`)
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help || (!a.src && !a.title && !a.latest)) {
    process.stdout.write('Usage: node marketing/make-social-assets.mjs [--latest N | --title <substr> | --src <path|url>]\n' +
      '       [--style <text>] [--formats 9x16,2x3] [--duration <sec, trims>]\n' +
      '       [--music-prompt <text> | --audio <file|url>] [--gain -9] [--out <dir>]\n')
    process.exit(a.help ? 0 : 1)
  }
  const unknown = a.formats.filter((f) => !FORMATS[f])
  if (unknown.length) throw new Error(`unknown format(s) ${unknown.join(', ')} (use ${Object.keys(FORMATS).join(', ')})`)

  // Build the work list of { entry-ish, src }.
  let jobs = []
  if (a.src) {
    jobs = [{ title: a.title || path.basename(a.src).replace(/\.[^.]+$/, ''), tags: [], src: a.src }]
  } else {
    const videos = galleryVideos()
    if (a.title) {
      const t = a.title.toLowerCase()
      jobs = videos.filter((e) => (e.title || '').toLowerCase().includes(t))
      if (jobs.length === 0) throw new Error(`no gallery entry title contains "${a.title}"`)
    } else {
      jobs = videos.slice(-a.latest) // newest are appended last
    }
  }

  // Music is written for one artwork, so refuse to apply it to several.
  if (a.musicPrompt && a.audio) throw new Error('pass either --music-prompt or --audio, not both')
  if ((a.musicPrompt || a.audio) && jobs.length > 1) {
    throw new Error(`music is per piece, but ${jobs.length} pieces matched — narrow it with ` +
      `--title <substr> (or --latest 1). The nightly run scores only the piece it posts.`)
  }

  // Get the music before rendering, so a failed call wastes no work.
  const scratch = mkdtempSync(path.join(tmpdir(), 'lart-music-'))
  let bed = null
  try {
    if (a.musicPrompt) {
      process.stdout.write(`Music: generating a bed for this piece…\n  ${a.musicPrompt}\n`)
      bed = generateBed({ prompt: a.musicPrompt, outFile: path.join(scratch, 'bed.mp3') })
    } else if (a.audio) {
      bed = /^https?:\/\//i.test(a.audio) ? await resolveSource(a.audio, scratch) : path.resolve(a.audio)
      if (!existsSync(bed)) throw new Error(`audio not found: ${bed}`)
    }
    if (bed) process.stdout.write(`  ✓ bed ready, mixing at ${a.gain} dB\n`)

    process.stdout.write(`Rendering ${jobs.length} piece(s) → ${a.out}\n`)
    let ok = 0
    for (const entry of jobs) {
      const { title, style } = deriveMeta(entry, a.style)
      const era = entry.tags?.[0] ?? null
      const artwork = artworkOf(entry)
      const slug = assetSlug(title) || 'piece'
      const webSlug = a.src && !entry.date ? null : webSlugForSrc(entry.src)
      const dir = path.join(a.out, slug)
      mkdirSync(dir, { recursive: true })
      const tmp = mkdtempSync(path.join(tmpdir(), 'lart-social-'))
      try {
        process.stdout.write(`• ${title}  [${style}]\n`)
        const input = await resolveSource(entry.src, tmp)
        // --duration can only trim.
        const video = probeVideo(input)
        const sourceDuration = video.duration
        const duration = a.duration ? Math.min(a.duration, sourceDuration) : sourceDuration
        if (a.duration && a.duration > sourceDuration) {
          process.stderr.write(`  ⚠ --duration ${a.duration}s exceeds the source (${sourceDuration.toFixed(1)}s) — using the source length\n`)
        }
        process.stdout.write(`  ${duration.toFixed(1)}s${duration < sourceDuration ? ` (trimmed from ${sourceDuration.toFixed(1)}s)` : ''}\n`)
        const titleText = titleLine(title, style)
        const pill = renderTitlePill(titleText, tmp)
        const titleFile = pill ? null : path.join(tmp, 'title.txt')
        if (titleFile) writeFileSync(titleFile, titleText)
        const formats = {}
        for (const fmtKey of a.formats) {
          const name = `${slug}_${fmtKey}.mp4`
          const outFile = path.join(dir, name)
          renderFormat({ input, video, fmtKey, outFile, duration, pill, titleFile, titleText, bed, gain: a.gain })
          formats[fmtKey] = name
          process.stdout.write(`  ✓ ${path.relative(REPO_ROOT, outFile)} (${(statSync(outFile).size / 1e6).toFixed(1)} MB)\n`)
        }
        writeFileSync(path.join(dir, 'captions.md'), captionsMarkdown({ title, style, era, webSlug, artwork }))
        // The hand-off to post-social.mjs, which never recomputes these (above all `webSlug`).
        writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
          schema: 1,
          assetSlug: slug,
          webSlug,
          title,
          style,
          era,
          artwork,
          galleryTitle: entry.title ?? null,
          src: entry.src,
          date: entry.date ?? null,
          duration: Number(duration.toFixed(3)),
          musicPrompt: a.musicPrompt ?? null,
          formats,
          renderedAt: new Date().toISOString(),
        }, null, 2) + '\n')
        process.stdout.write(`  ✓ ${path.relative(REPO_ROOT, path.join(dir, 'captions.md'))} + meta.json\n`)
        // Keep the prompt, not the MP3.
        if (a.musicPrompt && !a.src) recordMusicPrompt(entry.src, a.musicPrompt)
        ok++
      } catch (err) {
        process.stderr.write(`  ✗ ${title}: ${err.message}\n`)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    }
    process.stdout.write(`Done: ${ok}/${jobs.length} piece(s).\n`)
    if (ok === 0) process.exit(1)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`)
  process.exit(1)
})
