import { describe, expect, it } from "vitest"
import {
  DwellClock,
  initialReelState,
  isFullyBuffered,
  reelReduce,
  type ReelCommand,
  type ReelEvent,
  type ReelState,
} from "../reel-machine"

function feed(state: ReelState, events: ReelEvent[]): [ReelState, ReelCommand[]] {
  const all: ReelCommand[] = []
  let s = state
  for (const e of events) {
    const [next, cmds] = reelReduce(s, e)
    s = next
    all.push(...cmds)
  }
  return [s, all]
}

/** A reel that is visible, playing, and has its first clip buffered. */
function runningState(n = 7): [ReelState, ReelCommand[]] {
  return feed(initialReelState(n), [
    { type: "VISIBILITY", visible: true },
    { type: "FRONT_PLAYING" },
    { type: "FRONT_BUFFERED" },
  ])
}

describe("reelReduce", () => {
  it("boot: FRONT_BUFFERED assigns exactly one back preload, idempotently", () => {
    const [s1, cmds1] = feed(initialReelState(7), [{ type: "FRONT_BUFFERED" }])
    expect(cmds1).toEqual([{ type: "SET_LAYER_SRC", layer: "B", idx: 1 }])
    expect(s1.backIdx).toBe(1)

    const [, cmds2] = reelReduce(s1, { type: "FRONT_BUFFERED" })
    expect(cmds2).toEqual([])
  })

  it("never assigns a back preload for a single-clip reel", () => {
    const [s, cmds] = feed(initialReelState(1), [{ type: "FRONT_BUFFERED" }])
    expect(cmds).toEqual([])
    expect(s.backIdx).toBeNull()
  })

  it("gating matrix: no PLAY_LAYER until ready + dwell + visible + started", () => {
    const [base] = runningState()

    // dwell alone
    let [, cmds] = reelReduce(base, { type: "DWELL_MET" })
    expect(cmds).toEqual([])

    // ready alone
    ;[, cmds] = reelReduce(base, { type: "BACK_READY" })
    expect(cmds).toEqual([])

    // both, but invisible
    const [hidden] = feed(base, [{ type: "VISIBILITY", visible: false }])
    const [hiddenBoth, hiddenCmds] = feed(hidden, [{ type: "BACK_READY" }, { type: "DWELL_MET" }])
    expect(hiddenCmds).toEqual([])

    // becoming visible fires the swap
    const [, visCmds] = reelReduce(hiddenBoth, { type: "VISIBILITY", visible: true })
    expect(visCmds).toContainEqual({ type: "PLAY_LAYER", layer: "B" })

    // all gates open at once
    const [, bothCmds] = feed(base, [{ type: "BACK_READY" }, { type: "DWELL_MET" }])
    expect(bothCmds).toEqual([{ type: "PLAY_LAYER", layer: "B" }])
  })

  it("commits the swap only on BACK_PLAYING", () => {
    const [armed] = feed(runningState()[0], [{ type: "BACK_READY" }, { type: "DWELL_MET" }])
    expect(armed.frontLayer).toBe("A") // PLAY_LAYER issued, but no flip yet

    const [swapped, cmds] = reelReduce(armed, { type: "BACK_PLAYING" })
    expect(cmds).toEqual([{ type: "COMMIT_FADE", toLayer: "B" }, { type: "RESET_DWELL" }])
    expect(swapped).toMatchObject({
      frontLayer: "B",
      frontIdx: 1,
      backIdx: null,
      dwellMet: false,
      backReady: false,
      frontBuffered: false,
      fading: true,
      started: true,
    })
  })

  it("makes no back assignment while fading, in either event order", () => {
    const [fading] = feed(runningState()[0], [
      { type: "BACK_READY" },
      { type: "DWELL_MET" },
      { type: "BACK_PLAYING" },
    ])

    // Order 1: FRONT_BUFFERED (fast cache) before FADE_DONE
    const [s1, cmds1] = reelReduce(fading, { type: "FRONT_BUFFERED" })
    expect(cmds1).toEqual([]) // old clip still owns the hidden layer
    const [, cmds2] = reelReduce(s1, { type: "FADE_DONE" })
    expect(cmds2).toEqual([
      { type: "PAUSE_LAYER", layer: "A" },
      { type: "SET_LAYER_SRC", layer: "A", idx: 2 },
    ])

    // Order 2: FADE_DONE before FRONT_BUFFERED (slow link)
    const [s3, cmds3] = reelReduce(fading, { type: "FADE_DONE" })
    expect(cmds3).toEqual([{ type: "PAUSE_LAYER", layer: "A" }])
    const [, cmds4] = reelReduce(s3, { type: "FRONT_BUFFERED" })
    expect(cmds4).toEqual([{ type: "SET_LAYER_SRC", layer: "A", idx: 2 }])
  })

  it("wraps around at the end of the reel", () => {
    let [s] = runningState(3)
    // Advance twice: 0 -> 1 -> 2
    for (let i = 0; i < 2; i++) {
      ;[s] = feed(s, [
        { type: "BACK_READY" },
        { type: "DWELL_MET" },
        { type: "BACK_PLAYING" },
        { type: "FADE_DONE" },
        { type: "FRONT_PLAYING" },
        { type: "FRONT_BUFFERED" },
      ])
    }
    expect(s.frontIdx).toBe(2)
    expect(s.backIdx).toBe(0) // wrapped
  })

  it("BACK_ERROR skips ahead and gives up when it wraps to the front", () => {
    const [s0] = runningState(3) // frontIdx 0, backIdx 1
    const [s1, cmds1] = reelReduce(s0, { type: "BACK_ERROR" })
    expect(cmds1).toEqual([{ type: "SET_LAYER_SRC", layer: "B", idx: 2 }])
    expect(s1.backIdx).toBe(2)

    const [s2, cmds2] = reelReduce(s1, { type: "BACK_ERROR" })
    expect(cmds2).toEqual([]) // candidate would be 0 = frontIdx -> give up
    expect(s2.backIdx).toBeNull()

    // A later error event with no preload in flight is a no-op
    const [, cmds3] = reelReduce(s2, { type: "BACK_ERROR" })
    expect(cmds3).toEqual([])
  })

  it("GOTO repoints the front immediately and cancels the preload", () => {
    const [s0] = runningState(5)
    const [s1, cmds] = reelReduce(s0, { type: "GOTO", idx: 3 })
    expect(cmds).toEqual([
      { type: "SET_LAYER_SRC", layer: "A", idx: 3 },
      { type: "PAUSE_LAYER", layer: "B" },
      { type: "RESET_DWELL" },
      { type: "PLAY_LAYER", layer: "A" },
    ])
    expect(s1).toMatchObject({ frontIdx: 3, backIdx: null, started: false, dwellMet: false })

    // GOTO to the current piece is a no-op
    const [, cmds2] = reelReduce(s1, { type: "GOTO", idx: 3 })
    expect(cmds2).toEqual([])
  })

  it("GOTO mid-fade resets cleanly", () => {
    const [fading] = feed(runningState()[0], [
      { type: "BACK_READY" },
      { type: "DWELL_MET" },
      { type: "BACK_PLAYING" },
    ]) // frontLayer B, fading
    const [s, cmds] = reelReduce(fading, { type: "GOTO", idx: 4 })
    expect(s).toMatchObject({ frontLayer: "B", frontIdx: 4, fading: false, backIdx: null })
    expect(cmds).toContainEqual({ type: "SET_LAYER_SRC", layer: "B", idx: 4 })
    expect(cmds).toContainEqual({ type: "PAUSE_LAYER", layer: "A" })
  })

  it("BACK_PLAYING without an armed preload (stale event) is ignored", () => {
    const [s0] = runningState()
    const [afterGoto] = reelReduce(s0, { type: "GOTO", idx: 2 })
    const [s, cmds] = reelReduce(afterGoto, { type: "BACK_PLAYING" })
    expect(cmds).toEqual([])
    expect(s.frontIdx).toBe(2)
  })

  it("visibility loss pauses the front; regaining it replays and re-checks", () => {
    const [s0] = runningState()
    const [hidden, cmds1] = reelReduce(s0, { type: "VISIBILITY", visible: false })
    expect(cmds1).toEqual([{ type: "PAUSE_LAYER", layer: "A" }])
    const [, cmds2] = reelReduce(hidden, { type: "VISIBILITY", visible: true })
    expect(cmds2).toEqual([{ type: "PLAY_LAYER", layer: "A" }])
  })
})

describe("isFullyBuffered", () => {
  it("requires a known duration and near-complete buffer", () => {
    expect(isFullyBuffered(0, 100)).toBe(false)
    expect(isFullyBuffered(NaN, 100)).toBe(false)
    expect(isFullyBuffered(8, 8)).toBe(true)
    expect(isFullyBuffered(8, 7.8)).toBe(true) // 0.3s slack
    expect(isFullyBuffered(8, 7)).toBe(false)
  })
})

describe("DwellClock", () => {
  it("accumulates only while running", () => {
    let t = 0
    const clock = new DwellClock(6000, () => t)
    clock.run()
    t = 3000
    clock.halt()
    t = 13000 // 10s halted — must not count
    expect(clock.met()).toBe(false)
    clock.run()
    t = 15900 // 3000 + 2900 = 5900ms
    expect(clock.met()).toBe(false)
    t = 16000 // 6000ms exactly
    expect(clock.met()).toBe(true)
  })

  it("reports remaining time while running, Infinity while halted", () => {
    let t = 0
    const clock = new DwellClock(6000, () => t)
    expect(clock.remainingMs()).toBe(Infinity)
    clock.run()
    t = 2000
    expect(clock.remainingMs()).toBe(4000)
    clock.halt()
    expect(clock.remainingMs()).toBe(Infinity)
  })

  it("reset clears accumulated playback", () => {
    let t = 0
    const clock = new DwellClock(1000, () => t)
    clock.run()
    t = 5000
    expect(clock.met()).toBe(true)
    clock.reset()
    expect(clock.met()).toBe(false)
    expect(clock.remainingMs()).toBe(Infinity) // reset also halts
  })
})
