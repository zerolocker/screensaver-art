'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import type { CatalogPiece } from '@/lib/gallery-catalog'

/**
 * The player on a piece page: one clip, loaded eagerly, in the same monitor
 * frame as the homepage but without rotating. The piece's still (or its
 * gradient) shows while the clip buffers.
 */
export function PieceStage({ piece }: { piece: CatalogPiece }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // React's `muted` attribute is unreliable and the MP4s have audio, so force it
  // or autoplay is refused.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.play().catch(() => {})
  }, [])

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Ambient glow: the art bleeding onto the wall behind the monitor. A
          blurred copy of the still (never a second video — that would double the
          page's bandwidth for a decorative effect). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[5%] z-0 hidden h-[76%] w-[101%] -translate-x-1/2 overflow-hidden rounded-[48px] sm:block"
        style={{ transform: 'translate(-50%,0) scale(1.06)', filter: 'blur(48px) saturate(1.55)', opacity: 0.5 }}
      >
        <div className="absolute inset-0" style={{ background: piece.gradient }} />
        {piece.posterUrl && (
          // Blurred heavily, so the smallest variant will do.
          <Image src={piece.posterUrl} alt="" fill sizes="256px" className="object-cover" />
        )}
      </div>

      {/* Screen unit */}
      <div
        className="relative z-[1] w-full rounded-[20px] p-[7px]"
        style={{
          background: 'linear-gradient(180deg,#40444d,#2e313a 42%,#22252f)',
          boxShadow:
            'inset 0 1.5px 0 rgba(255,255,255,0.32), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.30), inset 0 -2px 3px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.10), 0 34px 60px -30px rgba(0,0,0,0.90)',
        }}
      >
        <div
          className="w-full rounded-[14px] p-[5px]"
          style={{ background: '#080809', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.9)' }}
        >
          <div
            className="relative w-full overflow-hidden rounded-[7px]"
            style={{ aspectRatio: '16 / 9', background: piece.gradient }}
          >
            {piece.posterUrl && (
              // The LCP element, so eager and priority-hinted.
              <Image
                src={piece.posterUrl}
                alt={`${piece.name} — a still from the animation`}
                fill
                sizes="(max-width: 1080px) 100vw, 1040px"
                priority
                className="object-cover"
              />
            )}
            <video
              ref={videoRef}
              src={piece.src}
              poster={piece.posterUrl ?? undefined}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(122deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.02) 16%, rgba(255,255,255,0) 40%)',
                mixBlendMode: 'screen',
              }}
            />
            {/* Frosted placard — the same one the screensaver itself draws. */}
            <div
              className="absolute bottom-[5.2%] left-1/2 inline-flex max-w-[86%] -translate-x-1/2 items-center rounded-full px-[18px] py-[9px]"
              style={{
                background: 'rgba(16,16,18,0.5)',
                backdropFilter: 'blur(18px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(18px) saturate(1.3)',
                border: '1px solid rgba(255,255,255,0.13)',
              }}
            >
              <span className="truncate text-[12px] font-medium tracking-[1.1px] text-white sm:text-[13px]">
                {piece.subtitle ? `${piece.name} · ${piece.subtitle}` : piece.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
