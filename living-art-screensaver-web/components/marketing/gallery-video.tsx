"use client"

import { useEffect, useRef, type CSSProperties } from "react"

/** One observer for every clip: play those near the viewport, pause the rest. */
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
 * A clip for the collection marquee. It only loads near the viewport, is
 * forced muted (React's `muted` attribute is unreliable), and shows `poster`
 * until it plays. The rotating players use ReelPlayer instead.
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
