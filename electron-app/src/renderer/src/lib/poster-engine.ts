// Poster-frame engine — keeps the gallery grid cheap to render even with
// hundreds of clips.
//
// The problem: a live <video> element owns a full media pipeline (demuxer +
// decoder + network buffer). Hundreds of them at once freezes the renderer and
// saturates the network. The fix: each grid cell shows a <canvas> holding the
// clip's *first frame*. We load a video once, draw frame 0 onto the canvas, then
// tear the video down — so at rest the page has zero live videos and scrolling
// is as cheap as moving images. Motion only appears on hover (one video, spun up
// on intent and destroyed on leave) and in the detail modal.
//
// This is the client-side approximation of shipping a thumb.jpg per piece; if we
// add real poster images on R2 later, the grid becomes plain <img>s and this
// engine goes away.
//
// A portrait (9:16) clip is never stretched or cropped to the 16:9 cell: both
// the poster and the hover preview show it whole, centred on the dark wall.

import { PORTRAIT_WALL, isPortraitVideo } from '@screensaver-art/constants'

// Cap on simultaneous first-frame captures, so fast scrolling can't stampede the
// network/decoders. Jobs queue and drain as earlier ones finish.
const POSTER_CONCURRENCY = 5
// Capture cells within this margin of the viewport, so a poster is usually ready
// by the time the cell scrolls in.
const ROOT_MARGIN = '600px'
// Give a stuck load this long before drawing whatever (possibly nothing) decoded.
const CAPTURE_TIMEOUT_MS = 12_000

const queue: (() => void)[] = []
let active = 0

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
  const finish = (draw: boolean): void => {
    if (done) return
    done = true
    clearTimeout(timer)
    if (draw) {
      try {
        drawFrame(canvas, video)
        canvas.dataset.ready = '1'
        canvas.dispatchEvent(new CustomEvent('poster:ready'))
      } catch {
        // drawImage can throw if the frame isn't decodable; leave the canvas blank.
      }
    }
    video.removeAttribute('src') // abort the in-flight download
    video.load() // release the decoder
    active--
    pump()
  }

  const timer = setTimeout(() => finish(true), CAPTURE_TIMEOUT_MS)
  video.addEventListener('loadeddata', () => finish(true), { once: true })
  video.addEventListener('error', () => finish(false), { once: true })
}

// A landscape frame fills the canvas as it always has; a portrait one is drawn
// whole (contained), centred on the wall.
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

// Register a canvas for lazy first-frame capture. Returns a cleanup that
// unobserves it (call on unmount).
export function observePoster(canvas: HTMLCanvasElement, src: string): () => void {
  canvas.dataset.src = src
  observer.observe(canvas)
  return () => observer.unobserve(canvas)
}

// Spawn a live, looping, muted preview video layered over a poster — used on
// hover. Returns a teardown that stops the video and releases its pipeline.
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
