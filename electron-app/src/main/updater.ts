// Background auto-update (Claude-Desktop style): silently download a new release
// and surface a "Relaunch to update" prompt in the renderer.
//
// Built on electron-updater (the package that ships with electron-builder). On
// macOS this drives Squirrel.Mac, which REQUIRES a Developer-ID-signed +
// notarized build — so auto-update only does anything in a packaged release
// build. In dev (`electron-vite dev`, `!app.isPackaged`) the whole thing is a
// no-op: autoUpdater would throw "Could not get code signature for running
// application", so we never wire it up.
//
// Where updates come from is baked into Contents/Resources/app-update.yml at
// build time from the `publish` block in electron-builder.cjs (a `generic`
// provider pointed at the website's /updates feed, which proxies the GitHub
// release through the same token as /download — keeping "private repo = zero
// change" intact). See CLAUDE.md › Auto-update.
//
// The embedded screensaver .appex needs no special handling here: it travels
// inside the same signed/notarized .app the updater swaps in, and installer.ts's
// version-aware ensureRegistered re-registers it with pluginkit on the
// post-quitAndInstall relaunch (the appex CFBundleVersion bump is what triggers
// it). See CLAUDE.md › Embedded .appex compatibility.

import { app, powerMonitor, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { log } from './logger'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateState {
  status: UpdateStatus
  /** The new version, once known (available/downloading/ready). */
  version?: string
  /** Download progress 0–100 while downloading. */
  percent?: number
  /** Most recent error message, if the last check/download failed. */
  error?: string
}

// A normalized, Electron-free view of the autoUpdater events — so the state
// transitions can be unit-tested without spinning up Electron.
export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/**
 * Pure reducer: fold an updater event into the next UI state. `autoDownload` is
 * on, so an available update goes straight to `downloading` (the download starts
 * immediately); progress keeps the version we learned at `available`; a finished
 * download is `ready` (the only state that shows the "Relaunch" prompt).
 *
 * `ready` is sticky: once an update is downloaded, a later 'checking' /
 * 'not-available' must not hide the "Relaunch" banner (checkForUpdates skips
 * re-checks while ready, but this guards any event that slips through — the
 * only ways forward from ready are relaunching or a *different* version
 * becoming available).
 */
export function reduceUpdateState(prev: UpdateState, event: UpdaterEvent): UpdateState {
  switch (event.type) {
    case 'checking':
      if (prev.status === 'ready') return prev
      return { status: 'checking', version: prev.version }
    case 'available':
      if (prev.status === 'ready' && prev.version === event.version) return prev
      return { status: 'downloading', version: event.version, percent: 0 }
    case 'not-available':
      if (prev.status === 'ready') return prev
      return { status: 'idle' }
    case 'progress':
      return { status: 'downloading', version: prev.version, percent: event.percent }
    case 'downloaded':
      return { status: 'ready', version: event.version }
    case 'error':
      return { status: 'error', version: prev.version, error: event.message }
  }
}

// Why a check can start: which trigger fired. Logged with every check so the
// time-to-banner after a release can be reconstructed from main.log.
export type CheckTrigger = 'launch' | 'interval' | 'focus' | 'resume' | 'manual'

const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // background fallback while running
const INITIAL_CHECK_DELAY_MS = 3_000 // let the window settle before the first check
// A window-focus check runs at most this often. Focus is the high-value moment
// (the user is *looking* at the app — exactly when the banner can be seen), so
// this is deliberately much shorter than the background interval.
const FOCUS_CHECK_MIN_GAP_MS = 15 * 60 * 1000
// After system wake, give the network a moment to come back before checking.
// setInterval doesn't fire while the machine sleeps (the 6h cadence stretches —
// observed 6h42m gaps in the field), so wake gets its own trigger.
const RESUME_CHECK_DELAY_MS = 10_000

let currentState: UpdateState = { status: 'idle' }
let getWindow: () => BrowserWindow | null = () => null
let wired = false
let lastCheckStartedAt = 0

function emit(event: UpdaterEvent): void {
  currentState = reduceUpdateState(currentState, event)
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:event', currentState)
  }
}

export function getUpdateState(): UpdateState {
  return currentState
}

export async function checkForUpdates(trigger: CheckTrigger = 'manual'): Promise<void> {
  if (!app.isPackaged) return
  // Once an update is downloaded there is nothing left to check for — and a
  // re-check would re-download the whole zip (autoDownload re-fetches a version
  // it already has: observed ~30 redundant full downloads of one release over 8
  // days in the field) and momentarily knock the "Relaunch" banner out.
  if (currentState.status === 'ready') {
    log.info('updater', 'check skipped: update already downloaded', {
      trigger,
      version: currentState.version,
    })
    return
  }
  const sinceLastCheckMs = lastCheckStartedAt ? Date.now() - lastCheckStartedAt : null
  lastCheckStartedAt = Date.now()
  log.info('updater', 'check started', { trigger, sinceLastCheckMs })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    // checkForUpdates can reject on a transient network failure; the 'error'
    // event also fires, so just log here and let the state machine handle it.
    log.warn('updater', 'checkForUpdates threw', {
      trigger,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  log.info('updater', 'quitAndInstall requested', { version: currentState.version })
  // isSilent=false → show the standard install UI; isForceRunAfter=true → relaunch
  // so installer.ts's ensureRegistered re-registers the (bumped) appex.
  autoUpdater.quitAndInstall(false, true)
}

/**
 * Wire up auto-update. Called once after the window is created. Safe to call
 * with a fresh window getter on later launches; listeners are attached once.
 */
export function initUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
  if (wired) return
  wired = true

  if (!app.isPackaged) {
    log.info('updater', 'auto-update disabled (dev / unpackaged build)')
    return
  }

  // Pipe electron-updater's own logs into our structured logger so they land in
  // the same file + error reports.
  autoUpdater.logger = {
    info: (m?: unknown) => log.info('updater', String(m)),
    warn: (m?: unknown) => log.warn('updater', String(m)),
    error: (m?: unknown) => log.error('updater', String(m)),
    debug: (m?: unknown) => log.debug('updater', String(m)),
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emit({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => emit({ type: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => emit({ type: 'not-available' }))
  autoUpdater.on('download-progress', (p) => emit({ type: 'progress', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    // The moment the "Relaunch to update" banner becomes possible — log the
    // time from check start so time-to-banner is measurable per release.
    log.info('updater', 'update downloaded (banner ready)', {
      version: info.version,
      sinceCheckStartMs: lastCheckStartedAt ? Date.now() - lastCheckStartedAt : null,
    })
    emit({ type: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) =>
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
  )

  log.info('updater', 'auto-update enabled', { version: app.getVersion() })
  setTimeout(() => void checkForUpdates('launch'), INITIAL_CHECK_DELAY_MS)
  // Background fallback. setInterval doesn't tick during system sleep, so this
  // alone can stretch far past 6h — the focus/resume triggers below are what
  // keep discovery timely for a machine that sleeps or an app left open.
  setInterval(() => void checkForUpdates('interval'), RECHECK_INTERVAL_MS)

  // The user just brought the app to the front — the one moment the banner is
  // actually visible. Throttled so window-hopping doesn't hammer the feed.
  app.on('browser-window-focus', () => {
    if (Date.now() - lastCheckStartedAt < FOCUS_CHECK_MIN_GAP_MS) return
    void checkForUpdates('focus')
  })

  // System wake: the interval timer was suspended and may be hours away from
  // its next tick; check shortly after the network is back instead.
  powerMonitor.on('resume', () => {
    setTimeout(() => {
      if (Date.now() - lastCheckStartedAt < FOCUS_CHECK_MIN_GAP_MS) return
      void checkForUpdates('resume')
    }, RESUME_CHECK_DELAY_MS)
  })
}
