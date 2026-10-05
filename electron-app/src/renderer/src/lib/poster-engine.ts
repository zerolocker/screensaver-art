// Keeps the gallery grid cheap: each card draws its clip's first frame onto a
// <canvas> and then drops the video, so at rest no videos are live. Hundreds of
// live videos would freeze the renderer. A video plays only on hover and in the
// preview. (The `thumb` stills on R2 could replace this if the app read them.)
// A portrait (9:16) clip is never cropped to the 16:9 cell: its poster and hover
// preview show it whole on the dark wall.

import { PORTRAIT_WALL, isPortraitVideo } from '@screensaver-art/constants'

// Max simultaneous captures; the rest queue.
const POSTER_CONCURRENCY = 5
// Capture slightly ahead of the viewport.
const ROOT_MARGIN = '600px'
// After this, draw whatever has decoded (possibly nothing).
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
  return () => observer.unobserve(canvas)
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
