"use client"

import { useEffect, useRef, type CSSProperties } from "react"

/**
 * One shared observer for every gallery clip: play the ones near the viewport,
 * pause the rest. This keeps a video-heavy page from fetching and decoding
 * dozens of clips at once, without polling the DOM or scanning globally.
 */
let sharedObserver: IntersectionObserver | null = null

function galleryObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement
          if (entry.isIntersecting) {
            if (video.dataset.still === "true") {
              // "Still" clips (e.g. picker thumbnails): load a first frame to
              // paint, then never play. This guarantees no continuous decode of
              // ~6 looping tiles (the main CPU/battery + contention win); how
              // much actually downloads is up to the browser (Chromium may pull
              // the whole short clip, Safari far less). Promote from
              // preload="none" only once the tile scrolls near.
              if (video.readyState < 2 /* HAVE_CURRENT_DATA */) {
                video.preload = "metadata"
                video.load()
              }
            } else {
              video.muted = true
              video.play().catch(() => {})
            }
          } else if (video.dataset.still !== "true") {
            video.pause()
          }
        }
      },
      { rootMargin: "300px 0px" },
    )
  }
  return sharedObserver
}

/**
 * A gallery clip. These MP4s ship with an audio track, so we force `muted` via a
 * ref (React's `muted` attribute alone is unreliable). Playback is gated on
 * visibility by the shared observer above — no `autoPlay`, so an off-screen clip
 * is never fetched until it scrolls close.
 *
 * Pass `still` for a poster-style tile: the clip loads a first frame to paint
 * and never plays. A grid of these avoids continuously decoding several loops at
 * once, so they don't starve the featured clip on slow mobile links. (How much
 * each tile downloads is browser-dependent — the guaranteed win is no looping
 * playback, not a fixed byte count; for hard byte guarantees use a real image.)
 */
export function AutoVideo({
  src,
  priority = false,
  still = false,
  style,
  className,
  videoKey,
}: {
  src: string
  priority?: boolean
  still?: boolean
  style?: CSSProperties
  className?: string
  videoKey?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    const io = galleryObserver()
    if (!io) {
      // No IntersectionObserver available — paint a frame (still) or just play.
      if (still) video.load()
      else video.play().catch(() => {})
      return
    }
    io.observe(video)
    return () => io.unobserve(video)
  }, [src, still])

  return (
    <video
      ref={ref}
      key={videoKey ?? src}
      src={src}
      data-still={still ? "true" : undefined}
      muted
      loop={!still}
      playsInline
      preload={priority ? "auto" : "none"}
      style={style}
      className={className}
    />
  )
}
