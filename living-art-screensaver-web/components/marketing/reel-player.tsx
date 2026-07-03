"use client"

import { useEffect, useRef, useState } from "react"
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
 * The readiness-gated reel player behind the marketing Monitors and the
 * art-styles featured display. Two persistent <video> layers crossfade under
 * the control of the pure state machine in lib/reel-machine.ts: the hidden
 * layer preloads the next clip (only once the current one is buffered), and a
 * rotation happens only when that clip can actually play — on slow networks
 * the current clip simply keeps looping. Under the videos sit the piece's
 * hue gradient and its real first-frame WebP, so visitors always see art,
 * never a loading void. Fills its parent; the parent supplies the bezel.
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

  // The machine + everything the media-event handlers need, kept in refs so the
  // handlers are stable and never see stale closures.
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
            // Chrome can `suspend` and never fire canplaythrough; timeupdate
            // keeps firing while playing, so the pipeline can't deadlock.
            if (!machine.current.frontBuffered && isFullyBuffered(v.duration, bufferedEnd(v)))
              dispatch({ type: "FRONT_BUFFERED" })
            break
        }
        return
      }

      // Hidden-layer events only matter while a preload is in flight (the
      // reducer also guards on backIdx, so stale events from the just-swapped
      // outgoing clip are ignored).
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
          // Safari fires canplaythrough erratically with preload="auto";
          // readyState is the ground truth.
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

  // Visibility = intersecting AND tab shown. Drives play/pause + the dwell
  // clock, so backgrounding the tab or scrolling away never causes silent
  // advances. First intersection also unlocks loading for non-eager players.
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

  // Controlled index: a parent-driven change jumps immediately (GOTO). The
  // echo of our own onIndexChange is a no-op in the reducer.
  useEffect(() => {
    if (index !== undefined && index !== machine.current.frontIdx) dispatch({ type: "GOTO", idx: index })
  }, [index, dispatch])

  // holdDwell freezes only the dwell clock — the clip keeps looping.
  useEffect(() => {
    holdRef.current = holdDwell
    if (holdDwell) haltDwell()
    else runDwell()
  }, [holdDwell, runDwell, haltDwell])

  // Post-render reconcile: enforce muted (the clips ship audio tracks and the
  // attribute alone is unreliable) and retry plays that raced the DOM commit.
  useEffect(() => {
    for (const layer of ["A", "B"] as const) {
      const v = videoRef(layer).current
      if (!v) continue
      v.muted = true
      if (wantPlaying.current[layer] && v.paused && v.getAttribute("src")) v.play().catch(() => {})
    }
  })

  // Readiness backstop: media events are flaky across browsers, so while a
  // question is open (front not yet buffered / back not yet ready), poll
  // readyState once a second. Also catches state reached before hydration
  // attached the event handlers (the eager hero on a fast cache).
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
        // iOS/mobile Safari won't buffer a hidden <video> from preload alone —
        // it only downloads once play() is called — so the back layer never
        // reaches BACK_READY and the reel stalls on the first clip forever
        // (the front loops fine: muted-inline autoplay via play() is allowed).
        // Fallback: once the front has served its full dwell and the back still
        // isn't ready, play the (still-hidden) back layer to force it to load.
        // The crossfade still only commits on BACK_PLAYING (real frames), and
        // the fully-buffered front keeps looping meanwhile so nothing stutters.
        // On desktop the back is ready well before dwell, so this never runs.
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
          <video
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
