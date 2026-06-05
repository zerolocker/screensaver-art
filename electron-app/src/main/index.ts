import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { stat, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getStatus, install, uninstall, activate, openSystemSettings } from './installer'
import { syncGallery, clearCache, PATHS, type CachedManifest } from './cache-sync'
import { log, installGlobalHandlers, recordRendererLog, getLogFilePath } from './logger'
import { sendReport, type SendReportInput } from './report'

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
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
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
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('cache:getDir', () => PATHS.CACHE_DIR)

ipcMain.handle(
  'cache:sync',
  async (_evt, payload: { apiUrl: string; accessToken: string | null }): Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }> => {
    try {
      const manifest = await syncGallery(payload.apiUrl, payload.accessToken, mainWindow)
      return { ok: true, manifest }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('cache-sync', 'sync failed', { error: message })
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle('installer:status', () => getStatus())
ipcMain.handle('installer:install', () => install())
ipcMain.handle('installer:uninstall', () => uninstall())
ipcMain.handle('installer:activate', () => activate())
ipcMain.handle('installer:openSystemSettings', () => {
  openSystemSettings()
  return { ok: true }
})

ipcMain.handle('shell:openExternal', (_evt, url: string) => shell.openExternal(url))
ipcMain.handle('shell:openPath', (_evt, path: string) => shell.openPath(path))

// App info — version comes from the bundled package.json (release.sh bumps it).
ipcMain.handle('app:getVersion', () => app.getVersion())

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

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
