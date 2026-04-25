// Screensaver installer — installs the platform-native screensaver bundle
// from the Electron app's bundled resources into the OS's screensaver
// directory. The user runs ONE installer (this Electron app); we manage the
// platform-specific screensaver under the hood.

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, cp, rm } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { app } from 'electron'

const SAVER_BUNDLE_NAME = 'ScreensaverArt.saver'

// Indirection layer so tests can swap spawn without touching the dev
// machine's real `killall` / `xattr` / `open`. vi.mock on Node built-ins
// (including child_process) does not propagate transitively into imported
// sibling modules under vitest 2.x or 4.x — verified empirically in both
// versions. An override hook is the simplest reliable way to keep these
// tests safe.
export const _testHooks: { spawn: typeof spawn } = { spawn }

// Where the .saver lives inside the packaged Electron app vs. dev mode.
// In dev, run `bash scripts/bundle-saver.sh` from electron-app/ first.
function bundledSaverPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, SAVER_BUNDLE_NAME)
  }
  return join(__dirname, '..', '..', 'resources', SAVER_BUNDLE_NAME)
}

function installedSaverPath(): string {
  return join(homedir(), 'Library', 'Screen Savers', SAVER_BUNDLE_NAME)
}

export type InstallerStatus = {
  platform: NodeJS.Platform
  supported: boolean
  bundledSaverExists: boolean
  installed: boolean
  installedPath: string | null
}

export function getStatus(): InstallerStatus {
  const supported = process.platform === 'darwin'
  const bundledSaverExists = supported && existsSync(bundledSaverPath())
  const installed = supported && existsSync(installedSaverPath())
  return {
    platform: process.platform,
    supported,
    bundledSaverExists,
    installed,
    installedPath: installed ? installedSaverPath() : null,
  }
}

// Apple's legacy screensaver framework keeps the bundle mapped in memory once
// loaded — copying over a running .saver gives you stale code at next launch.
// Same pattern as screensaver/build.sh and the original DMG installer script.
function killScreensaverProcesses(): Promise<void> {
  return new Promise((resolve) => {
    const cmd = `
      killall ScreenSaverEngine    2>/dev/null || true
      killall 'System Settings'    2>/dev/null || true
      killall 'System Preferences' 2>/dev/null || true
      pkill -f legacyScreenSaver   2>/dev/null || true
    `
    const proc = _testHooks.spawn('sh', ['-c', cmd])
    proc.on('exit', () => setTimeout(resolve, 1000))
  })
}

function stripQuarantine(path: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = _testHooks.spawn('xattr', ['-dr', 'com.apple.quarantine', path])
    proc.on('exit', () => resolve())
  })
}

export async function install(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Screensaver install is not supported on ${process.platform} yet.` }
  }
  const src = bundledSaverPath()
  if (!existsSync(src)) {
    return { ok: false, error: `Bundled screensaver missing at ${src}. Run scripts/bundle-saver.sh.` }
  }
  const installDir = join(homedir(), 'Library', 'Screen Savers')
  const dest = installedSaverPath()

  await killScreensaverProcesses()
  await mkdir(installDir, { recursive: true })
  if (existsSync(dest)) {
    await rm(dest, { recursive: true, force: true })
  }
  await cp(src, dest, { recursive: true })
  await stripQuarantine(dest)
  return { ok: true }
}

export async function uninstall(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: `Not supported on ${process.platform}.` }
  }
  await killScreensaverProcesses()
  const dest = installedSaverPath()
  if (existsSync(dest)) {
    await rm(dest, { recursive: true, force: true })
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
