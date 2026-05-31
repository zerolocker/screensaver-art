// Screensaver installer — registers the macOS .appex screensaver extension
// (bundled inside this Electron app) with the system via `pluginkit`, and
// drives the one-click "Set as your screensaver" flow via the PaperSaver helper.
//
// The user runs ONE installer (this Electron app). The .appex is embedded in
// the app bundle's Contents/PlugIns/; we register it with pluginkit and let the
// user activate it (either one-click via the helper, or in System Settings).

import { spawn, execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const APPEX_NAME = 'ScreensaverArtExtension.appex'
const HELPER_NAME = 'lart-screensaver-helper'
const EXTENSION_BUNDLE_ID = 'com.livingart.screensaver.app.Extension'
const SCREENSAVER_POINT = 'com.apple.screensaver'

type RunResult = { code: number; stdout: string; stderr: string }

// Default output-capturing runner (pluginkit queries, helper calls).
function defaultRun(cmd: string, args: ReadonlyArray<string>): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(cmd, args as string[], { timeout: 20000 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: number }) | null
      const code = e && typeof e.code === 'number' ? e.code : e ? 1 : 0
      resolve({ code, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' })
    })
  })
}

// Indirection layer so tests can swap spawn/run without touching the dev
// machine's real `killall` / `pluginkit` / helper. vi.mock on Node built-ins
// doesn't propagate transitively into sibling modules under vitest, so an
// override hook is the simplest reliable seam. `spawn` is fire-and-forget
// (killall, open); `run` captures stdout/stderr/exit code.
export const _testHooks: { spawn: typeof spawn; run: typeof defaultRun } = {
  spawn,
  run: defaultRun,
}

// Where the appex / helper live inside the packaged Electron app vs. dev mode.
// In dev, run `bash scripts/bundle-appex.sh` from electron-app/ first.
function bundledAppexPath(): string {
  if (process.env.LART_APPEX_PATH) return process.env.LART_APPEX_PATH // test seam
  // Packaged: electron-builder embeds the appex in Contents/PlugIns/ (next to
  // Contents/Resources, which is process.resourcesPath).
  if (app.isPackaged) return join(process.resourcesPath, '..', 'PlugIns', APPEX_NAME)
  // Dev (unpackaged): a standalone .appex can't be registered — pluginkit only
  // accepts an appex embedded inside a .app bundle. `bundle-appex.sh` builds the
  // DevHost.app scaffold (Release) with the appex embedded, so register THAT
  // copy. (__dirname is electron-app/out/main → ../../.. is the repo root.)
  return join(
    __dirname, '..', '..', '..',
    'screensaver-macos', 'build', 'Build', 'Products', 'Release',
    'DevHost.app', 'Contents', 'PlugIns', APPEX_NAME,
  )
}

function helperPath(): string {
  if (process.env.LART_HELPER_PATH) return process.env.LART_HELPER_PATH // test seam
  if (app.isPackaged) return join(process.resourcesPath, HELPER_NAME)
  return join(__dirname, '..', '..', 'resources', HELPER_NAME)
}

export type InstallerStatus = {
  platform: NodeJS.Platform
  supported: boolean
  // The appex is present in this app's resources/PlugIns (so install can run).
  bundledExtensionExists: boolean
  // pluginkit knows about our extension.
  registered: boolean
  // PaperSaver reports our screensaver as the active one (banner gates on this).
  active: boolean
  registeredPath: string | null
}

// Parse `pluginkit -m -v -p com.apple.screensaver` for our extension.
// Line format: `+    com.livingart.screensaver.app.Extension(1.0.0)\t<uuid>\t<date>\t<path>`
async function queryRegistration(): Promise<{ registered: boolean; registeredPath: string | null }> {
  try {
    const { stdout } = await _testHooks.run('/usr/bin/pluginkit', ['-m', '-v', '-p', SCREENSAVER_POINT])
    for (const line of stdout.split('\n')) {
      if (line.includes(EXTENSION_BUNDLE_ID)) {
        const slash = line.indexOf('/')
        return { registered: true, registeredPath: slash >= 0 ? line.slice(slash).trim() : null }
      }
    }
  } catch {
    // pluginkit missing or errored — treat as not registered.
  }
  return { registered: false, registeredPath: null }
}

// Ask the PaperSaver helper whether our screensaver is the active one.
async function isActive(): Promise<boolean> {
  try {
    const { code, stdout } = await _testHooks.run(helperPath(), ['status'])
    if (code !== 0) return false
    return JSON.parse(stdout.trim()).active === true
  } catch {
    return false
  }
}

export async function getStatus(): Promise<InstallerStatus> {
  const supported = process.platform === 'darwin'
  if (!supported) {
    return {
      platform: process.platform,
      supported: false,
      bundledExtensionExists: false,
      registered: false,
      active: false,
      registeredPath: null,
    }
  }
  const bundledExtensionExists = existsSync(bundledAppexPath())
  const [{ registered, registeredPath }, active] = await Promise.all([queryRegistration(), isActive()])
  return { platform: process.platform, supported, bundledExtensionExists, registered, active, registeredPath }
}

// Kill anything that may have the old extension code mapped, so a re-register
// picks up fresh code. Best-effort; failures are ignored.
function killScreensaverProcesses(): Promise<void> {
  return new Promise((resolve) => {
    const cmd = `
      killall ScreensaverArtExtension 2>/dev/null || true
      killall ScreenSaverEngine       2>/dev/null || true
      killall 'System Settings'       2>/dev/null || true
      killall legacyScreenSaver       2>/dev/null || true
    `
    const proc = _testHooks.spawn('sh', ['-c', cmd])
    proc.on('exit', () => setTimeout(resolve, 500))
  })
}

export async function install(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Screensaver install is not supported on ${process.platform} yet.` }
  }
  const appex = bundledAppexPath()
  if (!existsSync(appex)) {
    return { ok: false, error: `Bundled screensaver missing at ${appex}. Run scripts/bundle-appex.sh.` }
  }

  await killScreensaverProcesses()
  const { code, stderr } = await _testHooks.run('/usr/bin/pluginkit', ['-a', appex])

  // pluginkit can exit non-zero in benign cases, so confirm via a re-query
  // rather than trusting the exit code alone.
  const { registered } = await queryRegistration()
  if (!registered) {
    return { ok: false, error: `pluginkit failed to register the screensaver (exit ${code})${stderr ? `: ${stderr.trim()}` : ''}.` }
  }
  return { ok: true }
}

export async function uninstall(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Not supported on ${process.platform}.` }
  }
  await killScreensaverProcesses()
  // Prefer the path pluginkit actually has registered; fall back to ours.
  const { registeredPath } = await queryRegistration()
  const target = registeredPath || bundledAppexPath()
  await _testHooks.run('/usr/bin/pluginkit', ['-r', target])
  return { ok: true }
}

// One-click "Set as your screensaver" via the PaperSaver helper.
export async function activate(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Not supported on ${process.platform}.` }
  }
  const { code, stderr } = await _testHooks.run(helperPath(), ['activate'])
  if (code !== 0) {
    return { ok: false, error: stderr.trim() || `Could not set the screensaver (helper exit ${code}).` }
  }
  return { ok: true }
}

export function openSystemSettings(): void {
  if (process.platform !== 'darwin') return
  const cmd = `
    open 'x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension' 2>/dev/null ||
    open 'x-apple.systempreferences:com.apple.preference.screensaver'          2>/dev/null ||
    open -a 'System Settings'                                                   2>/dev/null ||
    open -a 'System Preferences'                                                2>/dev/null ||
    true
  `
  _testHooks.spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }).unref()
}
