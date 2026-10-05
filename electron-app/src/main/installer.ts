// Registers the .appex embedded in this app (Contents/PlugIns/) with macOS and
// sets it as the active screensaver. All pluginkit and active-screensaver work
// goes through the PaperSaver helper (lart-screensaver-helper).

import { spawn, execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { log } from './logger'

const APPEX_NAME = 'ScreensaverArtExtension.appex'
const HELPER_NAME = 'lart-screensaver-helper'
const EXTENSION_BUNDLE_ID = 'com.livingart.screensaver.app.Extension'

type RunResult = { code: number; stdout: string; stderr: string }

function defaultRun(cmd: string, args: ReadonlyArray<string>): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(cmd, args as string[], { timeout: 20000 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: number }) | null
      const code = e && typeof e.code === 'number' ? e.code : e ? 1 : 0
      resolve({ code, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' })
    })
  })
}

// Test seam: vi.mock on Node built-ins doesn't reach sibling modules, so tests
// swap these instead. `spawn` is fire-and-forget; `run` captures output.
export const _testHooks: {
  spawn: typeof spawn
  run: typeof defaultRun
  // `pluginkit -a` registers asynchronously, so poll `find` before giving up.
  confirmRetries: number
  confirmDelayMs: number
} = {
  spawn,
  run: defaultRun,
  confirmRetries: 6,
  confirmDelayMs: 800,
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Not on PATH.
const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

function runHelper(args: ReadonlyArray<string>): Promise<RunResult> {
  return _testHooks.run(helperPath(), args as string[])
}

// In dev, run `bash scripts/bundle-appex.sh` from electron-app/ first.
function bundledAppexPath(): string {
  if (process.env.LART_APPEX_PATH) return process.env.LART_APPEX_PATH // test seam
  if (app.isPackaged) return join(process.resourcesPath, '..', 'PlugIns', APPEX_NAME)
  // Dev: pluginkit only accepts an appex inside a .app, so use the copy in the
  // DevHost.app that bundle-appex.sh builds. (../../.. is the repo root.)
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
  // Only macOS is supported; everything below is false elsewhere.
  supported: boolean
  // False means a damaged install; the renderer shows a recovery screen.
  bundledExtensionExists: boolean
  // pluginkit knows our extension (it shows in System Settings).
  registered: boolean
  // Registered and set as the active screensaver.
  active: boolean
  // The path pluginkit has on file, for spotting a stale registration.
  registeredPath: string | null
}

// Whether pluginkit knows our extension, and the path it has on file.
async function queryRegistration(): Promise<{ registered: boolean; registeredPath: string | null }> {
  try {
    const { code, stdout, stderr } = await runHelper(['find', EXTENSION_BUNDLE_ID])
    if (code !== 0) {
      log.warn('installer', 'helper find exited non-zero', { code, stderr: stderr.trim() })
      return { registered: false, registeredPath: null }
    }
    const parsed = JSON.parse(stdout.trim())
    return {
      registered: parsed.registered === true,
      registeredPath: typeof parsed.path === 'string' ? parsed.path : null,
    }
  } catch (err) {
    log.warn('installer', 'helper find failed', { error: err instanceof Error ? err.message : String(err) })
    return { registered: false, registeredPath: null }
  }
}

// Ask the PaperSaver helper whether our screensaver is the active one.
async function isActive(): Promise<boolean> {
  try {
    const { code, stdout } = await runHelper(['status'])
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
  const [{ registered, registeredPath }, rawActive] = await Promise.all([queryRegistration(), isActive()])
  // The system preference can still name us after we're unregistered, but an
  // unregistered appex can't run, so it isn't really active.
  const active = registered && rawActive
  return { platform: process.platform, supported, bundledExtensionExists, registered, active, registeredPath }
}

// Kill anything running the old extension code before re-registering. Best effort.
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

// The bundled appex's CFBundleVersion (stamped from the app version at build
// time), or null if unreadable.
async function bundledAppexVersion(): Promise<string | null> {
  const plist = join(bundledAppexPath(), 'Contents', 'Info.plist')
  try {
    const { code, stdout } = await _testHooks.run('/usr/libexec/PlistBuddy', [
      '-c', 'Print :CFBundleVersion', plist,
    ])
    if (code !== 0) return null
    return stdout.trim() || null
  } catch {
    return null
  }
}

// <App>.app/Contents/PlugIns/<name>.appex → <App>.app
function appBundlePathFromAppex(appex: string): string {
  return join(appex, '..', '..', '..')
}

// After an in-place auto-update, LaunchServices can keep the old bundle cached,
// and then `pluginkit -a` silently does nothing. Re-registering the app with
// LaunchServices first prevents that. Best effort.
async function forceLaunchServicesRegister(appPath: string): Promise<void> {
  try {
    const { code, stderr } = await _testHooks.run(LSREGISTER, ['-f', appPath])
    log.info('installer', 'lsregister -f app bundle', {
      appPath,
      code,
      stderr: stderr.trim() || undefined,
    })
  } catch (err) {
    log.warn('installer', 'lsregister failed (continuing)', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// Register the appex, then poll `find` to confirm: `pluginkit -a` exits at once
// but the registration lands about a second later.
async function registerAppex(appex: string): Promise<{ ok: boolean; error?: string }> {
  const { code, stdout, stderr } = await runHelper(['register', appex])
  let registered = false
  try {
    registered = JSON.parse(stdout.trim()).registered === true
  } catch {
    registered = false
  }
  for (let i = 0; !registered && i < _testHooks.confirmRetries; i++) {
    await delay(_testHooks.confirmDelayMs)
    registered = (await queryRegistration()).registered
  }
  if (!registered) {
    // Show the helper's own report. A bad appex signature also fails silently.
    const detail = stderr.trim() || stdout.trim() || `helper exit ${code}`
    log.error('installer', 'register: not confirmed after polling', {
      code,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      retries: _testHooks.confirmRetries,
    })
    return { ok: false, error: `Failed to register the screensaver (${detail}).` }
  }
  log.info('installer', 'register: confirmed')
  return { ok: true }
}

export interface EnsureResult {
  ok: boolean
  error?: string
  registered: boolean
  // The bundled appex version, for the caller to save after a successful register.
  version: string | null
  didRegister: boolean
}

// Run on every launch. Registers the appex if it isn't registered, or if the app
// was updated since `lastRegisteredVersion` (null if never registered).
// pluginkit caches by CFBundleVersion, which is why the version is stamped.
export async function ensureRegistered(lastRegisteredVersion: string | null): Promise<EnsureResult> {
  if (process.platform !== 'darwin') {
    return { ok: true, registered: false, version: null, didRegister: false }
  }
  const appex = bundledAppexPath()
  if (!existsSync(appex)) {
    log.error('installer', 'ensureRegistered: bundled appex missing', { appex })
    return { ok: false, error: `Bundled screensaver missing at ${appex}.`, registered: false, version: null, didRegister: false }
  }

  const version = await bundledAppexVersion()
  const { registered } = await queryRegistration()

  // Up to date. If the version is unreadable, don't re-register (and kill
  // System Settings) on every launch.
  if (registered && (version === null || lastRegisteredVersion === version)) {
    return { ok: true, registered: true, version, didRegister: false }
  }

  log.info('installer', 'ensureRegistered: (re)registering appex', {
    appex, version, lastRegisteredVersion, wasRegistered: registered,
  })
  await killScreensaverProcesses()
  await forceLaunchServicesRegister(appBundlePathFromAppex(appex))
  const result = await registerAppex(appex)
  if (!result.ok) {
    return { ok: false, error: result.error, registered: false, version, didRegister: false }
  }
  return { ok: true, registered: true, version, didRegister: true }
}

// One-click "Set as your screensaver".
export async function activate(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Not supported on ${process.platform}.` }
  }
  log.info('installer', 'activate: setting active screensaver')
  const { code, stderr } = await _testHooks.run(helperPath(), ['activate'])
  if (code !== 0) {
    log.error('installer', 'activate failed', { code, stderr: stderr.trim() })
    return { ok: false, error: stderr.trim() || `Could not set the screensaver (helper exit ${code}).` }
  }
  return { ok: true }
}

// Diagnostics for error reports, including the appex signature check (the usual
// cause of failed registration). Never throws.
export interface InstallerDiagnostics {
  status: InstallerStatus
  appexPath: string
  codesign: { ok: boolean; output: string } | null
  helperFind: { code: number; stdout: string; stderr: string } | null
}

export async function getDiagnostics(): Promise<InstallerDiagnostics> {
  const status = await getStatus()
  const appexPath = bundledAppexPath()
  if (process.platform !== 'darwin') {
    return { status, appexPath, codesign: null, helperFind: null }
  }
  let codesign: { ok: boolean; output: string } | null = null
  try {
    const { code, stderr, stdout } = await _testHooks.run('/usr/bin/codesign', [
      '--verify', '--deep', '--strict', '--verbose=2', appexPath,
    ])
    codesign = { ok: code === 0, output: (stderr + stdout).trim() }
  } catch (err) {
    codesign = { ok: false, output: err instanceof Error ? err.message : String(err) }
  }
  let helperFind: { code: number; stdout: string; stderr: string } | null = null
  try {
    const r = await runHelper(['find', EXTENSION_BUNDLE_ID])
    helperFind = { code: r.code, stdout: r.stdout.trim(), stderr: r.stderr.trim() }
  } catch {
    helperFind = null
  }
  log.debug('installer', 'diagnostics gathered', { codesignOk: codesign?.ok, registered: status.registered })
  return { status, appexPath, codesign, helperFind }
}
