import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
const is = { dev: !app.isPackaged }
import { stat, readdir, rm, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'

// ---------------------------------------------------------------------------
// Cache paths
// ---------------------------------------------------------------------------
function getCacheDir(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'ScreensaverArt')
  }
  // Windows: %LOCALAPPDATA%\ScreensaverArt
  return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ScreensaverArt')
}

const CACHE_DIR = getCacheDir()
const VIDEOS_DIR = join(CACHE_DIR, 'videos')

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#141414',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR in dev, load built files in production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// IPC: Cache management
// ---------------------------------------------------------------------------
async function getDirSize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) return 0
  let total = 0
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dirPath, entry.name)
    if (entry.isFile()) {
      const s = await stat(full)
      total += s.size
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

ipcMain.handle('cache:getStats', async () => {
  const size = await getDirSize(VIDEOS_DIR)
  const count = await countFiles(VIDEOS_DIR)
  return { sizeBytes: size, fileCount: count, path: VIDEOS_DIR }
})

ipcMain.handle('cache:clear', async () => {
  if (existsSync(VIDEOS_DIR)) {
    await rm(VIDEOS_DIR, { recursive: true, force: true })
    await mkdir(VIDEOS_DIR, { recursive: true })
  }
  return { success: true }
})

ipcMain.handle('cache:getDir', () => CACHE_DIR)

ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('shell:openPath', (_event, path: string) => {
  return shell.openPath(path)
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // Ensure cache dir exists
  if (!existsSync(VIDEOS_DIR)) {
    mkdir(VIDEOS_DIR, { recursive: true }).catch(() => {})
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
