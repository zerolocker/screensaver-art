'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogPiece } from '@/lib/gallery-catalog'

/**
 * WHY THIS FILE IS CAREFUL ABOUT BYTES
 *
 * The gallery clips are ~9 MB each. A 48-tile page that autoplays whatever is on
 * screen pulls ~90 MB if you park mid-page, and ~425 MB if you flick to the
 * bottom — measured, not guessed. That is unshippable for a landing page whose
 * traffic arrives from Pinterest, on a phone. So a tile earns its video:
 *
 *  1. **It has a still** (185 of 262 pieces — and 100% of the two newest pages,
 *     which is what most visitors see). The still is the tile. The clip loads
 *     only on deliberate hover/focus, and unloads the moment you leave, so
 *     scrolling the whole page costs zero video bytes.
 *  2. **It has no still** (77 older pieces, with no poster on R2 and none in
 *     public/posters/ — media is never committed to this repo, see CLAUDE.md →
 *     Repo rules). Here the clip is the only way to show the art at all, so it
 *     autoplays — but only after the tile has sat *fully* on screen for a beat
 *     (a fast scroll-past loads nothing) and only if one of a small number of
 *     global slots is free.
 *
 * Either way the <video> element is created on demand and destroyed on exit, so
 * the page never holds more than a few decoders — which also keeps it inside
 * mobile Safari's simultaneous-media limits.
 */

/** Continuous on-screen time a poster-less tile must earn before it loads. */
const DWELL_MS = 600
/** Hard ceiling on poster-less tiles playing at once, across the whole page. */
const MAX_AUTOPLAY = 4

// --- Global autoplay slots -------------------------------------------------
// A tiny counter + waiter queue, module-scoped so every tile on the page shares
// it. Tiles that can't get a slot simply stay on their gradient until one frees.
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
    // threshold 0.6 + no rootMargin: "actually on screen", not "nearby". A tile
    // half off the bottom edge hasn't been looked at yet.
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

/**
 * A gallery tile: the piece's still (or its gradient) with the clip fading in
 * over it, wrapped in a link to the piece page. Mirrors the homepage marquee
 * tile's bezel/scrim/label treatment so the gallery reads as the same product.
 */
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

  // Playback can't be started from render — the element only exists once `live`
  // has flipped, and the MP4s carry an audio track, so `muted` has to be forced
  // on the element itself or the autoplay policy rejects play().
  useEffect(() => {
    if (!live) return
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.play().catch(() => {})
  }, [live])

  // Poster tiles: hover/focus is a deliberate "show me this one", so it's the
  // only thing that loads a clip. Mouse only — a tap on a phone means "open the
  // piece page", and firing a 9 MB download on the way there would be rude.
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
        // next/image, not a raw <img>: the R2 stills are 4K WebPs of 1.4–3.3 MB
        // and a tile is ~240px wide. `sizes` is what actually caps the bytes —
        // it tells the optimizer which variant to serve at each breakpoint.
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
