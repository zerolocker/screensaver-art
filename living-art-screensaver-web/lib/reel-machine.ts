// Pure, DOM-free state machine for the marketing reel players (the hero/CTA
// Monitors and the art-styles featured display). It exists to replace a blind
// setInterval rotation that, on slow networks, kept switching to clips that
// hadn't downloaded a single byte — leaving visitors staring at poster
// backgrounds instead of art.
//
// The rules it encodes:
//   - Never switch TO a clip that isn't buffered enough to play through.
//   - Never switch AWAY from a clip before it has actually PLAYED (not merely
//     existed on screen) for the minimum dwell.
//   - Preload the next clip on the hidden layer only after the current one is
//     comfortably buffered, so two multi-MB fetches never compete on a slow link.
//   - Commit a crossfade only when the incoming clip is truly rendering frames
//     (its `playing` event), so the poster never flashes mid-rotation.
//
// The reducer is pure (state + event -> state + commands); the React glue in
// components/marketing/reel-player.tsx executes the commands against real
// <video> elements. This split keeps every gating rule unit-testable in node.

export type LayerId = "A" | "B"

export interface ReelState {
  n: number
  /** Which physical layer is visible. */
  frontLayer: LayerId
  /** Reel index shown on the front layer. */
  frontIdx: number
  /** Reel index preloading on the hidden layer (null = idle). */
  backIdx: number | null
  /** Front clip hit canplaythrough (or fully buffered) at least once. */
  frontBuffered: boolean
  /** Back clip is buffered enough to play through. */
  backReady: boolean
  /** Front clip has accumulated >= the minimum dwell of actual playback. */
  dwellMet: boolean
  /** Between a committed swap and the crossfade completing. */
  fading: boolean
  /** Container intersects the viewport AND the tab is visible. */
  visible: boolean
  /** Front clip has fired `playing` at least once. */
  started: boolean
}

export type ReelEvent =
  | { type: "FRONT_PLAYING" }
  | { type: "FRONT_BUFFERED" }
  | { type: "BACK_READY" }
  | { type: "BACK_ERROR" }
  | { type: "BACK_PLAYING" }
  | { type: "DWELL_MET" }
  | { type: "FADE_DONE" }
  | { type: "VISIBILITY"; visible: boolean }
  /** User override (art-styles clicks): jump to a piece immediately. */
  | { type: "GOTO"; idx: number }

export type ReelCommand =
  | { type: "SET_LAYER_SRC"; layer: LayerId; idx: number }
  | { type: "PLAY_LAYER"; layer: LayerId }
  | { type: "PAUSE_LAYER"; layer: LayerId }
  | { type: "COMMIT_FADE"; toLayer: LayerId }
  | { type: "RESET_DWELL" }

const other = (l: LayerId): LayerId => (l === "A" ? "B" : "A")

export function initialReelState(n: number): ReelState {
  return {
    n,
    frontLayer: "A",
    frontIdx: 0,
    backIdx: null,
    frontBuffered: false,
    backReady: false,
    dwellMet: false,
    fading: false,
    visible: false,
    started: false,
  }
}

/** Assign the next reel index to the hidden layer, if there is one to show. */
function assignBack(s: ReelState, cmds: ReelCommand[]): ReelState {
  if (s.n < 2 || s.backIdx !== null || s.fading) return s
  const backIdx = (s.frontIdx + 1) % s.n
  cmds.push({ type: "SET_LAYER_SRC", layer: other(s.frontLayer), idx: backIdx })
  return { ...s, backIdx, backReady: false }
}

/** Start the swap when every gate is open. The state only flips on BACK_PLAYING. */
function maybeAdvance(s: ReelState, cmds: ReelCommand[]): ReelState {
  if (s.backIdx !== null && s.backReady && s.dwellMet && s.visible && s.started && !s.fading) {
    cmds.push({ type: "PLAY_LAYER", layer: other(s.frontLayer) })
  }
  return s
}

export function reelReduce(s: ReelState, e: ReelEvent): [ReelState, ReelCommand[]] {
  const cmds: ReelCommand[] = []
  switch (e.type) {
    case "FRONT_PLAYING": {
      if (s.started) return [s, cmds]
      return [maybeAdvance({ ...s, started: true }, cmds), cmds]
    }

    case "FRONT_BUFFERED": {
      if (s.frontBuffered) return [s, cmds]
      // While fading, only record the flag — the hidden layer still holds the
      // outgoing clip until FADE_DONE releases it.
      return [assignBack({ ...s, frontBuffered: true }, cmds), cmds]
    }

    case "BACK_READY": {
      if (s.backIdx === null || s.backReady) return [s, cmds]
      return [maybeAdvance({ ...s, backReady: true }, cmds), cmds]
    }

    case "DWELL_MET": {
      if (s.dwellMet) return [s, cmds]
      return [maybeAdvance({ ...s, dwellMet: true }, cmds), cmds]
    }

    case "BACK_PLAYING": {
      // The play() we issued actually started rendering frames: commit the swap.
      if (s.backIdx === null || s.fading) return [s, cmds]
      const next: ReelState = {
        ...s,
        frontLayer: other(s.frontLayer),
        frontIdx: s.backIdx,
        backIdx: null,
        frontBuffered: false,
        backReady: false,
        dwellMet: false,
        started: true, // the new front is playing by definition
        fading: true,
      }
      cmds.push({ type: "COMMIT_FADE", toLayer: next.frontLayer }, { type: "RESET_DWELL" })
      return [next, cmds]
    }

    case "FADE_DONE": {
      if (!s.fading) return [s, cmds]
      let next: ReelState = { ...s, fading: false }
      cmds.push({ type: "PAUSE_LAYER", layer: other(s.frontLayer) })
      // The new front may have been buffered all along (cache hit) — start the
      // next preload now that the old clip's layer is free.
      if (next.frontBuffered) next = assignBack(next, cmds)
      return [maybeAdvance(next, cmds), cmds]
    }

    case "BACK_ERROR": {
      if (s.backIdx === null) return [s, cmds]
      // Skip past the broken clip; give up (front loops forever) if the
      // candidate wraps all the way back to the front.
      const idx = (s.backIdx + 1) % s.n
      if (idx === s.frontIdx) return [{ ...s, backIdx: null, backReady: false }, cmds]
      cmds.push({ type: "SET_LAYER_SRC", layer: other(s.frontLayer), idx })
      return [{ ...s, backIdx: idx, backReady: false }, cmds]
    }

    case "VISIBILITY": {
      if (e.visible === s.visible) return [s, cmds]
      const next = { ...s, visible: e.visible }
      if (!e.visible) {
        // Let a fade in flight finish — pausing mid-crossfade looks broken.
        if (!next.fading) cmds.push({ type: "PAUSE_LAYER", layer: next.frontLayer })
        return [next, cmds]
      }
      cmds.push({ type: "PLAY_LAYER", layer: next.frontLayer })
      // Doubles as the retry path after a rejected play().
      return [maybeAdvance(next, cmds), cmds]
    }

    case "GOTO": {
      const idx = ((e.idx % s.n) + s.n) % s.n
      // Also covers the controlled-index echo: a parent feeding onIndexChange
      // back as `index` right after a commit must not disturb the fade.
      if (idx === s.frontIdx) return [s, cmds]
      // Repoint the front layer immediately (poster shows while it loads —
      // acceptable for an explicit user action) and drop any back preload.
      const next: ReelState = {
        ...s,
        frontIdx: idx,
        backIdx: null,
        frontBuffered: false,
        backReady: false,
        dwellMet: false,
        started: false,
        fading: false,
      }
      cmds.push(
        { type: "SET_LAYER_SRC", layer: next.frontLayer, idx },
        { type: "PAUSE_LAYER", layer: other(next.frontLayer) },
        { type: "RESET_DWELL" },
      )
      if (next.visible) cmds.push({ type: "PLAY_LAYER", layer: next.frontLayer })
      return [next, cmds]
    }
  }
}

/**
 * True when a clip's buffered range effectively covers its duration. The 0.3s
 * slack absorbs the fractional tail browsers routinely leave unbuffered.
 */
export function isFullyBuffered(duration: number, bufferedEnd: number): boolean {
  return duration > 0 && bufferedEnd >= duration - 0.3
}

/**
 * Accumulates ACTUAL playback time (not wall-clock): run() while the front clip
 * is playing and visible, halt() on waiting/pause/hidden/offscreen. The player
 * arms one setTimeout(remainingMs()) to dispatch DWELL_MET — no polling.
 */
export class DwellClock {
  private minMs: number
  private now: () => number
  private accumulated = 0
  private runningSince: number | null = null

  constructor(minMs: number, now: () => number = Date.now) {
    this.minMs = minMs
    this.now = now
  }

  run(): void {
    if (this.runningSince === null) this.runningSince = this.now()
  }

  halt(): void {
    if (this.runningSince !== null) {
      this.accumulated += this.now() - this.runningSince
      this.runningSince = null
    }
  }

  reset(): void {
    this.accumulated = 0
    this.runningSince = null
  }

  private elapsed(): number {
    return this.accumulated + (this.runningSince === null ? 0 : this.now() - this.runningSince)
  }

  met(): boolean {
    return this.elapsed() >= this.minMs
  }

  /** Time until met() while running; Infinity when halted. */
  remainingMs(): number {
    if (this.runningSince === null && !this.met()) return Infinity
    return Math.max(0, this.minMs - this.elapsed())
  }
}
