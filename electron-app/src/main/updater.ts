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

import { app, type BrowserWindow } from 'electron'
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
 */
export function reduceUpdateState(prev: UpdateState, event: UpdaterEvent): UpdateState {
  switch (event.type) {
    case 'checking':
      return { status: 'checking', version: prev.version }
    case 'available':
      return { status: 'downloading', version: event.version, percent: 0 }
    case 'not-available':
      return { status: 'idle' }
    case 'progress':
      return { status: 'downloading', version: prev.version, percent: event.percent }
    case 'downloaded':
      return { status: 'ready', version: event.version }
    case 'error':
      return { status: 'error', version: prev.version, error: event.message }
  }
}

const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // re-check every 6 hours while running
const INITIAL_CHECK_DELAY_MS = 3_000 // let the window settle before the first check

let currentState: UpdateState = { status: 'idle' }
let getWindow: () => BrowserWindow | null = () => null
let wired = false

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

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    // checkForUpdates can reject on a transient network failure; the 'error'
    // event also fires, so just log here and let the state machine handle it.
    log.warn('updater', 'checkForUpdates threw', {
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
  autoUpdater.on('update-downloaded', (info) => emit({ type: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) =>
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
  )

  log.info('updater', 'auto-update enabled', { version: app.getVersion() })
  setTimeout(() => void checkForUpdates(), INITIAL_CHECK_DELAY_MS)
  setInterval(() => void checkForUpdates(), RECHECK_INTERVAL_MS)
}
