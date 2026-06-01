// Screensaver installer — registers the macOS .appex screensaver extension
// (bundled inside this Electron app) with the system, and drives the one-click
// "Set as your screensaver" flow. Everything that touches pluginkit (register /
// unregister / discover) or the active-screensaver store goes through the
// PaperSaver helper (lart-screensaver-helper, backed by PaperSaverKit), so this
// process never shells out to `pluginkit` directly or parses its output.
//
// The user runs ONE installer (this Electron app). The .appex is embedded in
// the app bundle's Contents/PlugIns/; the helper registers it and the user
// activates it (either one-click via the helper, or in System Settings).

import { spawn, execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { log } from './logger'

const APPEX_NAME = 'ScreensaverArtExtension.appex'
const HELPER_NAME = 'lart-screensaver-helper'
const EXTENSION_BUNDLE_ID = 'com.livingart.screensaver.app.Extension'

type RunResult = { code: number; stdout: string; stderr: string }

// Default output-capturing runner (helper calls).
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
// machine's real `killall` / helper. vi.mock on Node built-ins doesn't
// propagate transitively into sibling modules under vitest, so an override
// hook is the simplest reliable seam. `spawn` is fire-and-forget (killall,
// open); `run` captures stdout/stderr/exit code (helper calls).
export const _testHooks: { spawn: typeof spawn; run: typeof defaultRun } = {
  spawn,
  run: defaultRun,
}

// All pluginkit work is delegated to the PaperSaver helper. This wraps the
// canonical invocation so every call site (status/find/register/unregister/
// activate) goes through the same runner + path resolution.
function runHelper(args: ReadonlyArray<string>): Promise<RunResult> {
  return _testHooks.run(helperPath(), args as string[])
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

// Ask the PaperSaver helper (`find`) whether pluginkit knows our extension and,
// if so, the path it has registered. PaperSaver runs pluginkit and parses its
// output — including the tab-split fix for bundle paths that contain spaces,
// like "Living Art Screensaver.app".
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
    // helper missing or errored — treat as not registered.
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
    log.error('installer', 'bundled appex missing', { appex })
    return { ok: false, error: `Bundled screensaver missing at ${appex}. Run scripts/bundle-appex.sh.` }
  }

  log.info('installer', 'install: registering appex', { appex })
  await killScreensaverProcesses()

  // The helper registers via pluginkit AND re-queries to confirm the extension
  // actually landed (pluginkit -a can report odd exit states), reporting back
  // `{ registered, path }`. Trust that verified result rather than the raw exit.
  const { code, stdout, stderr } = await runHelper(['register', appex])
  let registered = false
  try {
    registered = JSON.parse(stdout.trim()).registered === true
  } catch {
    registered = false
  }
  if (!registered) {
    // Surface the helper's actual report (not just "exit 0") — the most common
    // cause is a broken appex code signature, which pluginkit refuses silently.
    const detail = stderr.trim() || stdout.trim() || `helper exit ${code}`
    log.error('installer', 'install: registration not confirmed', { code, stdout: stdout.trim(), stderr: stderr.trim() })
    return { ok: false, error: `Failed to register the screensaver (${detail}).` }
  }
  log.info('installer', 'install: registered', { stdout: stdout.trim() })
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
  log.info('installer', 'uninstall: unregistering appex', { target })
  const { code, stderr } = await runHelper(['unregister', target])
  if (code !== 0) {
    log.error('installer', 'uninstall failed', { code, stderr: stderr.trim() })
    return { ok: false, error: stderr.trim() || `Could not unregister the screensaver (helper exit ${code}).` }
  }
  return { ok: true }
}

// One-click "Set as your screensaver" via the PaperSaver helper.
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

// Rich, read-only diagnostics for error reports. Includes the appex code-sign
// verification (the usual culprit when registration fails) and the helper's
// raw `find` output, alongside the normal status. Never throws.
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
