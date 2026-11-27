// Gallery card media. A card's poster is its piece's `thumb` still on R2 (see
// PosterCard). This file holds the fallback for a piece with no usable still:
// draw the clip's first frame onto a <canvas>, then drop the video, so at rest
// no videos are live. Hundreds of live videos would freeze the renderer. A
// video plays only on hover and in the preview.
// A portrait (9:16) clip is never cropped to the 16:9 cell: its fallback poster
// and hover preview show it whole on the dark wall.

import { PORTRAIT_WALL, isPortraitVideo } from '@screensaver-art/constants'

// Max simultaneous captures; the rest queue.
const POSTER_CONCURRENCY = 5
// Capture slightly ahead of the viewport.
const ROOT_MARGIN = '600px'
// A capture that hasn't decoded a frame by then gives up and retries later. A
// clip is 10–20 MB, so a slow network can take this long.
const CAPTURE_TIMEOUT_MS = 12_000
// Wait before a failed capture tries again, and give up after this many tries.
const RETRY_DELAY_MS = 5_000
const MAX_ATTEMPTS = 3

const HAVE_CURRENT_DATA = 2

const queue: (() => void)[] = []
let active = 0
// Pending retries, so a card's cleanup can cancel them.
const retryTimers = new WeakMap<HTMLCanvasElement, number>()

function pump(): void {
  while (active < POSTER_CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!
    active++
    job()
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const canvas = entry.target as HTMLCanvasElement
      observer.unobserve(canvas)
      if (canvas.dataset.captured) continue
      canvas.dataset.captured = '1'
      queue.push(() => capturePoster(canvas))
      pump()
    }
  },
  { rootMargin: ROOT_MARGIN },
)

function capturePoster(canvas: HTMLCanvasElement): void {
  const src = canvas.dataset.src
  if (!src) {
    active--
    pump()
    return
  }
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = src

  let done = false
  const finish = (): void => {
    if (done) return
    done = true
    clearTimeout(timer)
    let drawn = false
    if (video.readyState >= HAVE_CURRENT_DATA) {
      try {
        drawFrame(canvas, video)
        drawn = true
      } catch {
        // drawImage can throw if the frame isn't decodable.
      }
    }
    video.removeAttribute('src') // abort the in-flight download
    video.load() // release the decoder
    if (drawn) canvas.dataset.ready = '1'
    else scheduleRetry(canvas)
    active--
    pump()
  }

  const timer = setTimeout(finish, CAPTURE_TIMEOUT_MS)
  video.addEventListener('loadeddata', finish, { once: true })
  video.addEventListener('error', finish, { once: true })
}

// Nothing was drawn: watch the card again after a pause, so it captures the
// next time it's on screen. Never mark a blank card done.
function scheduleRetry(canvas: HTMLCanvasElement): void {
  const attempts = Number(canvas.dataset.attempts ?? 0) + 1
  canvas.dataset.attempts = String(attempts)
  if (attempts >= MAX_ATTEMPTS) return
  const timer = window.setTimeout(() => {
    retryTimers.delete(canvas)
    if (!canvas.isConnected) return
    delete canvas.dataset.captured
    observer.observe(canvas)
  }, RETRY_DELAY_MS)
  retryTimers.set(canvas, timer)
}

// Draw a landscape frame to fill the canvas, a portrait one whole and centred
// on the wall.
function drawFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: cw, height: ch } = canvas
  const { videoWidth: vw, videoHeight: vh } = video
  if (!isPortraitVideo(vw, vh)) {
    ctx.drawImage(video, 0, 0, cw, ch)
    return
  }
  const scale = Math.min(cw / vw, ch / vh)
  const w = vw * scale
  const h = vh * scale
  ctx.fillStyle = PORTRAIT_WALL
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(video, (cw - w) / 2, (ch - h) / 2, w, h)
}

// Capture a canvas's first frame when it nears the viewport. Returns a cleanup.
export function observePoster(canvas: HTMLCanvasElement, src: string): () => void {
  canvas.dataset.src = src
  observer.observe(canvas)
  return () => {
    observer.unobserve(canvas)
    window.clearTimeout(retryTimers.get(canvas))
    retryTimers.delete(canvas)
  }
}

// Play a looping, muted video over a poster on hover. Returns a teardown.
export function spawnPreview(src: string, onPlaying?: () => void): { video: HTMLVideoElement; destroy: () => void } {
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.autoplay = true
  video.src = src
  // Inline style beats the caller's object-cover class. The metadata arrives
  // before any frame, so a portrait preview never shows cropped.
  video.addEventListener(
    'loadedmetadata',
    () => {
      if (!isPortraitVideo(video.videoWidth, video.videoHeight)) return
      video.style.objectFit = 'contain'
      video.style.backgroundColor = PORTRAIT_WALL
    },
    { once: true },
  )
  if (onPlaying) video.addEventListener('playing', onPlaying, { once: true })
  return {
    video,
    destroy: () => {
      video.removeAttribute('src')
      video.load()
      video.remove()
    },
  }
}
