"use client"

import { useEffect, useState } from "react"
import { poster, pieceLabel, heroReel } from "@/lib/gallery-showcase"
import { AutoVideo } from "@/components/marketing/gallery-video"

// The reel every monitor on the page shows.
const REEL = heroReel

// Ambient-glow geometry, resolved once for the only look we use ("Top bloom",
// size "Large"): a soft green halo (g1) plus the current art bleeding onto the
// wall (g2). See Monitor.dc.html for the full family of styles/sizes.
const GLOW = {
  g1Top: "42%", g1W: "98%", g1H: "87%", g1Transform: "translate(-50%,-50%)",
  g2Top: "5%", g2W: "101%", g2H: "76%", g2Transform: "translate(-50%,0) scale(1.06)",
}

interface MonitorProps {
  /** Straight neck + T-bar foot below the screen. */
  stand?: boolean
  /** Eagerly preload the clips (use for the above-the-fold hero). */
  priority?: boolean
  /** Cross-fade cadence, ms. */
  interval?: number
}

/**
 * A realistic Studio-Display-style monitor that cross-fades the gallery reel,
 * with an ambient "the screen lights the wall behind it" glow and a frosted
 * title pill (mirrors the in-screensaver placard). Ported from Monitor.dc.html.
 */
export function Monitor({ stand = true, priority = false, interval = 5200 }: MonitorProps) {
  const n = REEL.length

  const [s, setS] = useState<{
    idx: number; active: "A" | "B"; aSrc: string; bSrc: string; aHas: boolean; bHas: boolean
  }>({
    idx: 0,
    active: "A",
    aSrc: REEL[0]?.src ?? "",
    bSrc: "",
    aHas: !!REEL[0],
    bHas: false,
  })

  useEffect(() => {
    if (n < 2) return
    const ms = Math.max(2000, interval)
    const timer = setInterval(() => {
      setS((prev) => {
        const next = (prev.idx + 1) % n
        const item = REEL[next]
        if (prev.active === "A") return { ...prev, idx: next, active: "B", bSrc: item.src, bHas: true }
        return { ...prev, idx: next, active: "A", aSrc: item.src, aHas: true }
      })
    }, ms)
    return () => clearInterval(timer)
  }, [n, interval])

  const cur = REEL[s.idx] || REEL[0]

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* ambient art-glow: soft green halo */}
      <div
        style={{
          position: "absolute", zIndex: 0, left: "50%", top: GLOW.g1Top,
          width: GLOW.g1W, height: GLOW.g1H, transform: GLOW.g1Transform, borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(158,232,162,0.18), rgba(158,232,162,0) 72%)",
          filter: "blur(34px)", pointerEvents: "none",
        }}
      />
      {/* ambient art-glow: the current art bleeding onto the wall */}
      <div
        style={{
          position: "absolute", zIndex: 0, left: "50%", top: GLOW.g2Top,
          width: GLOW.g2W, height: GLOW.g2H, transform: GLOW.g2Transform,
          borderRadius: "48px", overflow: "hidden", filter: "blur(48px) saturate(1.55)",
          opacity: 0.55, pointerEvents: "none",
        }}
      >
        {cur?.src && (
          <AutoVideo
            videoKey={`g:${cur.src}`}
            src={cur.src}
            priority={priority}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* screen unit (Midnight aluminium · thin bezel · crisp edge) */}
      <div
        style={{
          position: "relative", zIndex: 1, width: "100%", borderRadius: "20px", padding: "7px",
          background: "linear-gradient(180deg,#40444d,#2e313a 42%,#22252f)",
          boxShadow:
            "inset 0 1.5px 0 rgba(255,255,255,0.32), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.30), inset 0 -2px 3px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.10), 0 34px 60px -30px rgba(0,0,0,0.90)",
        }}
      >
        <div
          style={{
            width: "100%", padding: "5px", borderRadius: "14px", background: "#080809",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 1px 3px rgba(0,0,0,0.85)",
          }}
        >
          <div
            style={{
              position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "7px",
              overflow: "hidden", background: "#000",
              boxShadow: "inset 0 0 0 1px #000, inset 0 0 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: poster(cur) }} />

            {s.aHas && (
              <AutoVideo
                videoKey={`a:${s.aSrc}`}
                src={s.aSrc}
                priority={priority}
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                  opacity: s.active === "A" ? 1 : 0, transition: "opacity 1.15s ease",
                }}
              />
            )}
            {s.bHas && (
              <AutoVideo
                videoKey={`b:${s.bSrc}`}
                src={s.bSrc}
                priority={priority}
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                  opacity: s.active === "B" ? 1 : 0, transition: "opacity 1.15s ease",
                }}
              />
            )}

            {/* glare + vignette */}
            <div
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(122deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.02) 16%, rgba(255,255,255,0) 40%)",
                mixBlendMode: "screen",
              }}
            />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 90px rgba(0,0,0,0.5)" }} />

            {/* frosted title pill (mirrors the screensaver) */}
            {cur && (
              <div
                style={{
                  position: "absolute", left: "50%", bottom: "5.2%", transform: "translateX(-50%)",
                  display: "inline-flex", alignItems: "center", maxWidth: "82%", padding: "9px 18px",
                  borderRadius: "999px", background: "rgba(16,16,18,0.5)",
                  backdropFilter: "blur(18px) saturate(1.3)", WebkitBackdropFilter: "blur(18px) saturate(1.3)",
                  border: "1px solid rgba(255,255,255,0.13)", boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                }}
              >
                <span
                  style={{
                    color: "#fff", fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: "13px",
                    fontWeight: 500, letterSpacing: "1.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {pieceLabel(cur)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* stand: straight neck + flat T-bar foot (Midnight) */}
      {stand && (
        <>
          <div
            style={{
              position: "relative", zIndex: 1, width: "9%", minWidth: "54px", height: "56px", marginTop: "-1px",
              borderRadius: "0 0 4px 4px", background: "linear-gradient(180deg,#343841,#282b34 55%,#1e212a)",
              boxShadow: "inset 1px 0 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.10)",
            }}
          />
          <div
            style={{
              position: "relative", zIndex: 1, width: "44%", maxWidth: "280px", height: "16px", borderRadius: "7px",
              background: "linear-gradient(180deg,#343841,#1e212a)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 0 0 1px rgba(255,255,255,0.10), 0 22px 30px -14px rgba(0,0,0,0.85)",
            }}
          />
          <div
            style={{
              zIndex: 0, width: "52%", height: "24px", marginTop: "-6px", borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(0,0,0,0.6), rgba(0,0,0,0) 75%)", filter: "blur(7px)",
            }}
          />
        </>
      )}
    </div>
  )
}
