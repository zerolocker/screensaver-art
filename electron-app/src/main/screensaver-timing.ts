// Reads the two macOS idle thresholds that decide whether the user ever actually
// SEES the screensaver, and starts it on demand for an instant preview.
//
//   X = screensaver start delay  (defaults -currentHost read com.apple.screensaver idleTime → seconds)
//   Y = display-off delay        (pmset -g → the "displaysleep" line, in minutes)
//
// If the display turns off at or before the screensaver would start (Y ≤ X) the
// screen goes dark first and the saver never appears — the renderer warns about
// exactly that. The un-sandboxed main process can read both directly, so unlike
// the pluginkit work there's no Swift helper involved. Everything is best-effort
// and macOS-only: on failure / other platforms the values come back null and the
// UI degrades to a neutral "your screensaver is set" message rather than guess.

import { spawn, execFile } from 'child_process'
import { log } from './logger'

export interface ScreensaverTiming {
  // Idle SECONDS before the screensaver starts. 0 = "Never" (won't auto-start);
  // null = couldn't read / not macOS.
  screensaverStartSec: number | null
  // Idle MINUTES before the display turns off. 0 = "Never"; null = couldn't read.
  displayOffMin: number | null
}

type RunResult = { code: number; stdout: string; stderr: string }

function defaultRun(cmd: string, args: ReadonlyArray<string>): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(cmd, args as string[], { timeout: 10000 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: number }) | null
      const code = e && typeof e.code === 'number' ? e.code : e ? 1 : 0
      resolve({ code, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' })
    })
  })
}

// Test seam (mirrors installer.ts): swap spawn/run so tests don't shell out to
// the dev machine's real `defaults`/`pmset`/`open`.
export const _testHooks: { spawn: typeof spawn; run: typeof defaultRun } = {
  spawn,
  run: defaultRun,
}

// `defaults -currentHost read com.apple.screensaver idleTime` prints just the
// integer seconds (e.g. "1200\n"), or errors when the key doesn't exist. We only
// accept a clean integer and report null otherwise, so the UI stays neutral
// rather than inventing a number.
export function parseIdleSeconds(stdout: string): number | null {
  const t = stdout.trim()
  return /^\d+$/.test(t) ? parseInt(t, 10) : null
}

// `pmset -g` prints the currently-active power settings, one "  key   value"
// per line; we want `displaysleep` in minutes (0 = never). Using `-g` (not
// `-g custom`) gives the value for the live power source, which is what actually
// governs the user right now.
export function parseDisplaySleepMinutes(pmsetOutput: string): number | null {
  const m = pmsetOutput.match(/^\s*displaysleep\s+(\d+)/m)
  return m ? parseInt(m[1], 10) : null
}

export async function getScreensaverTiming(): Promise<ScreensaverTiming> {
  if (process.platform !== 'darwin') {
    return { screensaverStartSec: null, displayOffMin: null }
  }
  const [idle, pm] = await Promise.all([
    _testHooks.run('/usr/bin/defaults', ['-currentHost', 'read', 'com.apple.screensaver', 'idleTime']),
    _testHooks.run('/usr/bin/pmset', ['-g']),
  ])
  const screensaverStartSec = idle.code === 0 ? parseIdleSeconds(idle.stdout) : null
  const displayOffMin = pm.code === 0 ? parseDisplaySleepMinutes(pm.stdout) : null
  log.debug('screensaver-timing', 'read idle thresholds', { screensaverStartSec, displayOffMin })
  return { screensaverStartSec, displayOffMin }
}

// Start the currently-selected screensaver right now so the user can SEE what
// they picked without waiting out the idle timer — the tight feedback loop. Any
// keypress / mouse-move quits it (standard screensaver behaviour). Fire-and-
// forget `open` of the system ScreenSaverEngine; not available off macOS.
const SCREENSAVER_ENGINE = '/System/Library/CoreServices/ScreenSaverEngine.app'
export async function startScreensaverPreview(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Not supported on ${process.platform}.` }
  }
  return new Promise((resolve) => {
    try {
      const proc = _testHooks.spawn('/usr/bin/open', [SCREENSAVER_ENGINE])
      let settled = false
      proc.on('error', (err: Error) => {
        if (settled) return
        settled = true
        log.error('screensaver-timing', 'preview failed to launch', { error: err.message })
        resolve({ ok: false, error: err.message })
      })
      // `open` exits as soon as it has handed off to the engine; code 0 = launched.
      proc.on('exit', (code: number | null) => {
        if (settled) return
        settled = true
        if (code === 0 || code === null) resolve({ ok: true })
        else resolve({ ok: false, error: `Could not start the screensaver (open exited ${code}).` })
      })
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  })
}
