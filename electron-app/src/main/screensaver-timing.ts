// Reads the two macOS idle delays that decide whether the screensaver is ever
// seen, and starts it on demand for a preview:
//   start delay        `defaults -currentHost read com.apple.screensaver idleTime` (seconds)
//   display-off delay  `pmset -g` "displaysleep" (minutes)
// If the display turns off first, the screensaver never shows. macOS only;
// values are null when they can't be read.

import { spawn, execFile } from 'child_process'
import { log } from './logger'

export interface ScreensaverTiming {
  // Seconds. 0 = never; null = unknown.
  screensaverStartSec: number | null
  // Minutes. 0 = never; null = unknown.
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

// Test seam, as in installer.ts.
export const _testHooks: { spawn: typeof spawn; run: typeof defaultRun } = {
  spawn,
  run: defaultRun,
}

// Accept only a clean integer; anything else is null.
export function parseIdleSeconds(stdout: string): number | null {
  const t = stdout.trim()
  return /^\d+$/.test(t) ? parseInt(t, 10) : null
}

// `-g` (not `-g custom`) reports the current power source's settings.
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

// Start the active screensaver now, so the user doesn't have to wait.
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
      // `open` exits once the engine has started.
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
