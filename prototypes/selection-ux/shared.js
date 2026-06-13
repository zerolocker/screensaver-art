/* Shared helpers for the selection-UX prototypes. Plain script, exposes globals. */

const FREE_COUNT = 100 // default selection = first 100 items
const EST_MB_PER_CLIP = 12 // rough average, for the cache-size estimate

async function loadGallery() {
  const res = await fetch('../../gallery.json')
  if (!res.ok) throw new Error(`Failed to load gallery.json (HTTP ${res.status})`)
  const raw = await res.json()
  return raw.map((it, i) => {
    const title = it.title.replace(/\s*\(AI Animated\)\s*$/i, '')
    return {
      id: i,
      src: it.src,
      title,
      date: it.date || null,
      style: styleOf(title),
    }
  })
}

/* ---------- style buckets ----------
   Derived from title keywords for prototyping. In the real product this
   would be a `style` field on each gallery.json entry. */
const STYLE_ORDER = [
  'Ancient',
  'Asia',
  'Americas',
  'Medieval',
  'Renaissance & Baroque',
  '19th Century',
  'Modern',
  'Sci-Fi & Future',
  'Digital & Fantasy',
]

const STYLE_RULES = [
  ['Sci-Fi & Future', ['cyberpunk', 'cyber-gothic', 'steampunk', 'dieselpunk', 'solarpunk', 'biopunk', 'retro-futurism', 'synthwave', 'vaporwave', 'y2k', 'neo-tokyo', 'frutiger', 'cosmic', 'biomechanical']],
  ['Digital & Fantasy', ['pixel art', 'voxel', 'low poly', 'isometric', 'glitch', 'fractal', 'psychedelic', 'acid graphics', 'liminal', 'dark academia', 'dark fantasy', 'dungeon synth', 'noir', 'ghibli', 'whimsical', 'papercut', 'biomorphic']],
  ['Ancient', ['megalithic', 'paleolithic', 'neolithic', 'sumerian', 'mesopotamian', 'assyrian', 'achaemenid', 'sasanian', 'egyptian', 'amarna', 'fayum', 'nabataean', 'cycladic', 'minoan', 'mycenaean', 'hellenistic', 'macedonian', 'etruscan', 'iberian', 'scythian', 'bactrian', 'cuneiform']],
  ['Asia', ['ukiyo-e', 'edo', 'jomon', 'kofun', 'netsuke', 'kamakura', 'kano school', 'sumi-e', 'nanga', 'tang dynasty', 'song dynasty', 'ming dynasty', 'yuan dynasty', 'han dynasty', 'goryeo', 'joseon', 'chola', 'gandharan', 'gupta', 'mughal', 'gond', 'dong son', 'xiongnu', 'minhwa', 'byobu', 'sancai', 'haniwa']],
  ['Americas', ['maya', 'aztec', 'inca', 'nazca', 'moche', 'olmec', 'teotihuacan', 'mississippian', 'mogollon', 'anasazi']],
  ['Medieval', ['gothic', 'byzantine', 'romanesque', 'carolingian', 'ottonian', 'viking', 'runestone', 'celtic', 'anglo-saxon', 'illuminated manuscript', 'coptic', 'fatimid', 'medieval']],
  ['Renaissance & Baroque', ['renaissance', 'sienese', 'mannerism', 'baroque', 'tenebrism', 'chiaroscuro', 'caravaggism', 'rococo', 'dutch golden age', 'flemish', 'netherlandish', 'bosch', 'fresco', 'tudor', 'trompe']],
  ['19th Century', ['impressioni', 'pointillism', 'romanticism', 'hudson river', 'barbizon', 'pre-raphaelite', 'macchiaioli', 'ashcan', 'tonalism', 'symbolism', 'cloisonnism', 'art nouveau', 'neoclassicism', 'arts and crafts', 'watercolor']],
  ['Modern', ['abstract expressionism', 'cubism', 'fauvism', 'surreal', 'de stijl', 'bauhaus', 'constructivism', 'suprematism', 'art deco', 'mid-century', 'memphis', 'minimalism', 'brutalis', 'pop art', 'modernist']],
]

function styleOf(title) {
  const t = title.toLowerCase()
  for (const [name, keywords] of STYLE_RULES) {
    if (keywords.some((k) => t.includes(k))) return name
  }
  return 'Other'
}

function defaultIds(items) {
  return items.slice(0, FREE_COUNT).map((it) => it.id)
}

/* Lazy videos: src is only attached once the card scrolls near the viewport,
   so a 182-item grid doesn't fetch 182 files up front. */
const _videoObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !e.target.src) e.target.src = e.target.dataset.src
    }
  },
  { rootMargin: '300px' },
)

function makeVideo(item) {
  const v = document.createElement('video')
  v.muted = true
  v.loop = true
  v.playsInline = true
  v.preload = 'metadata'
  v.dataset.src = item.src
  _videoObserver.observe(v)
  return v
}

function hoverPlay(container, video) {
  container.addEventListener('mouseenter', () => video.play().catch(() => {}))
  container.addEventListener('mouseleave', () => {
    video.pause()
    video.currentTime = 0
  })
}

function estSize(count) {
  const mb = count * EST_MB_PER_CLIP
  return mb >= 1000 ? `~${(mb / 1000).toFixed(1)} GB` : `~${mb} MB`
}

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveState(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

let _toastTimer
function toast(msg) {
  let t = document.querySelector('.toast')
  if (!t) {
    t = document.createElement('div')
    t.className = 'toast'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600)
}

/* mulberry32 — tiny seeded PRNG so "Surprise me" mixes are stable until reshuffled */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(arr, seed) {
  const rand = mulberry32(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------- poster-frame engine (round 2) ----------
   Instead of keeping a live <video> per grid cell (one media pipeline each),
   capture the first frame onto a <canvas> once, then tear the video down.
   Scrolling then only moves plain canvases. A concurrency-capped queue keeps
   fast scrolling from stampeding the network/decoders. Stands in for real
   poster images (thumb.jpg per piece) in production. */

const POSTER_CONCURRENCY = 5
const _posterQueue = []
let _postersActive = 0
let _liveVideoCount = 0 // live <video> elements right now (hover previews + captures)

function _pumpPosters() {
  while (_postersActive < POSTER_CONCURRENCY && _posterQueue.length) {
    const job = _posterQueue.shift()
    _postersActive++
    job(() => {
      _postersActive--
      _pumpPosters()
    })
  }
}

const _posterObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      _posterObserver.unobserve(e.target)
      _posterQueue.push((done) => _capturePoster(e.target, done))
      _pumpPosters()
    }
  },
  { rootMargin: '500px' },
)

function makePosterCanvas(item) {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 270
  canvas.className = 'poster'
  canvas.dataset.src = item.src
  _posterObserver.observe(canvas)
  return canvas
}

function _capturePoster(canvas, done) {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = canvas.dataset.src
  _liveVideoCount++
  let finished = false
  const finish = (draw) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    if (draw) {
      try {
        canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
        canvas.classList.add('ready')
      } catch {}
    }
    v.removeAttribute('src') // release the decoder + abort the download
    v.load()
    _liveVideoCount--
    done()
  }
  v.addEventListener('loadeddata', () => finish(true), { once: true })
  v.addEventListener('error', () => finish(false), { once: true })
  const timer = setTimeout(() => finish(true), 12000)
}

/* Live video only on intent: spawn it after a short hover delay, destroy on leave. */
function attachHoverPreview(card, item, delay = 220) {
  let timer = null
  let live = null
  card.addEventListener('mouseenter', () => {
    timer = setTimeout(() => {
      live = document.createElement('video')
      live.className = 'hoverlayer'
      live.muted = true
      live.loop = true
      live.playsInline = true
      live.autoplay = true
      live.src = item.src
      live.addEventListener('playing', () => live && live.classList.add('show'), { once: true })
      card.appendChild(live)
      _liveVideoCount++
    }, delay)
  })
  card.addEventListener('mouseleave', () => {
    clearTimeout(timer)
    if (live) {
      live.removeAttribute('src')
      live.load()
      live.remove()
      live = null
      _liveVideoCount--
    }
  })
}

/* ---------- detail modal (round 2) ---------- */
function openArtModal(item, opts = {}) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  const modal = document.createElement('div')
  modal.className = 'modal'

  const v = document.createElement('video')
  v.src = item.src
  v.autoplay = true
  v.loop = true
  v.muted = true
  v.playsInline = true

  const info = document.createElement('div')
  info.className = 'info'
  const meta = document.createElement('div')
  meta.className = 'meta'
  const h3 = document.createElement('h3')
  h3.textContent = item.title
  const sub = document.createElement('div')
  sub.className = 'sub2'
  const dateStr = item.date
    ? new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  sub.textContent = [item.style, dateStr ? `Added ${dateStr}` : null].filter(Boolean).join('  ·  ')
  meta.append(h3, sub)
  info.appendChild(meta)

  if (opts.isSelected && opts.onToggle) {
    const btn = document.createElement('button')
    const paint = () => {
      const on = opts.isSelected()
      btn.className = on ? 'btn' : 'btn primary'
      btn.textContent = on ? '✓ In your screensaver — remove' : 'Add to screensaver'
    }
    btn.addEventListener('click', () => {
      opts.onToggle()
      paint()
    })
    paint()
    info.appendChild(btn)
  }

  const close = document.createElement('button')
  close.className = 'iconbtn close'
  close.innerHTML = ICONS.x
  const teardown = () => {
    v.removeAttribute('src')
    v.load()
    overlay.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e) => {
    if (e.key === 'Escape') teardown()
  }
  close.addEventListener('click', teardown)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) teardown()
  })
  document.addEventListener('keydown', onKey)

  modal.append(v, info, close)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
}

const ICONS = {
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.04 3 5.5l7 7Z"/></svg>',
  heartFill:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.04 3 5.5l7 7Z"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
  rotate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>',
}
