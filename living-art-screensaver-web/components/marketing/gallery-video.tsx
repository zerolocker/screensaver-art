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
 * A gallery clip. These MP4s ship with an audio track, so we force `muted` via a
 * ref (React's `muted` attribute alone is unreliable). Playback is gated on
 * visibility by the shared observer above — no `autoPlay`, so an off-screen clip
 * is never fetched until it scrolls close.
 */
export function AutoVideo({
  src,
  priority = false,
  style,
  className,
  videoKey,
}: {
  src: string
  priority?: boolean
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
      key={videoKey ?? src}
      src={src}
      muted
      loop
      playsInline
      preload={priority ? "auto" : "none"}
      style={style}
      className={className}
    />
  )
}
