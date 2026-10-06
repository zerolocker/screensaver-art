// Omni Lab: a local UI for tuning Gemini Omni settings on real paintings and your own images.
// No npm dependencies. See omni-lab/README.md.
//
//   node omni-lab/server.mjs                # serve on http://localhost:4322 + open the browser
//   node omni-lab/server.mjs a.jpg b.png    # …with these images uploaded and selected
//   node omni-lab/server.mjs --help         # all options
//   NO_OPEN=1 node omni-lab/server.mjs      # don't open the browser (or --no-open)
//   OMNI_PYTHON=/path/to/python3 …          # python with google-genai + Pillow (default: python3)
//   OMNI_CONCURRENCY=10 …                   # parallel Omni calls (default 10)
//
// If a lab already runs on the port, the command hands it the images and opens the
// browser instead of starting a second server.
//
// Each artwork of a run is one detached `python3 omni-lab/job.py` process that owns
// its runs/<id>/<art>/status.json, so jobs keep going across a server restart and
// are re-adopted when it comes back. The server never sees the API key: job.py
// calls the repo's Omni CLI through curation/with-secrets.sh.

import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { platform } from 'node:os'

const USAGE = `Usage: node omni-lab/server.mjs [options] [image ...]

Starts Omni Lab and opens it in the browser. Each image you name is uploaded to
the lab and selected for the next run. If the lab is already running, the images
go to that lab and the browser opens on it. No second server starts.

Options:
  --port <n>   port to serve on (default: $PORT or 4322)
  --no-open    don't open the browser (or NO_OPEN=1)
  -h, --help   show this help

Environment:
  OMNI_PYTHON       python with google-genai + Pillow (default: python3)
  OMNI_CONCURRENCY  parallel Omni calls (default: 10)`

let cli
try {
  cli = parseArgs({ allowPositionals: true, options: { port: { type: 'string' }, 'no-open': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } })
} catch (e) {
  console.error(`${e.message}\n\n${USAGE}`)
  process.exit(2)
}
if (cli.values.help) { console.log(USAGE); process.exit(0) }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const RUNS = path.join(HERE, 'runs')
const PAINT = path.join(HERE, 'paintings')
const UPLOADS = path.join(HERE, 'uploads')
const PREVIEW = path.join(HERE, '.preview')
const JOB = path.join(HERE, 'job.py')
const PORT = Number(cli.values.port || process.env.PORT || 4322)
const NO_OPEN = cli.values['no-open'] || !!process.env.NO_OPEN
const IMAGES = cli.positionals.map((f) => path.resolve(f))
const PY = process.env.OMNI_PYTHON || 'python3'
const CONCURRENCY = Number(process.env.OMNI_CONCURRENCY) || 10
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) { console.error(`bad port: ${cli.values.port || process.env.PORT}`); process.exit(2) }
for (const f of IMAGES) if (!existsSync(f) || !statSync(f).isFile()) { console.error(`no such file: ${f}`); process.exit(2) }
mkdirSync(RUNS, { recursive: true })

const DEFAULTS = {
  prompt: 'Animate this artwork in a single unbroken scene. No camera movements or zooms.\n' +
    'This artwork is titled {title}, by {artist}, completed in the year of {year}.',
  editPrompt: '',
  model: 'gemini-omni-1.1-flash',
  resolution: '1080p',
  aspect: 'auto',
  duration: '',
  seed: '',
  task: 'image_to_video',
  framing: 'raw',
  longEdge: 1920,
  promptOverrides: {},
  artworks: null, // null = all
}
const ENUMS = {
  resolution: ['360p', '720p', '1080p', '4k'],
  aspect: ['auto', '16:9', '9:16'],
  duration: ['', '3', '4', '5', '6', '7', '8', '9', '10'],
  task: ['', 'image_to_video', 'reference_to_video'],
  framing: ['raw', 'crop', 'wall'],
  longEdge: [1280, 1920, 3840],
}
const TERMINAL = new Set(['done', 'failed', 'canceled'])
const RUNNING = new Set(['starting', 'preparing', 'generating', 'editing'])

// ---- small fs helpers -------------------------------------------------------

const readJson = (f, fallback = null) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return fallback } }
function writeJson(f, obj) {
  const tmp = `${f}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`)
  renameSync(tmp, f)
}
const now = () => Date.now() / 1000
const lastLine = (f) => {
  try {
    const lines = readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    return lines[lines.length - 1] || ''
  } catch { return '' }
}

// ---- paintings --------------------------------------------------------------

const paintings = () => readJson(path.join(PAINT, 'paintings.json'), [])
let fetchProc = null

// ---- uploads: your own images, next to the paintings -------------------------
// uploads/{<key>.jpg, <key>_thumb.jpg, uploads.json}, newest first. The key is a hash of
// the bytes, so uploading the same file twice gives back the same artwork.

const UPLOAD_INDEX = path.join(UPLOADS, 'uploads.json')
const UPLOAD_EDGE = 3840 // stored like the paintings: <= the largest input long edge, never upscaled
const MAX_UPLOAD = 500 * 1024 * 1024
const uploads = () => readJson(UPLOAD_INDEX, [])

/** Everything a run can use: uploads (newest first), then the paintings. `dir` is where its files live. */
const artworks = () => [
  ...uploads().map((u) => ({ ...u, dir: 'uploads', upload: true })),
  ...paintings().map((p) => ({ ...p, dir: 'paintings' })),
]

const shapeOf = (a) => a >= 1.7 ? 'very wide' : a >= 1.15 ? 'wide' : a > 0.95 ? 'near-square' : a >= 0.7 ? 'tall' : 'very tall'

// Upright per EXIF, flattened onto the wall colour if transparent, JPEG q95 4:4:4 at <= edge,
// plus a 480px thumb. Reads HEIC too when pillow-heif is installed. Prints {w,h,sw,sh}.
const UPLOAD_PY = `
import sys, json
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass
src, out, thumb, edge = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = ImageOps.exif_transpose(Image.open(src))
if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
    im = im.convert("RGBA")
    bg = Image.new("RGB", im.size, (0x0B, 0x0B, 0x0D))
    bg.paste(im, mask=im.getchannel("A"))
    im = bg
else:
    im = im.convert("RGB")
sw, sh = im.size
if max(im.size) > edge:
    im.thumbnail((edge, edge), Image.LANCZOS)
im.save(out, "JPEG", quality=95, subsampling=0)
t = im.copy(); t.thumbnail((480, 480), Image.LANCZOS); t.save(thumb, "JPEG", quality=85)
print(json.dumps({"w": im.size[0], "h": im.size[1], "sw": sw, "sh": sh}))
`

async function addUpload(buf, name) {
  if (!buf.length) throw new Error('empty upload')
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12)
  const key = `up_${hash}`
  const have = uploads().find((u) => u.key === key)
  if (have && existsSync(path.join(UPLOADS, have.file))) return have
  mkdirSync(UPLOADS, { recursive: true })
  const base = path.basename(name)
  const file = `${key}.jpg`, thumb = `${key}_thumb.jpg`
  const src = path.join(UPLOADS, `${key}.upload`), tmp = path.join(UPLOADS, `${key}.tmp.jpg`)
  writeFileSync(src, buf)
  const r = await runAsync(PY, ['-c', UPLOAD_PY, src, tmp, path.join(UPLOADS, thumb), String(UPLOAD_EDGE)], { cwd: ROOT })
  rmSync(src, { force: true })
  if (r.status !== 0) {
    for (const f of [tmp, path.join(UPLOADS, thumb)]) rmSync(f, { force: true })
    const why = (r.stderr || '').trim().split('\n').pop()
    throw new Error(`bad image ${base}: ${/cannot identify image/.test(why)
      ? `Pillow can't read this format${/\.hei[cf]$/i.test(base) ? ' (for HEIC: pip install pillow-heif)' : ''}` : why}`)
  }
  renameSync(tmp, path.join(UPLOADS, file))
  const d = JSON.parse(r.stdout.trim().split('\n').pop())
  const aspect = Math.round((d.w / d.h) * 1000) / 1000
  const u = {
    id: `up:${hash}`, key, file, thumb,
    title: base.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'untitled', artist: '', year: '', date: '',
    original_name: base, width: d.w, height: d.h, source_width: d.sw, source_height: d.sh,
    aspect, shape: shapeOf(aspect), uploadedAt: new Date().toISOString(),
  }
  writeJson(UPLOAD_INDEX, [u, ...uploads().filter((x) => x.key !== key)])
  console.log(`upload ${key}: ${base} ${d.sw}×${d.sh} -> ${d.w}×${d.h} (${u.shape})`)
  return u
}

/** Title, artist and year fill the prompt's placeholders ({date} = the year). */
function editUpload(key, body) {
  const list = uploads()
  const u = list.find((x) => x.key === key)
  if (!u) throw new Error('unknown upload')
  for (const k of ['title', 'artist', 'year']) if (k in body) u[k] = String(body[k] ?? '').trim()
  u.date = u.year
  writeJson(UPLOAD_INDEX, list)
  return u
}

/** Past runs keep their own input.jpg and videos; only a retry of one would need the file. */
function removeUpload(key) {
  const list = uploads()
  const u = list.find((x) => x.key === key)
  if (!u) throw new Error('unknown upload')
  writeJson(UPLOAD_INDEX, list.filter((x) => x !== u))
  for (const f of [u.file, u.thumb]) rmSync(path.join(UPLOADS, f), { force: true })
  if (existsSync(PREVIEW)) for (const d of readdirSync(PREVIEW)) if (d.startsWith(`${key}-`)) rmSync(path.join(PREVIEW, d), { recursive: true, force: true })
}

// ---- config -----------------------------------------------------------------

function cleanConfig(raw = {}) {
  // Only known keys, so a config loaded from an old run can't smuggle removed options back in.
  const c = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, raw[k] ?? DEFAULTS[k]]))
  for (const [k, vals] of Object.entries(ENUMS)) {
    const v = typeof vals[0] === 'number' ? Number(c[k]) : String(c[k] ?? '')
    if (!vals.includes(v)) throw new Error(`bad ${k}: ${JSON.stringify(c[k])} (allowed: ${vals.join(', ')})`)
    c[k] = v
  }
  c.prompt = String(c.prompt || '').trim()
  if (!c.prompt) throw new Error('the prompt is empty')
  c.editPrompt = String(c.editPrompt || '').trim()
  c.model = String(c.model || DEFAULTS.model).trim()
  if (!/^[\w.\-/]+$/.test(c.model)) throw new Error('bad model id')
  c.seed = c.seed === '' || c.seed == null ? '' : Number(c.seed)
  if (c.seed !== '' && !Number.isInteger(c.seed)) throw new Error('seed must be an integer')
  const ids = new Set(artworks().map((p) => p.id))
  c.promptOverrides = Object.fromEntries(Object.entries(c.promptOverrides || {})
    .map(([k, v]) => [k, String(v || '').trim()]).filter(([k, v]) => ids.has(k) && v))
  c.artworks = Array.isArray(c.artworks) ? c.artworks.filter((a) => ids.has(a)) : [...ids]
  return c
}

const aspectFor = (c, p) => c.aspect !== 'auto' ? c.aspect : p.width > p.height ? '16:9' : '9:16'

const promptFor = (c, p) => (c.promptOverrides[p.id] || c.prompt)
  .replaceAll('{title}', p.short_title || p.title).replaceAll('{artist}', p.artist || '')
  .replaceAll('{year}', p.year || '').replaceAll('{date}', p.date || '')

function itemFor(c, p) {
  return {
    artId: p.id, key: p.key, title: p.short_title || p.title || p.original_name, artist: p.artist, year: p.year,
    paintingPath: path.join(HERE, p.dir, p.file), paintingSize: [p.width, p.height],
    prompt: promptFor(c, p), editPrompt: c.editPrompt, model: c.model, resolution: c.resolution,
    aspect: aspectFor(c, p), duration: c.duration, seed: c.seed, task: c.task,
    framing: c.framing, longEdge: c.longEdge,
  }
}

// ---- runs on disk -----------------------------------------------------------
// runs/<id>/config.json  {id, createdAt, config, items: [keys]}   (immutable)
// runs/<id>/meta.json    {note, ratings: {"<key>/video": "up"}}  (notes + 👍/👎)
// runs/<id>/<key>/{item.json, status.json, log.txt, input.jpg, video.mp4(.json), edit.mp4(.json)}

const runIds = () => existsSync(RUNS)
  ? readdirSync(RUNS).filter((d) => existsSync(path.join(RUNS, d, 'config.json'))).sort().reverse()
  : []
const itemDir = (id, key) => path.join(RUNS, id, key)
const statusOf = (id, key) => readJson(path.join(itemDir(id, key), 'status.json'), { status: 'failed', error: 'missing status.json' })
const setStatus = (id, key, s) => writeJson(path.join(itemDir(id, key), 'status.json'), s)

function runView(id) {
  const cfg = readJson(path.join(RUNS, id, 'config.json'))
  if (!cfg) return null
  const meta = readJson(path.join(RUNS, id, 'meta.json'), {})
  const items = cfg.items.map((key) => {
    const it = readJson(path.join(itemDir(id, key), 'item.json'), {})
    const st = statusOf(id, key)
    return { key, artId: it.artId, title: it.title, artist: it.artist, year: it.year, aspect: it.aspect,
      prompt: it.prompt, editPrompt: it.editPrompt, ...st, pid: undefined }
  })
  return { id, createdAt: cfg.createdAt, config: cfg.config, note: meta.note || '', ratings: meta.ratings || {}, items }
}

function createRun(config) {
  const c = cleanConfig(config)
  if (!c.artworks.length) throw new Error('no artworks selected')
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const id = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${randomBytes(2).toString('hex')}`
  const byId = new Map(artworks().map((p) => [p.id, p]))
  const sel = c.artworks.map((a) => byId.get(a))
  mkdirSync(path.join(RUNS, id))
  for (const p of sel) {
    mkdirSync(itemDir(id, p.key))
    writeJson(path.join(itemDir(id, p.key), 'item.json'), itemFor(c, p))
    setStatus(id, p.key, { status: 'queued', queuedAt: now() })
  }
  writeJson(path.join(RUNS, id, 'meta.json'), { note: '', ratings: {} })
  writeJson(path.join(RUNS, id, 'config.json'), { id, createdAt: new Date().toISOString(), config: c, items: sel.map((p) => p.key) })
  for (const p of sel) queue.push({ id, key: p.key })
  console.log(`run ${id}: ${sel.length} artworks queued (${c.resolution}, ${c.framing}, ${c.aspect})`)
  pump()
  return id
}

// ---- the job queue ----------------------------------------------------------

const queue = [] // [{id, key}]
const active = new Map() // "id/key" -> {pid}

function pump() {
  while (active.size < CONCURRENCY && queue.length) {
    const { id, key } = queue.shift()
    const st = statusOf(id, key)
    if (st.status !== 'queued') continue // canceled/retried meanwhile
    start(id, key)
  }
}

function start(id, key) {
  const dir = itemDir(id, key)
  const prev = statusOf(id, key)
  const fd = openSync(path.join(dir, 'log.txt'), 'a')
  let child
  try {
    // Detached + stdio to a file: the job survives a server restart / Ctrl+C.
    child = spawn(PY, [JOB, path.join(RUNS, id), key], { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd] })
  } finally {
    closeSync(fd)
  }
  const k = `${id}/${key}`
  // Written before python has started, so a restart in this window re-adopts rather than re-queues.
  setStatus(id, key, { queuedAt: prev.queuedAt, attempt: prev.attempt, status: 'starting', pid: child.pid, startedAt: now() })
  active.set(k, { pid: child.pid })
  child.on('error', (e) => { finish(id, key, `could not start ${PY}: ${e.message}`) })
  child.on('exit', (code, sig) => finish(id, key, `job exited unexpectedly (${sig || `code ${code}`})`))
  child.unref()
}

/** A job process is gone: make sure its status is terminal, then start the next one. */
function finish(id, key, why) {
  const k = `${id}/${key}`
  if (!active.has(k)) return
  active.delete(k)
  if (existsSync(itemDir(id, key))) {
    const st = statusOf(id, key)
    if (!TERMINAL.has(st.status)) {
      const last = lastLine(path.join(itemDir(id, key), 'log.txt'))
      setStatus(id, key, { ...st, status: 'failed', errorKind: 'error', error: last ? `${why}: ${last}` : why, finishedAt: now() })
    }
  }
  pump()
}

function alive(pid) {
  try { process.kill(pid, 0) } catch (e) { if (e.code !== 'EPERM') return false }
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.includes('job.py')
}

/** On startup: re-adopt jobs still running from before, fail the dead ones, re-queue the queued ones. */
function recover() {
  let adopted = 0, requeued = 0, lost = 0
  for (const id of [...runIds()].reverse()) { // oldest first
    const cfg = readJson(path.join(RUNS, id, 'config.json'))
    for (const key of cfg?.items || []) {
      const st = statusOf(id, key)
      if (st.status === 'queued') { queue.push({ id, key }); requeued++ }
      else if (RUNNING.has(st.status)) {
        if (st.pid && alive(st.pid)) { active.set(`${id}/${key}`, { pid: st.pid, adopted: true }); adopted++ }
        else {
          const last = lastLine(path.join(itemDir(id, key), 'log.txt'))
          setStatus(id, key, { ...st, status: 'failed', errorKind: 'error', error: `interrupted (job died while the server was down)${last ? `: ${last}` : ''}`, finishedAt: now() })
          lost++
        }
      }
    }
  }
  if (adopted || requeued || lost) console.log(`recovered: ${adopted} running job(s) re-adopted, ${requeued} re-queued, ${lost} marked interrupted`)
  pump()
}

// Adopted jobs aren't our children: poll them.
setInterval(() => {
  for (const [k, a] of active) {
    if (a.adopted && !alive(a.pid)) {
      const [id, key] = k.split('/')
      finish(id, key, 'job exited')
    }
  }
}, 3000).unref()

function cancelRun(id) {
  const cfg = readJson(path.join(RUNS, id, 'config.json'))
  if (!cfg) throw new Error('no such run')
  let n = 0
  for (const key of cfg.items) {
    const st = statusOf(id, key)
    if (TERMINAL.has(st.status)) continue
    const a = active.get(`${id}/${key}`)
    if (a) { try { process.kill(-a.pid, 'SIGTERM') } catch { try { process.kill(a.pid, 'SIGTERM') } catch {} } }
    setStatus(id, key, { ...st, status: 'canceled', error: 'canceled', finishedAt: now() })
    n++
  }
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].id === id) queue.splice(i, 1)
  return n
}

function retryRun(id) {
  const cfg = readJson(path.join(RUNS, id, 'config.json'))
  if (!cfg) throw new Error('no such run')
  let n = 0
  for (const key of cfg.items) {
    const st = statusOf(id, key)
    if (!(st.status === 'failed' || st.status === 'canceled')) continue
    for (const f of ['video.mp4', 'video.mp4.json', 'edit.mp4', 'edit.mp4.json', 'input.jpg']) rmSync(path.join(itemDir(id, key), f), { force: true })
    writeFileSync(path.join(itemDir(id, key), 'log.txt'), `\n---- retry ${new Date().toISOString()} ----\n`, { flag: 'a' })
    setStatus(id, key, { status: 'queued', queuedAt: now(), attempt: (st.attempt || 1) + 1 })
    queue.push({ id, key })
    n++
  }
  pump()
  return n
}

// ---- input preview (pre-processing only, no Omni call) ----------------------

function runAsync(cmd, args, opts) {
  return new Promise((resolve) => {
    const ch = spawn(cmd, args, opts)
    let stdout = '', stderr = ''
    ch.stdout.on('data', (d) => { stdout += d })
    ch.stderr.on('data', (d) => { stderr += d })
    ch.on('error', (e) => resolve({ status: -1, stdout, stderr: e.message }))
    ch.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

async function preview(config, artId) {
  const c = cleanConfig({ ...config, artworks: [artId] })
  const p = artworks().find((x) => x.id === artId)
  if (!p) throw new Error('unknown artwork')
  const item = itemFor(c, p)
  const prepKeys = ['paintingPath', 'aspect', 'framing', 'longEdge']
  const hash = createHash('sha1').update(JSON.stringify(prepKeys.map((k) => item[k]))).digest('hex').slice(0, 10)
  const dir = path.join(PREVIEW, `${p.key}-${hash}`)
  mkdirSync(dir, { recursive: true })
  writeJson(path.join(dir, 'item.json'), item)
  let info = readJson(path.join(dir, 'info.json'))
  if (!info || !existsSync(path.join(dir, 'input.jpg'))) {
    const r = await runAsync(PY, [JOB, PREVIEW, path.basename(dir), '--prep-only'], { cwd: ROOT })
    if (r.status !== 0) throw new Error(`pre-processing failed: ${(r.stderr || '').trim().split('\n').pop()}`)
    info = JSON.parse(r.stdout.trim().split('\n').pop())
    writeJson(path.join(dir, 'info.json'), info)
  }
  return { url: `/files/.preview/${path.basename(dir)}/input.jpg`, info, aspect: item.aspect, prompt: item.prompt }
}

// ---- http -------------------------------------------------------------------

const noCache = { 'Cache-Control': 'no-store' }
function send(res, status, body, headers = {}) { res.writeHead(status, headers); res.end(body) }
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json', ...noCache })
async function readRaw(req, limit = 10 * 1024 * 1024) {
  const chunks = []
  let n = 0
  for await (const c of req) {
    if ((n += c.length) > limit) throw new Error(`bad upload: over ${Math.round(limit / 1048576)} MB`)
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}
async function readBody(req) {
  const s = (await readRaw(req)).toString('utf8')
  return s ? JSON.parse(s) : {}
}

const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8' }

/** Static files under runs/, paintings/, uploads/ and .preview/, with HTTP Range (video seeking). */
function serveFile(req, res, rel) {
  const abs = path.resolve(HERE, rel)
  const okRoot = [RUNS, PAINT, UPLOADS, PREVIEW].some((r) => abs.startsWith(r + path.sep))
  if (!okRoot || !existsSync(abs) || !statSync(abs).isFile()) return sendJson(res, 404, { error: 'not found' })
  const size = statSync(abs).size
  const type = TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream'
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'Last-Modified': statSync(abs).mtime.toUTCString() }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) return send(res, 416, '', { 'Content-Range': `bytes */${size}` })
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(abs, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...base, 'Content-Length': size })
  if (req.method === 'HEAD') return res.end()
  createReadStream(abs).pipe(res)
}

let pythonOk = null
function checkPython() {
  const r = spawnSync(PY, ['-c', 'import PIL, google.genai, sys; print(sys.executable)'], { encoding: 'utf8' })
  pythonOk = r.status === 0 ? { ok: true, exe: r.stdout.trim() } : { ok: false, error: (r.stderr || r.error?.message || '').trim().split('\n').pop() }
  if (!pythonOk.ok) console.warn(`\n  !! ${PY} can't import PIL + google.genai (${pythonOk.error}).\n     Set OMNI_PYTHON to a python that has them.\n`)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const p = decodeURIComponent(url.pathname)
    const M = req.method

    if (M === 'GET' && (p === '/' || p === '/index.html')) {
      return send(res, 200, readFileSync(path.join(HERE, 'index.html')), { 'Content-Type': 'text/html; charset=utf-8', ...noCache })
    }
    if ((M === 'GET' || M === 'HEAD') && p.startsWith('/files/')) return serveFile(req, res, p.slice('/files/'.length))

    if (M === 'GET' && p === '/api/state') {
      return sendJson(res, 200, {
        defaults: DEFAULTS, enums: ENUMS, paintings: artworks(), runs: runIds().map(runView).filter(Boolean),
        active: active.size, queued: queue.length, concurrency: CONCURRENCY, python: pythonOk, fetching: !!fetchProc,
      })
    }
    if (M === 'GET' && p === '/api/ping') return sendJson(res, 200, { omniLab: true })
    if (M === 'GET' && p === '/api/runs') return sendJson(res, 200, runIds().map(runView).filter(Boolean))
    let m
    if (M === 'POST' && p === '/api/uploads') {
      // The raw file is the body (no multipart): the browser and the CLI both send it as is.
      return sendJson(res, 200, await addUpload(await readRaw(req, MAX_UPLOAD), url.searchParams.get('name') || 'upload'))
    }
    if ((m = p.match(/^\/api\/uploads\/(up_[0-9a-f]+)$/))) {
      if (M === 'POST') return sendJson(res, 200, editUpload(m[1], await readBody(req)))
      if (M === 'DELETE') { removeUpload(m[1]); return sendJson(res, 200, { ok: true }) }
    }
    if (M === 'GET' && (m = p.match(/^\/api\/runs\/([\w-]+)$/))) {
      const v = runView(m[1])
      return v ? sendJson(res, 200, v) : sendJson(res, 404, { error: 'no such run' })
    }
    if (M === 'POST' && p === '/api/runs') {
      const body = await readBody(req)
      return sendJson(res, 200, { id: createRun(body.config || body) })
    }
    if (M === 'POST' && p === '/api/preview') {
      const body = await readBody(req)
      return sendJson(res, 200, await preview(body.config, body.artId))
    }
    if (M === 'POST' && p === '/api/paintings/fetch') {
      if (!fetchProc) {
        mkdirSync(PAINT, { recursive: true })
        const fd = openSync(path.join(PAINT, 'fetch.log'), 'a')
        fetchProc = spawn(process.execPath, [path.join(HERE, 'fetch-paintings.mjs')], { cwd: ROOT, stdio: ['ignore', fd, fd], env: { ...process.env, OMNI_PYTHON: PY } })
        closeSync(fd)
        fetchProc.on('exit', () => { fetchProc = null })
      }
      return sendJson(res, 200, { ok: true })
    }
    if ((m = p.match(/^\/api\/runs\/([\w-]+)(?:\/(note|rate|cancel|retry))?$/)) && existsSync(path.join(RUNS, m[1], 'config.json'))) {
      const [, id, action] = m
      const metaF = path.join(RUNS, id, 'meta.json')
      if (M === 'POST' && action === 'note') {
        const { note } = await readBody(req)
        writeJson(metaF, { ...readJson(metaF, {}), note: String(note ?? '') })
        return sendJson(res, 200, { ok: true })
      }
      if (M === 'POST' && action === 'rate') {
        const { key, which = 'video', value } = await readBody(req)
        const meta = readJson(metaF, {})
        const ratings = { ...(meta.ratings || {}) }
        if (value === 'up' || value === 'down') ratings[`${key}/${which}`] = value
        else delete ratings[`${key}/${which}`]
        writeJson(metaF, { ...meta, ratings })
        return sendJson(res, 200, { ok: true, ratings })
      }
      if (M === 'POST' && action === 'cancel') return sendJson(res, 200, { canceled: cancelRun(id) })
      if (M === 'POST' && action === 'retry') return sendJson(res, 200, { retried: retryRun(id) })
      if (M === 'DELETE' && !action) {
        cancelRun(id)
        rmSync(path.join(RUNS, id), { recursive: true, force: true })
        return sendJson(res, 200, { ok: true })
      }
    }
    return sendJson(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(err)
    return sendJson(res, err instanceof SyntaxError || /^bad |empty|must|no artworks|unknown/.test(err.message) ? 400 : 500, { error: String(err?.message || err) })
  }
})

// ---- start ------------------------------------------------------------------

const LINK = `http://localhost:${PORT}`
/** The page selects exactly these artworks when opened with ?select=. */
const pageUrl = (ids) => ids.length ? `${LINK}/?select=${ids.map(encodeURIComponent).join(',')}` : LINK

function openBrowser(url) {
  if (NO_OPEN) { if (url !== LINK) console.log(`  Open ${url} to see them selected.\n`); return }
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform() === 'win32' ? ['/c', 'start', '', url] : [url]
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref() } catch {}
}

async function labRunning() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/ping`, { signal: AbortSignal.timeout(2000) })
    return (await r.json()).omniLab === true
  } catch { return false }
}

if (await labRunning()) {
  // Hand the images to the running lab: a second server would also run a second job queue.
  const ids = []
  for (const f of IMAGES) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/uploads?name=${encodeURIComponent(path.basename(f))}`, { method: 'POST', body: readFileSync(f) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      ids.push(j.id)
      console.log(`  + ${path.basename(f)}`)
    } catch (e) { console.error(`  !! ${path.basename(f)}: ${e.message}`) }
  }
  console.log(`\n  Omni Lab is already running at ${LINK}${IMAGES.length ? `; added ${ids.length} of ${IMAGES.length} image(s) to it` : ''}.\n`)
  openBrowser(pageUrl(ids))
  process.exit(ids.length === IMAGES.length ? 0 : 1)
}

checkPython()
const added = []
for (const f of IMAGES) {
  try { added.push((await addUpload(readFileSync(f), f)).id) } catch (e) { console.error(`  !! ${path.basename(f)}: ${e.message}`) }
}
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e
  console.error(`\n  !! Port ${PORT} is in use by another program, or by an Omni Lab started before this version.\n     Stop it, or pick another port with --port.\n`)
  process.exit(1)
})
server.listen(PORT, '127.0.0.1', () => {
  recover() // only once the port is ours, so a second copy can't start the same queued jobs
  console.log(`\n  Omni Lab running at ${LINK}  (python: ${pythonOk?.ok ? pythonOk.exe : 'NOT OK'}, ${CONCURRENCY} concurrent)`)
  console.log(`  Runs are kept in ${path.relative(ROOT, RUNS)}/, uploads in ${path.relative(ROOT, UPLOADS)}/. Ctrl+C stops the server; running jobs finish in the background.\n`)
  openBrowser(pageUrl(added))
})
