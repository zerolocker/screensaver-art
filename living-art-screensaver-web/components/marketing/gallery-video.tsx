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
            video.muted = true
            video.play().catch(() => {})
          } else {
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
 * A gallery clip (used by the collection marquee tiles). These MP4s ship with
 * an audio track, so we force `muted` via a ref (React's `muted` attribute
 * alone is unreliable). Playback is gated on visibility by the shared observer
 * above — no `autoPlay`, so an off-screen clip is never fetched until it
 * scrolls close. Pass a `poster` (see lib/gallery-showcase.ts `posterImage`)
 * so real art paints before the clip buffers.
 *
 * The featured players (hero/CTA Monitors, art-styles) don't use this — they
 * need readiness-gated rotation and use ReelPlayer instead.
 */
export function AutoVideo({
  src,
  poster,
  style,
  className,
}: {
  src: string
  poster?: string
  style?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    const io = galleryObserver()
    if (!io) {
      // No IntersectionObserver available — just play.
      video.play().catch(() => {})
      return
    }
    io.observe(video)
    return () => io.unobserve(video)
  }, [src])

  return (
    <video
      ref={ref}
      key={src}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      style={style}
      className={className}
    />
  )
}
