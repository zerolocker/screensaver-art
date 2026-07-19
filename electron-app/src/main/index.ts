import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { stat, readdir } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getStatus, ensureRegistered, activate } from './installer'
import { getScreensaverTiming, startScreensaverPreview } from './screensaver-timing'
import { syncGallery, cancelSync, isSyncing, clearCache, PATHS, type CachedManifest } from './cache-sync'
import { readSelection, writeSelection } from './selection'
import { initUpdater, getUpdateState, checkForUpdates, quitAndInstall } from './updater'
import { log, installGlobalHandlers, recordRendererLog, getLogFilePath } from './logger'
import { sendReport, sendFeedback, type SendReportInput, type SendFeedbackInput } from './report'
import {
  registerDeepLinkProtocol,
  handleDeepLinkUrl,
  extractDeepLinkFromArgv,
  flushPendingDeepLink,
} from './deeplink'
import {
  capture,
  identifyUser,
  userIdFromToken,
  emailFromToken,
  resetIdentity,
  currentDistinctId,
  shutdownPosthog,
} from './posthog'

const is = { dev: !app.isPackaged }

installGlobalHandlers()
log.info('app', 'main process starting', {
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform,
  arch: process.arch,
  packaged: app.isPackaged,
})

let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow(): void {
  mainWindow = new BrowserWindow({
    // Roomy default so the gallery shows several columns at once (the selection
    // grid is the main surface users browse).
    width: 1280,
    height: 880,
    minWidth: 960,
    minHeight: 680,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#141414',
    // macOS uses the .icns baked into the .app bundle (via electron-builder
    // and build/icon.png). For Windows/Linux dev runs, point at the same
    // source PNG so window/taskbar icons are branded.
    icon: is.dev ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  // Deliver any OAuth deep link that arrived before the renderer was ready.
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) flushPendingDeepLink(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// Cache stats — reads from the directory the Swift screensaver reads from
// ---------------------------------------------------------------------------
async function getDirSize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) return 0
  let total = 0
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dirPath, entry.name)
    if (entry.isFile()) {
      total += (await stat(full)).size
    } else if (entry.isDirectory()) {
      total += await getDirSize(full)
    }
  }
  return total
}

async function countFiles(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) return 0
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries.filter((e) => e.isFile()).length
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('cache:getStats', async () => {
  // The cache lives at /Users/Shared/LivingArtScreensaver — our own shared
  // directory, not another app's container — so there's no TCC prompt to
  // explain or recover from anymore.
  const sizeBytes = await getDirSize(PATHS.VIDEOS_DIR)
  const fileCount = await countFiles(PATHS.VIDEOS_DIR)
  return { sizeBytes, fileCount, path: PATHS.VIDEOS_DIR }
})

ipcMain.handle('cache:clear', async () => {
  try {
    await clearCache()
    capture('cache_cleared')
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('cache:getDir', () => PATHS.CACHE_DIR)

// Lets a renderer that mounts mid-sync (e.g. the auto-sync kicked off before the
// Account tab was opened) reflect the in-progress state instead of showing an
// idle "Sync Now" button.
ipcMain.handle('cache:getSyncState', () => ({ syncing: isSyncing() }))

ipcMain.handle(
  'cache:sync',
  async (_evt, payload: { apiUrl: string; accessToken: string | null; pruneDeselected?: boolean }): Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }> => {
    // A sync is the first authenticated action each launch, so it's where we
    // link the device to the signed-in user for analytics.
    const userId = userIdFromToken(payload.accessToken)
    if (userId) identifyUser(userId, emailFromToken(payload.accessToken))
    try {
      // The selection lives in the main process (cache-sync needs it, and the
      // renderer persists it via selection:set before triggering a sync). A null
      // selection means "use the default (the free pieces)". `pruneDeselected`
      // is set on a manual "Sync Now" so it tidies deselected files off disk; an
      // auto sync leaves them cached for instant re-add.
      const manifest = await syncGallery(
        payload.apiUrl,
        payload.accessToken,
        mainWindow,
        readSelection(),
        payload.pruneDeselected ?? false,
      )
      capture('gallery_synced', {
        item_count: manifest.items.length,
        is_subscribed: manifest.isSubscribed,
        pruned: payload.pruneDeselected ?? false,
      })
      return { ok: true, manifest }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('cache-sync', 'sync failed', { error: message })
      capture('gallery_sync_failed', { error: message })
      return { ok: false, error: message }
    }
  },
)

// Selection: which gallery pieces the user has chosen to play. The renderer reads
// it to paint ticks (null → it applies the default free pieces itself) and
// writes the full explicit list on every change.
ipcMain.handle('selection:get', () => ({ selected: readSelection() }))
ipcMain.handle('selection:set', (_evt, selected: string[]) => {
  try {
    writeSelection(Array.isArray(selected) ? selected : [])
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('selection', 'could not write selection', { error: message })
    return { ok: false, error: message }
  }
})

ipcMain.handle('installer:status', () => getStatus())

// Records which appex version we last registered, so ensureRegistered can tell
// "already current" from "the app was updated, re-register". Lives in userData
// (not the bundle) so it survives app updates. Best-effort: a read/write failure
// just means we re-register once more than strictly necessary.
const INSTALLER_STATE_FILE = join(app.getPath('userData'), 'installer-state.json')
function readRegisteredVersion(): string | null {
  try {
    const v = JSON.parse(readFileSync(INSTALLER_STATE_FILE, 'utf8')).registeredAppexVersion
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}
function writeRegisteredVersion(version: string | null): void {
  try {
    writeFileSync(INSTALLER_STATE_FILE, JSON.stringify({ registeredAppexVersion: version }))
  } catch (err) {
    log.warn('installer', 'could not persist registered appex version', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// Auto-register the screensaver (called once per launch by the renderer, post
// sign-in). Persists the version only when we actually (re)registered.
ipcMain.handle('installer:ensureRegistered', async () => {
  const result = await ensureRegistered(readRegisteredVersion())
  if (result.ok && result.didRegister) {
    writeRegisteredVersion(result.version)
    capture('screensaver_registered', { version: result.version })
  }
  return { ok: result.ok, error: result.error, registered: result.registered }
})

ipcMain.handle('installer:activate', async () => {
  const result = await activate()
  if (result.ok) capture('screensaver_activated')
  return result
})

// Reads the macOS idle thresholds the "Screensaver is set" banner explains, and
// starts the screensaver on demand for an instant preview. macOS-only; both
// degrade to null / a not-supported error elsewhere.
ipcMain.handle('screensaver:timing', () => getScreensaverTiming())
ipcMain.handle('screensaver:preview', () => startScreensaverPreview())

// ---------------------------------------------------------------------------
// Auto-update (electron-updater). No-op in dev / unpackaged builds.
// ---------------------------------------------------------------------------
ipcMain.handle('update:getState', () => getUpdateState())
ipcMain.handle('update:check', () => checkForUpdates('manual'))
ipcMain.handle('update:quitAndInstall', () => quitAndInstall())

ipcMain.handle('shell:openExternal', (_evt, url: string) => shell.openExternal(url))
ipcMain.handle('shell:openPath', (_evt, path: string) => shell.openPath(path))

// Lets the gallery's "Fullscreen" preview mode push the app window into native
// macOS fullscreen so a piece fills the whole display. (Native fullscreen has
// an unavoidable ~0.5s Space animation; users who dislike it can switch the
// preview to "In-app" in the gallery options menu, which never calls this.)
ipcMain.handle('window:setFullScreen', (_evt, value: boolean) => {
  mainWindow?.setFullScreen(Boolean(value))
})

// App info — version comes from the bundled package.json (release.sh bumps it).
ipcMain.handle('app:getVersion', () => app.getVersion())

// Relaunch the app — the recovery action on the "screensaver component missing"
// screen (a fresh launch re-runs the auto-register).
ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0)
})

// ---------------------------------------------------------------------------
// Logging + error reporting
// ---------------------------------------------------------------------------
// Renderer forwards its logs + uncaught errors here so a single report captures
// both processes.
ipcMain.handle('log:record', (_evt, entry: { level?: 'debug' | 'info' | 'warn' | 'error'; scope?: string; msg?: string; data?: unknown }) => {
  recordRendererLog(entry)
})
ipcMain.handle('log:getFilePath', () => getLogFilePath())

// Assemble a debug snapshot and upload it to the website's error-report bucket.
ipcMain.handle('report:send', (_evt, input: SendReportInput) => sendReport(input))

// Upload user feedback (message + optional image) with the same diagnostics block.
ipcMain.handle('feedback:send', async (_evt, input: SendFeedbackInput) => {
  const result = await sendFeedback(input)
  if (result.ok) capture('feedback_submitted', { source: 'app', has_image: Boolean(input.image) })
  return result
})

// Renderer → main analytics bridge. The renderer has no PostHog SDK; it forwards
// UI events here so they're captured with the same device/user identity as the
// main-process events (one person in PostHog). Best-effort; never throws.
ipcMain.handle('analytics:capture', (_evt, event: string, properties?: Record<string, unknown>) => {
  if (typeof event === 'string' && event) capture(event, properties)
})

// The renderer signals sign-out here so we drop the current identity and mint a
// fresh anonymous device id — keeping accounts separate when more than one signs
// in on the same machine (see `resetIdentity`).
ipcMain.handle('analytics:reset', () => {
  resetIdentity()
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
// A single instance lock is required for OAuth deep links on Windows/Linux,
// where the callback URL is delivered as argv to a *second* launch. The first
// (primary) instance receives it via the 'second-instance' event.
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  registerDeepLinkProtocol()

  // macOS: the deep link arrives as an event on the running instance.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLinkUrl(url, () => mainWindow)
  })

  // Windows/Linux: a second launch carries the URL in argv; forward + focus.
  app.on('second-instance', (_event, argv) => {
    const url = extractDeepLinkFromArgv(argv)
    if (url) handleDeepLinkUrl(url, () => mainWindow)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Windows/Linux cold start: launched directly via the deep link.
  const coldStartUrl = extractDeepLinkFromArgv(process.argv)
  if (coldStartUrl) handleDeepLinkUrl(coldStartUrl, () => mainWindow)

  app.whenReady().then(() => {
    createWindow()
    // Start checking for updates in the background (downloads silently, then the
    // renderer shows a "Relaunch to update" banner). No-op unless packaged.
    initUpdater(() => mainWindow)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    // Anonymous until a sync identifies the user (see cache:sync) — keyed off the
    // stable device id, so first-launch funnels stay intact.
    capture('app_launched', {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      packaged: app.isPackaged,
    }, currentDistinctId())
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Abort any in-flight sync on quit. The manifest is written before downloads and
  // each video is written via a temp file + atomic rename, so an interrupted sync
  // can't corrupt the cache — cancelSync just stops the in-flight fetch/stream
  // promptly so quit isn't delayed. The next launch auto-syncs and resumes.
  app.on('before-quit', () => {
    cancelSync()
    // Best-effort flush of any queued analytics before the process exits.
    void shutdownPosthog()
  })
}
