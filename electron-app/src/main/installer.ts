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
export const _testHooks: {
  spawn: typeof spawn
  run: typeof defaultRun
  // `pluginkit -a` registers ASYNCHRONOUSLY — poll `find` this many times, this
  // far apart, before declaring failure. Overridable so tests don't actually
  // sleep through the poll.
  confirmRetries: number
  confirmDelayMs: number
} = {
  spawn,
  run: defaultRun,
  confirmRetries: 6,
  confirmDelayMs: 800,
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Force LaunchServices to re-register a bundle (the lsregister tool lives deep in
// CoreServices and has no PATH entry).
const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

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
  // The host OS, straight from process.platform (e.g. 'darwin', 'win32'). Lets
  // the renderer tailor copy without re-deriving the platform itself.
  platform: NodeJS.Platform
  // Whether screensaver install is implemented on this OS at all. Currently only
  // macOS ('darwin'); everything below is false on unsupported platforms.
  supported: boolean
  // The appex is actually present inside this app bundle (Contents/PlugIns). When
  // false on a supported OS the app is broken (incomplete download / damaged
  // bundle) — the renderer blocks with a recovery screen rather than trying to
  // register a missing file.
  bundledExtensionExists: boolean
  // pluginkit knows about our extension (it's registered with the system and
  // shows up in System Settings → Screen Saver). Registration is done
  // automatically on launch; this reflects whether it succeeded.
  registered: boolean
  // Our screensaver is registered AND set as the active one, so it will actually
  // display. Gated on `registered` — an unregistered appex can't be active even
  // when the system preference still names it (see getStatus). The "Set" banner
  // gates on `registered && !active`.
  active: boolean
  // The bundle path pluginkit has on file for our extension, or null if not
  // registered. Surfaced in diagnostics/error reports to spot a stale path.
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
  const [{ registered, registeredPath }, rawActive] = await Promise.all([queryRegistration(), isActive()])
  // Gate `active` on `registered`. After an uninstall (`pluginkit -r`) the
  // extension is gone from System Settings, but the system's active-screensaver
  // preference can still name ScreensaverArtExtension, so the helper's `status`
  // keeps reporting active=true. Surfacing that unchanged makes the Account page
  // show the contradictory "Set as your screensaver" pill alongside the "Install
  // Screensaver" button. An unregistered appex can't actually display, so it
  // isn't meaningfully active.
  const active = registered && rawActive
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

// Read the CFBundleVersion of the bundled appex (the value stamped from the
// app version at build time). This is what we compare against the last version
// we registered, to detect "the app was updated since we last registered".
// Returns null if it can't be read (treated as "don't thrash" — see below).
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

// The appex lives at <App>.app/Contents/PlugIns/<name>.appex — strip the three
// trailing path components to get the containing .app bundle.
function appBundlePathFromAppex(appex: string): string {
  return join(appex, '..', '..', '..')
}

// Force LaunchServices to re-register the app bundle. After a Squirrel.Mac
// in-place auto-update, LaunchServices can keep the PRE-update bundle cached at
// this path, so pkd never re-discovers the (new) embedded appex and `pluginkit
// -a` silently no-ops (exit 0, nothing registered). That's the root cause of
// "Failed to register the screensaver" seen ONLY after an update, never on a
// fresh install (where launching the app already seeded LaunchServices). Best
// effort — a failure here shouldn't block the register attempt.
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

// Register the appex via the PaperSaver helper, then CONFIRM it actually landed.
// `pluginkit -a` is asynchronous: it exits 0 immediately, but pkd only finishes
// creating the plugin record ~1s later (after LaunchServices re-seeds the bundle
// — pronounced right after an in-place auto-update). The helper's own immediate
// re-query therefore often misses it, so we poll `find` a few times before
// giving up. This both fixes the real post-update failure AND a false-negative
// banner where registration had in fact succeeded a beat later.
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
    // Surface the helper's actual report (not just "exit 0") — other causes
    // include a broken appex code signature, which pluginkit refuses silently.
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
  // The bundled appex version we evaluated (so the caller can persist it after a
  // successful (re)register). Null if it couldn't be read.
  version: string | null
  // Whether we actually (re)registered this call (vs. it already being current).
  didRegister: boolean
}

// Idempotent "make sure the screensaver is registered and up to date", run
// automatically on app launch instead of a manual install button. Registers the
// appex when it isn't registered yet OR when the bundled build changed since we
// last registered (an app update) — pluginkit caches by CFBundleVersion, so a
// re-register only refreshes the system's copy when the version actually bumped,
// and killScreensaverProcesses() drops any process still running the old code.
//
// `lastRegisteredVersion` is the version we recorded after our previous
// successful register (persisted in the main process's userData); pass null on a
// machine that has never registered.
export async function ensureRegistered(lastRegisteredVersion: string | null): Promise<EnsureResult> {
  if (process.platform !== 'darwin') {
    return { ok: true, registered: false, version: null, didRegister: false }
  }
  const appex = bundledAppexPath()
  if (!existsSync(appex)) {
    // Should never happen for a real install — the renderer blocks on
    // bundledExtensionExists before we get here — but guard defensively.
    log.error('installer', 'ensureRegistered: bundled appex missing', { appex })
    return { ok: false, error: `Bundled screensaver missing at ${appex}.`, registered: false, version: null, didRegister: false }
  }

  const version = await bundledAppexVersion()
  const { registered } = await queryRegistration()

  // Already registered and current → nothing to do. If we can't read the bundled
  // version (null), don't re-register on every launch (which would needlessly
  // kill System Settings/ScreenSaverEngine each time) — assume the existing
  // registration is fine.
  if (registered && (version === null || lastRegisteredVersion === version)) {
    return { ok: true, registered: true, version, didRegister: false }
  }

  log.info('installer', 'ensureRegistered: (re)registering appex', {
    appex, version, lastRegisteredVersion, wasRegistered: registered,
  })
  await killScreensaverProcesses()
  // Make LaunchServices re-scan the (possibly just-updated) app bundle BEFORE we
  // ask pluginkit to register the embedded appex — otherwise `pluginkit -a`
  // no-ops on the post-auto-update launch (see forceLaunchServicesRegister).
  await forceLaunchServicesRegister(appBundlePathFromAppex(appex))
  const result = await registerAppex(appex)
  if (!result.ok) {
    return { ok: false, error: result.error, registered: false, version, didRegister: false }
  }
  return { ok: true, registered: true, version, didRegister: true }
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
