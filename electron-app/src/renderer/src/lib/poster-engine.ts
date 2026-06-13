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
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
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
