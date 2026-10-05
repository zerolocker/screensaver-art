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
    // Wide enough for several gallery columns.
    width: 1280,
    height: 880,
    minWidth: 960,
    minHeight: 680,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#141414',
    // Packaged macOS builds use the bundle's .icns; dev runs need the PNG.
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
// Cache stats
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

// For a renderer that mounts while a sync is already running.
ipcMain.handle('cache:getSyncState', () => ({ syncing: isSyncing() }))

ipcMain.handle(
  'cache:sync',
  async (_evt, payload: { apiUrl: string; accessToken: string | null; pruneDeselected?: boolean }): Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }> => {
    // The first authenticated action each launch: link the device to the user.
    const userId = userIdFromToken(payload.accessToken)
    if (userId) identifyUser(userId, emailFromToken(payload.accessToken))
    try {
      // The renderer saves the selection (selection:set) before syncing.
      // `pruneDeselected` is set by a manual "Sync Now".
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

// The pieces the user chose to play. Null means never customized (the free
// pieces). The renderer writes the full list on every change.
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

// The appex version we last registered, kept in userData so it survives updates.
// A read or write failure only costs an extra re-register.
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

// Called once per launch by the renderer, after sign-in.
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

// For the "Screensaver is set" banner. macOS only.
ipcMain.handle('screensaver:timing', () => getScreensaverTiming())
ipcMain.handle('screensaver:preview', () => startScreensaverPreview())

// ---------------------------------------------------------------------------
// Auto-update. No-op unless packaged.
// ---------------------------------------------------------------------------
ipcMain.handle('update:getState', () => getUpdateState())
ipcMain.handle('update:check', () => checkForUpdates('manual'))
ipcMain.handle('update:quitAndInstall', () => quitAndInstall())

ipcMain.handle('shell:openExternal', (_evt, url: string) => shell.openExternal(url))
ipcMain.handle('shell:openPath', (_evt, path: string) => shell.openPath(path))

// The gallery's "Fullscreen" preview mode.
ipcMain.handle('window:setFullScreen', (_evt, value: boolean) => {
  mainWindow?.setFullScreen(Boolean(value))
})

ipcMain.handle('app:getVersion', () => app.getVersion())

// Recovery action on the "screensaver component missing" screen.
ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0)
})

// ---------------------------------------------------------------------------
// Logging + error reporting
// ---------------------------------------------------------------------------
// The renderer forwards its logs here, so one report covers both processes.
ipcMain.handle('log:record', (_evt, entry: { level?: 'debug' | 'info' | 'warn' | 'error'; scope?: string; msg?: string; data?: unknown }) => {
  recordRendererLog(entry)
})
ipcMain.handle('log:getFilePath', () => getLogFilePath())

ipcMain.handle('report:send', (_evt, input: SendReportInput) => sendReport(input))

ipcMain.handle('feedback:send', async (_evt, input: SendFeedbackInput) => {
  const result = await sendFeedback(input)
  if (result.ok) capture('feedback_submitted', { source: 'app', has_image: Boolean(input.image) })
  return result
})

// The renderer has no PostHog SDK; its events go through here so they share
// the main process's identity.
ipcMain.handle('analytics:capture', (_evt, event: string, properties?: Record<string, unknown>) => {
  if (typeof event === 'string' && event) capture(event, properties)
})

// On sign-out, start a fresh anonymous identity.
ipcMain.handle('analytics:reset', () => {
  resetIdentity()
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
// On Windows/Linux the OAuth deep link arrives as argv to a second launch,
// which the first instance receives via 'second-instance'.
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
    initUpdater(() => mainWindow)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    // Anonymous until a sync identifies the user.
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

  // Stop any sync so quitting isn't delayed. It can't corrupt the cache, and the
  // next launch resumes.
  app.on('before-quit', () => {
    cancelSync()
    void shutdownPosthog()
  })
}
