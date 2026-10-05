"use client"

import { useEffect, useRef, useState } from "react"
import { ArtVideo } from "@screensaver-art/ui"
import { poster, posterImage, type Piece } from "@/lib/gallery-showcase"
import {
  DwellClock,
  initialReelState,
  isFullyBuffered,
  reelReduce,
  type LayerId,
  type ReelCommand,
  type ReelEvent,
} from "@/lib/reel-machine"

const HAVE_CURRENT_DATA = 2
const HAVE_ENOUGH_DATA = 4

/** End of the first buffered range — reel clips download progressively from 0. */
function bufferedEnd(v: HTMLVideoElement): number {
  try {
    return v.buffered.length > 0 ? v.buffered.end(0) : 0
  } catch {
    return 0
  }
}

function backIsReady(v: HTMLVideoElement): boolean {
  return v.readyState >= HAVE_ENOUGH_DATA || isFullyBuffered(v.duration, bufferedEnd(v))
}

export interface ReelPlayerProps {
  pieces: Piece[]
  /** Minimum ACTUAL playback (not wall-clock) per clip before rotating, ms. */
  minDwellMs: number
  /** Load at mount (above-the-fold hero); otherwise on first approach. */
  eager?: boolean
  /** Freeze auto-advance (art-styles hover) — the clip keeps looping. */
  holdDwell?: boolean
  /** Controlled index: a prop value ≠ the current front jumps immediately. */
  index?: number
  /** Fired when the visible piece changes (crossfade commit). */
  onIndexChange?: (idx: number) => void
  fadeMs?: number
}

/**
 * The marketing reel player: two <video> layers that crossfade, driven by
 * lib/reel-machine.ts. On a slow network the current clip just keeps looping.
 * A gradient and the first-frame still sit underneath, so there's always art
 * on screen. Fills its parent.
 */
export function ReelPlayer({
  pieces,
  minDwellMs,
  eager = false,
  holdDwell = false,
  index,
  onIndexChange,
  fadeMs = 1150,
}: ReelPlayerProps) {
  const n = pieces.length

  const [view, setView] = useState<{
    frontLayer: LayerId
    frontIdx: number
    layerIdx: Record<LayerId, number | null>
    loadAllowed: boolean
  }>({ frontLayer: "A", frontIdx: 0, layerIdx: { A: n > 0 ? 0 : null, B: null }, loadAllowed: eager })

  const rootRef = useRef<HTMLDivElement>(null)
  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const videoRef = (layer: LayerId) => (layer === "A" ? videoRefA : videoRefB)

  // Kept in refs so the media handlers are stable and never stale.
  const machine = useRef(initialReelState(n))
  const clock = useRef<DwellClock | null>(null)
  if (clock.current === null) clock.current = new DwellClock(minDwellMs)
  const wantPlaying = useRef<Record<LayerId, boolean>>({ A: false, B: false })
  const isPlaying = useRef<Record<LayerId, boolean>>({ A: false, B: false })
  const intersecting = useRef(false)
  const holdRef = useRef(holdDwell)
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callbacks = useRef({ onIndexChange })
  callbacks.current = { onIndexChange }

  const glue = useRef<{
    dispatch: (e: ReelEvent) => void
    armDwell: () => void
    runDwell: () => void
    haltDwell: () => void
    onLayerEvent: (layer: LayerId, kind: string) => void
  } | null>(null)
  if (glue.current === null) {
    const armDwell = () => {
      clearTimeout(dwellTimer.current)
      const rem = clock.current!.remainingMs()
      if (rem === Infinity) return
      dwellTimer.current = setTimeout(() => {
        if (clock.current!.met()) dispatch({ type: "DWELL_MET" })
      }, rem + 10)
    }
    const runDwell = () => {
      const m = machine.current
      if (m.visible && !holdRef.current && isPlaying.current[m.frontLayer]) {
        clock.current!.run()
        armDwell()
      }
    }
    const haltDwell = () => {
      clock.current!.halt()
      clearTimeout(dwellTimer.current)
    }

    const exec = (c: ReelCommand) => {
      switch (c.type) {
        case "SET_LAYER_SRC":
          setView((v) => ({ ...v, layerIdx: { ...v.layerIdx, [c.layer]: c.idx } }))
          break
        case "PLAY_LAYER": {
          wantPlaying.current[c.layer] = true
          // If the src isn't committed to the DOM yet (same-batch SET_LAYER_SRC),
          // this rejects and the post-render reconcile effect retries.
          videoRef(c.layer).current?.play().catch(() => {})
          break
        }
        case "PAUSE_LAYER":
          wantPlaying.current[c.layer] = false
          videoRef(c.layer).current?.pause()
          break
        case "COMMIT_FADE": {
          const m = machine.current // already flipped by the reducer
          setView((v) => ({ ...v, frontLayer: c.toLayer, frontIdx: m.frontIdx }))
          clearTimeout(fadeTimer.current)
          fadeTimer.current = setTimeout(() => dispatch({ type: "FADE_DONE" }), fadeMs + 150)
          callbacks.current.onIndexChange?.(m.frontIdx)
          break
        }
        case "RESET_DWELL":
          clock.current!.reset()
          clearTimeout(dwellTimer.current)
          runDwell()
          break
      }
    }

    const dispatch = (e: ReelEvent) => {
      const [next, cmds] = reelReduce(machine.current, e)
      machine.current = next
      for (const c of cmds) exec(c)
    }

    const onLayerEvent = (layer: LayerId, kind: string) => {
      const v = videoRef(layer).current
      if (!v) return
      const isFront = layer === machine.current.frontLayer

      if (kind === "playing") isPlaying.current[layer] = true
      if (kind === "waiting" || kind === "pause") isPlaying.current[layer] = false

      if (isFront) {
        switch (kind) {
          case "playing":
            runDwell()
            dispatch({ type: "FRONT_PLAYING" })
            break
          case "waiting":
          case "pause":
            haltDwell()
            break
          case "canplaythrough":
            dispatch({ type: "FRONT_BUFFERED" })
            break
          case "timeupdate":
          case "progress":
            // Chrome may never fire canplaythrough; timeupdate keeps firing.
            if (!machine.current.frontBuffered && isFullyBuffered(v.duration, bufferedEnd(v)))
              dispatch({ type: "FRONT_BUFFERED" })
            break
        }
        return
      }

      // Hidden-layer events matter only while preloading.
      switch (kind) {
        case "playing":
          dispatch({ type: "BACK_PLAYING" })
          break
        case "canplaythrough":
          dispatch({ type: "BACK_READY" })
          break
        case "canplay":
        case "loadeddata":
        case "progress":
          // Safari's canplaythrough is erratic; trust readyState.
          if (!machine.current.backReady && backIsReady(v)) dispatch({ type: "BACK_READY" })
          break
        case "error":
          dispatch({ type: "BACK_ERROR" })
          break
      }
    }

    glue.current = { dispatch, armDwell, runDwell, haltDwell, onLayerEvent }
  }
  const { dispatch, runDwell, haltDwell, onLayerEvent } = glue.current

  // Visible = on screen and tab shown. Drives play/pause and the dwell clock.
  // The first intersection also starts loading for non-eager players.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => {
      const visible = intersecting.current && !document.hidden
      if (visible) setView((v) => (v.loadAllowed ? v : { ...v, loadAllowed: true }))
      if (visible !== machine.current.visible) dispatch({ type: "VISIBILITY", visible })
    }
    if (typeof IntersectionObserver === "undefined") {
      intersecting.current = true
      update()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        intersecting.current = entries[entries.length - 1].isIntersecting
        update()
      },
      { rootMargin: "300px 0px" },
    )
    io.observe(root)
    document.addEventListener("visibilitychange", update)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [dispatch])

  // A parent-driven index change jumps immediately.
  useEffect(() => {
    if (index !== undefined && index !== machine.current.frontIdx) dispatch({ type: "GOTO", idx: index })
  }, [index, dispatch])

  // holdDwell freezes only the dwell clock — the clip keeps looping.
  useEffect(() => {
    holdRef.current = holdDwell
    if (holdDwell) haltDwell()
    else runDwell()
  }, [holdDwell, runDwell, haltDwell])

  // After render: force muted (the attribute alone is unreliable) and retry
  // plays that raced the DOM update.
  useEffect(() => {
    for (const layer of ["A", "B"] as const) {
      const v = videoRef(layer).current
      if (!v) continue
      v.muted = true
      if (wantPlaying.current[layer] && v.paused && v.getAttribute("src")) v.play().catch(() => {})
    }
  })

  // Media events are flaky, so poll readyState each second while waiting. This
  // also catches readiness reached before hydration attached the handlers.
  useEffect(() => {
    const tick = () => {
      const m = machine.current
      if (!m.visible && !eager) return
      const front = videoRef(m.frontLayer).current
      if (front && !m.frontBuffered && front.getAttribute("src")) {
        if (front.readyState >= HAVE_ENOUGH_DATA || isFullyBuffered(front.duration, bufferedEnd(front)))
          dispatch({ type: "FRONT_BUFFERED" })
      }
      const backLayer: LayerId = m.frontLayer === "A" ? "B" : "A"
      const back = videoRef(backLayer).current
      if (m.backIdx !== null && !m.backReady && back && backIsReady(back)) {
        dispatch({ type: "BACK_READY" })
      } else if (
        // iOS Safari only downloads a hidden <video> once play() is called, so
        // the reel would stall on the first clip. After the dwell, play the
        // hidden layer to force it to load.
        m.backIdx !== null &&
        !m.backReady &&
        m.dwellMet &&
        m.visible &&
        m.started &&
        !m.fading &&
        back &&
        back.getAttribute("src") &&
        back.paused
      ) {
        wantPlaying.current[backLayer] = true
        back.play().catch(() => {})
      }
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [dispatch, eager])

  // Unmount bookkeeping.
  useEffect(() => {
    return () => {
      clearTimeout(dwellTimer.current)
      clearTimeout(fadeTimer.current)
    }
  }, [])

  if (n === 0) return null
  const cur = pieces[view.frontIdx] ?? pieces[0]

  const fillStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as const

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Instant paint, in fidelity order: hue gradient -> real first frame. */}
      <div style={{ position: "absolute", inset: 0, background: poster(cur) }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterImage(cur)}
        alt=""
        aria-hidden
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={fillStyle}
      />
      {(["A", "B"] as const).map((layer) => {
        const idx = view.layerIdx[layer]
        const piece = idx !== null ? pieces[idx] : null
        return (
          <ArtVideo
            key={layer}
            ref={videoRef(layer)}
            src={piece && view.loadAllowed ? piece.src : undefined}
            poster={piece ? posterImage(piece) : undefined}
            muted
            loop
            playsInline
            preload={view.loadAllowed ? "auto" : "none"}
            onPlaying={() => onLayerEvent(layer, "playing")}
            onWaiting={() => onLayerEvent(layer, "waiting")}
            onPause={() => onLayerEvent(layer, "pause")}
            onCanPlay={() => onLayerEvent(layer, "canplay")}
            onCanPlayThrough={() => onLayerEvent(layer, "canplaythrough")}
            onLoadedData={() => onLayerEvent(layer, "loadeddata")}
            onTimeUpdate={() => onLayerEvent(layer, "timeupdate")}
            onProgress={() => onLayerEvent(layer, "progress")}
            onError={() => onLayerEvent(layer, "error")}
            style={{
              ...fillStyle,
              opacity: view.frontLayer === layer ? 1 : 0,
              transition: `opacity ${fadeMs}ms ease`,
            }}
          />
        )
      })}
    </div>
  )
}
