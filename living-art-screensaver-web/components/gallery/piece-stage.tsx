'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { ArtVideo } from '@screensaver-art/ui'
import type { CatalogPiece } from '@/lib/gallery-catalog'

/**
 * The hero player on a piece page — the reason someone clicked the pin.
 *
 * Deliberately simpler than the homepage `<Monitor>`: one clip, loaded eagerly,
 * playing the instant it can. It keeps the site's monitor language (aluminium
 * bezel, black inner frame, glare, frosted placard, ambient art-glow behind the
 * screen) so a visitor who lands here first still sees "this is what your Mac
 * will look like", but it doesn't rotate — a landing page has exactly one
 * subject and shouldn't swap it out from under the person reading about it.
 *
 * The still under the video is the piece's own poster where one exists; where it
 * doesn't (77 of 262 pieces have no still — media isn't committed to this repo,
 * see CLAUDE.md → Repo rules), the deterministic gradient carries the frame so
 * the layout is never empty or broken while the clip buffers.
 *
 * A portrait (9:16) clip plays whole on the dark wall inside the same 16:9
 * screen (see ArtVideo). Its still is already the painting on that wall, so the
 * hand-off from still to clip lines up.
 */
export function PieceStage({ piece }: { piece: CatalogPiece }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // The MP4s ship with an audio track, and React's `muted` attribute alone is
  // unreliable — force it on the element before asking for playback, or the
  // autoplay policy rejects the play() and the visitor gets a still frame.
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
          // It's blurred to 48px — a tiny variant is indistinguishable from the
          // original here, so ask for the smallest one.
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
              // The LCP element: the visitor arrived from a pin to see exactly
              // this, so it's eager and priority-hinted. `sizes` still caps it
              // to the stage width rather than the 4K original.
              <Image
                src={piece.posterUrl}
                alt={`${piece.name} — a still from the animation`}
                fill
                sizes="(max-width: 1080px) 100vw, 1040px"
                priority
                className="object-cover"
              />
            )}
            <ArtVideo
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
                {piece.movement ? `${piece.name} · ${piece.movement}` : piece.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
