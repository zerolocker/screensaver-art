// Background auto-update: download new releases silently, then show a
// "Relaunch to update" banner. Squirrel.Mac needs a Developer ID signed build,
// so this is a no-op unless packaged. Updates come from the website's /updates
// feed (the `publish` block in electron-builder.cjs). After the relaunch,
// installer.ts re-registers the updated appex.

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

// autoUpdater events without Electron types, so the reducer is testable.
export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/**
 * Fold an updater event into the UI state. Downloads start automatically, so
 * `available` goes straight to `downloading`. `ready` shows the banner and is
 * sticky: only a different version can replace it.
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

// Logged with every check, to measure time-to-banner after a release.
export type CheckTrigger = 'launch' | 'interval' | 'focus' | 'resume' | 'manual'

const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const INITIAL_CHECK_DELAY_MS = 3_000
// Check on window focus (when the banner can be seen), at most this often.
const FOCUS_CHECK_MIN_GAP_MS = 15 * 60 * 1000
// After wake, let the network come back first.
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
  // Once downloaded, a re-check would download the whole zip again.
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
    // The 'error' event also fires and updates the state.
    log.warn('updater', 'checkForUpdates threw', {
      trigger,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  log.info('updater', 'quitAndInstall requested', { version: currentState.version })
  // Relaunch after installing, so the updated appex gets re-registered.
  autoUpdater.quitAndInstall(false, true)
}

/** Set up auto-update once; later calls only replace the window getter. */
export function initUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
  if (wired) return
  wired = true

  if (!app.isPackaged) {
    log.info('updater', 'auto-update disabled (dev / unpackaged build)')
    return
  }

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
  // setInterval pauses during sleep, hence the focus and wake triggers below.
  setInterval(() => void checkForUpdates('interval'), RECHECK_INTERVAL_MS)

  app.on('browser-window-focus', () => {
    if (Date.now() - lastCheckStartedAt < FOCUS_CHECK_MIN_GAP_MS) return
    void checkForUpdates('focus')
  })

  powerMonitor.on('resume', () => {
    setTimeout(() => {
      if (Date.now() - lastCheckStartedAt < FOCUS_CHECK_MIN_GAP_MS) return
      void checkForUpdates('resume')
    }, RESUME_CHECK_DELAY_MS)
  })
}
