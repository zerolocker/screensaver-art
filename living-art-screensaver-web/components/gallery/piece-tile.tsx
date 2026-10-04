'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogPiece } from '@/lib/gallery-catalog'

/**
 * Clips are ~9 MB each, and visitors are mostly on phones, so tiles are careful
 * with bytes:
 *  - A tile with a still shows the still. Its clip loads only on hover or focus,
 *    so scrolling the page downloads no video.
 *  - A tile without a still autoplays its clip, but only after sitting fully on
 *    screen for a moment, and only if one of a few page-wide slots is free.
 * The <video> is created on demand and removed on exit, which also keeps mobile
 * Safari under its limit on simultaneous media.
 */

/** Continuous on-screen time a poster-less tile must earn before it loads. */
const DWELL_MS = 600
/** Hard ceiling on poster-less tiles playing at once, across the whole page. */
const MAX_AUTOPLAY = 4

// --- Global autoplay slots -------------------------------------------------
// Shared by every tile. A tile without a slot stays on its gradient.
let liveCount = 0
const waiting: Array<() => void> = []

function claimSlot(onGranted: () => void): () => void {
  let granted = false
  const grant = () => {
    granted = true
    liveCount++
    onGranted()
  }
  if (liveCount < MAX_AUTOPLAY) grant()
  else waiting.push(grant)

  return () => {
    if (granted) {
      liveCount--
      const next = waiting.shift()
      if (next && liveCount < MAX_AUTOPLAY) next()
    } else {
      const i = waiting.indexOf(grant)
      if (i >= 0) waiting.splice(i, 1)
    }
  }
}

// --- Shared visibility observer -------------------------------------------
type TileCallback = (visible: boolean) => void
const callbacks = new WeakMap<Element, TileCallback>()
let sharedObserver: IntersectionObserver | null = null

function tileObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (!sharedObserver) {
    // Actually on screen, not merely nearby.
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting)
      },
      { threshold: 0.6 },
    )
  }
  return sharedObserver
}

export interface PieceTileProps {
  piece: CatalogPiece
  /** Above-the-fold tiles skip lazy image loading so the art paints instantly. */
  priority?: boolean
  aspect?: string
}

/** A gallery tile linking to the piece page, styled like the homepage marquee tile. */
export function PieceTile({ piece, priority = false, aspect = '16 / 10' }: PieceTileProps) {
  const rootRef = useRef<HTMLAnchorElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [live, setLive] = useState(false)
  const hasPoster = piece.thumbUrl !== null

  // Poster-less tiles: earn a video by sitting on screen, then holding a slot.
  useEffect(() => {
    if (hasPoster) return
    const root = rootRef.current
    if (!root) return
    const io = tileObserver()
    if (!io) return

    let dwellTimer: ReturnType<typeof setTimeout> | undefined
    let release: (() => void) | undefined

    const stop = () => {
      clearTimeout(dwellTimer)
      dwellTimer = undefined
      release?.()
      release = undefined
      setLive(false)
    }

    callbacks.set(root, (visible) => {
      if (visible) {
        if (dwellTimer || release) return
        dwellTimer = setTimeout(() => {
          dwellTimer = undefined
          release = claimSlot(() => setLive(true))
        }, DWELL_MS)
      } else {
        stop()
      }
    })
    io.observe(root)
    return () => {
      io.unobserve(root)
      callbacks.delete(root)
      stop()
    }
  }, [hasPoster])

  // The MP4s have audio, so force `muted` on the element or autoplay is refused.
  useEffect(() => {
    if (!live) return
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.play().catch(() => {})
  }, [live])

  // Mouse hover only: on a phone a tap opens the piece page instead.
  const onPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (hasPoster && e.pointerType === 'mouse') setLive(true)
    },
    [hasPoster],
  )
  const onPointerLeave = useCallback(() => {
    if (hasPoster) setLive(false)
  }, [hasPoster])

  return (
    <Link
      ref={rootRef}
      href={`/art/${piece.slug}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => hasPoster && setLive(true)}
      onBlur={() => hasPoster && setLive(false)}
      className="group relative block overflow-hidden rounded-[14px] no-underline"
      style={{
        aspectRatio: aspect,
        background: piece.gradient,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.09), 0 18px 34px -22px rgba(0,0,0,0.9)',
      }}
    >
      {piece.thumbUrl && (
        // next/image with `sizes`, so a ~240px tile gets a small variant.
        <Image
          src={piece.thumbUrl}
          alt={`${piece.name} — ${piece.subtitle || piece.era}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          className="object-cover"
        />
      )}
      {live && (
        <video
          ref={videoRef}
          src={piece.src}
          poster={piece.thumbUrl ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,0.72))' }}
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-px p-[11px]">
        <span className="truncate text-[13.5px] font-semibold tracking-[0.2px] text-white">{piece.name}</span>
        <span className="truncate font-mono text-[10.5px] tracking-[0.5px] text-white/60">
          {piece.subtitle || piece.era}
        </span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ boxShadow: 'inset 0 0 0 1.5px var(--primary)' }}
      />
    </Link>
  )
}
