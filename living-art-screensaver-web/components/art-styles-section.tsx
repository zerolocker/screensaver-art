"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { AutoVideo } from "@/components/marketing/gallery-video"
import { movements, poster, pieceLabel } from "@/lib/gallery-showcase"

const AUTO_ADVANCE_MS = 6500

const rowBase: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px",
  width: "100%", padding: "16px 18px", borderRadius: "14px", cursor: "pointer",
  transition: "background .2s", textAlign: "left",
}
const rowActive: CSSProperties = { ...rowBase, background: "rgba(158,232,162,0.09)", border: "1px solid rgba(158,232,162,0.4)" }
const rowIdle: CSSProperties = { ...rowBase, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)" }

const thumbBase: CSSProperties = {
  position: "relative", flex: "none", width: "96px", aspectRatio: "16 / 10", borderRadius: "9px",
  overflow: "hidden", cursor: "pointer", padding: 0,
}
const thumbActive: CSSProperties = {
  ...thumbBase, border: 0, outline: "2px solid #9EE8A2", outlineOffset: "1px",
  boxShadow: "0 6px 16px -6px rgba(0,0,0,0.8)",
}
const thumbIdle: CSSProperties = {
  ...thumbBase, border: 0, outline: "1px solid rgba(255,255,255,0.1)", opacity: 0.62, transition: "opacity .2s",
}

export function ArtStylesSection() {
  const [mvIdx, setMvIdx] = useState(0)
  const [pieceIdx, setPieceIdx] = useState(0)
  const [hovering, setHovering] = useState(false)

  const mv = movements[mvIdx] ?? movements[0]
  const pieces = mv.pieces
  const pIdx = ((pieceIdx % pieces.length) + pieces.length) % pieces.length
  const feat = pieces[pIdx]

  // Auto-advance through the current movement's pieces, unless the user is hovering.
  useEffect(() => {
    const timer = setInterval(() => {
      if (hovering) return
      setPieceIdx((i) => (i + 1) % pieces.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [hovering, pieces.length])

  const selectMovement = (i: number) => { setMvIdx(i); setPieceIdx(0) }
  const nextPiece = () => setPieceIdx((i) => (i + 1) % pieces.length)
  const prevPiece = () => setPieceIdx((i) => (i - 1 + pieces.length) % pieces.length)

  return (
    <section id="styles" className="relative px-[30px] pt-[92px] pb-[96px]">
      <div className="mx-auto max-w-[1340px]">
        <div className="mx-auto mb-[50px] max-w-[720px] text-center">
          <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-[#9EE8A2]">
            Every movement, animated
          </div>
          <h2
            className="m-0 mb-[14px] font-serif font-bold leading-[1.05] tracking-[-0.01em] text-foreground"
            style={{ fontSize: "clamp(30px,4vw,54px)" }}
          >
            Wander the whole history of art.
          </h2>
          <p className="m-0 text-[17px] leading-[1.55] text-muted-foreground">
            Just a taste of what&apos;s inside — pick a movement and watch it come alive. New art added every night.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(540px,1fr))] items-start gap-[40px]">
          {/* Movement list */}
          <div className="flex min-w-0 flex-col gap-[9px]">
            {movements.map((m, i) => {
              const active = i === mvIdx
              return (
                <button key={m.name} onClick={() => selectMovement(i)} style={active ? rowActive : rowIdle}>
                  <span className="flex min-w-0 flex-col gap-[3px] text-left">
                    <span
                      className="font-serif text-[21px] font-semibold leading-[1.1]"
                      style={{ color: active ? "#9EE8A2" : "var(--foreground)" }}
                    >
                      {m.name}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[1px] text-muted-foreground-subtle">{m.era}</span>
                  </span>
                  <span className="flex flex-none items-center">
                    <span style={{ color: active ? "#9EE8A2" : "var(--muted-foreground-subtle)", transform: `translateX(${active ? "3px" : "0px"})`, transition: "transform .25s" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Featured display */}
          <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className="flex min-w-0 flex-col gap-[18px]"
          >
            <div
              className="relative w-full rounded-[20px] p-[7px]"
              style={{
                background: "linear-gradient(180deg,#40444d,#2e313a 42%,#22252f)",
                boxShadow:
                  "inset 0 1.5px 0 rgba(255,255,255,0.32), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.30), inset 0 -2px 3px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.10), 0 40px 70px -34px rgba(0,0,0,0.95)",
              }}
            >
              <div
                className="w-full rounded-[14px] p-[5px]"
                style={{ background: "#080809", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 1px 3px rgba(0,0,0,0.85)" }}
              >
                <div
                  className="relative w-full overflow-hidden rounded-[7px]"
                  style={{ aspectRatio: "16 / 9", background: poster(feat), boxShadow: "inset 0 0 0 1px #000, inset 0 0 60px rgba(0,0,0,0.5)" }}
                >
                  <AutoVideo
                    videoKey={`${mvIdx}:${pIdx}:${feat.src}`}
                    src={feat.src}
                    priority
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ pointerEvents: "none", background: "linear-gradient(122deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0) 38%)", mixBlendMode: "screen" }}
                  />
                  <div
                    className="absolute bottom-[18px] left-1/2 inline-flex max-w-[84%] -translate-x-1/2 items-center rounded-full px-[18px] py-[9px]"
                    style={{
                      background: "rgba(16,16,18,0.5)",
                      backdropFilter: "blur(16px) saturate(1.3)", WebkitBackdropFilter: "blur(16px) saturate(1.3)",
                      border: "1px solid rgba(255,255,255,0.13)",
                    }}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[1px] text-white">
                      {pieceLabel(feat)}
                    </span>
                  </div>
                  <button
                    onClick={prevPiece}
                    aria-label="Previous piece"
                    className="absolute left-[14px] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white"
                    style={{ border: "1px solid rgba(255,255,255,0.16)", background: "rgba(10,10,11,0.55)", backdropFilter: "blur(10px)", cursor: "pointer" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={nextPiece}
                    aria-label="Next piece"
                    className="absolute right-[14px] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white"
                    style={{ border: "1px solid rgba(255,255,255,0.16)", background: "rgba(10,10,11,0.55)", backdropFilter: "blur(10px)", cursor: "pointer" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Placard */}
            <div className="flex items-start justify-between gap-5 px-1 pt-1">
              <div className="min-w-0">
                <div className="font-serif text-[23px] font-semibold leading-[1.15] text-foreground">{feat.name}</div>
                <div className="mt-[3px] text-[14.5px] text-muted-foreground">{feat.style}</div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex flex-wrap gap-[11px]">
              {pieces.map((p, i) => (
                <button key={p.src} onClick={() => setPieceIdx(i)} aria-label={p.name} style={i === pIdx ? thumbActive : thumbIdle}>
                  <span className="absolute inset-0" style={{ background: poster(p) }} />
                  <AutoVideo
                    src={p.src}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6))" }} />
                  <span className="absolute bottom-[7px] left-[8px] right-[8px] text-left text-[11px] font-semibold leading-[1.2] text-white">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
