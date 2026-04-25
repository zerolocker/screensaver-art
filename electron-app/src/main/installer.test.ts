import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'

// Same trick as cache-sync.test.ts: redirect HOME so installedSaverPath()
// (which is `~/Library/Screen Savers/...`) lands in a tmp dir, not in the
// developer's real Screen Savers folder.
const FAKE_HOME = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-test-'))
  process.env.HOME = dir
  return dir
})

// installer.ts imports `app` from electron. We don't run inside Electron,
// so stub it with the bare-minimum surface installer.ts touches.
vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

import { getStatus, install, uninstall, openSystemSettings, _testHooks } from './installer'

const SAVER_NAME = 'ScreensaverArt.saver'
const installedPath = () => join(FAKE_HOME, 'Library', 'Screen Savers', SAVER_NAME)
const bundledPath = () => join(__dirname, '..', '..', 'resources', SAVER_NAME)

const realSpawn = _testHooks.spawn

// Capture spawn calls instead of running real `killall`/`xattr`/`open` against
// the dev machine. installer.ts goes through _testHooks.spawn so this swap is
// the only intervention needed — vi.mock on 'child_process' doesn't propagate
// transitively into sibling modules even under vitest 4.x.
const spawnCalls: { cmd: string; args: ReadonlyArray<string> }[] = []
function fakeSpawn(cmd: string, args: ReadonlyArray<string>) {
  spawnCalls.push({ cmd, args })
  const ee = new EventEmitter() as EventEmitter & { unref: () => void }
  ee.unref = () => {}
  setImmediate(() => ee.emit('exit', 0))
  return ee as unknown as ReturnType<typeof realSpawn>
}

// Make a fake .saver bundle (a directory with a marker file inside)
function plantFakeBundle(at: string, marker = 'fake') {
  mkdirSync(at, { recursive: true })
  writeFileSync(join(at, 'marker.txt'), marker)
}

const ORIGINAL_PLATFORM = process.platform
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

describe('installer', () => {
  beforeEach(() => {
    spawnCalls.length = 0
    _testHooks.spawn = fakeSpawn as unknown as typeof realSpawn
    setPlatform('darwin')
  })

  afterEach(() => {
    _testHooks.spawn = realSpawn
    setPlatform(ORIGINAL_PLATFORM)
    if (existsSync(installedPath())) rmSync(installedPath(), { recursive: true, force: true })
    if (existsSync(bundledPath())) rmSync(bundledPath(), { recursive: true, force: true })
  })

  describe('getStatus', () => {
    it('reports unsupported on non-darwin platforms', () => {
      setPlatform('linux')
      const s = getStatus()
      expect(s.supported).toBe(false)
      expect(s.installed).toBe(false)
      expect(s.bundledSaverExists).toBe(false)
      expect(s.installedPath).toBeNull()
      expect(s.platform).toBe('linux')
    })

    it('reports supported=true on darwin', () => {
      const s = getStatus()
      expect(s.supported).toBe(true)
      expect(s.platform).toBe('darwin')
    })

    it('detects an installed bundle', () => {
      plantFakeBundle(installedPath())
      const s = getStatus()
      expect(s.installed).toBe(true)
      expect(s.installedPath).toBe(installedPath())
    })

    it('reports installed=false when nothing is in Screen Savers', () => {
      const s = getStatus()
      expect(s.installed).toBe(false)
      expect(s.installedPath).toBeNull()
    })

    it('detects a bundled .saver in resources/', () => {
      plantFakeBundle(bundledPath())
      const s = getStatus()
      expect(s.bundledSaverExists).toBe(true)
    })
  })

  describe('install', () => {
    it('returns an error on non-darwin platforms', async () => {
      setPlatform('win32')
      const result = await install()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/win32/)
    })

    it('returns an error if the bundled .saver is missing', async () => {
      // Make sure nothing is bundled
      if (existsSync(bundledPath())) rmSync(bundledPath(), { recursive: true, force: true })
      const result = await install()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Bundled screensaver missing/)
    })

    it('copies the bundled .saver into ~/Library/Screen Savers/', async () => {
      plantFakeBundle(bundledPath(), 'v1')
      const result = await install()
      expect(result.ok).toBe(true)
      expect(existsSync(installedPath())).toBe(true)
      // Marker file came along — full directory copy
      expect(existsSync(join(installedPath(), 'marker.txt'))).toBe(true)
    })

    it('overwrites a stale installed bundle (kills procs first, then copies)', async () => {
      plantFakeBundle(installedPath(), 'old')
      plantFakeBundle(bundledPath(), 'new')

      const result = await install()
      expect(result.ok).toBe(true)

      // Marker from the new bundle, not the old
      const fs = await import('fs/promises')
      const marker = await fs.readFile(join(installedPath(), 'marker.txt'), 'utf8')
      expect(marker).toBe('new')

      // killall ran before xattr (process kill comes first)
      const cmds = spawnCalls.map((c) => c.cmd)
      expect(cmds).toContain('sh') // killall is wrapped in `sh -c`
      expect(cmds).toContain('xattr')
      expect(cmds.indexOf('sh')).toBeLessThan(cmds.indexOf('xattr'))
    })

    it('strips the quarantine xattr after installing', async () => {
      plantFakeBundle(bundledPath())
      await install()
      const xattrCall = spawnCalls.find((c) => c.cmd === 'xattr')
      expect(xattrCall).toBeDefined()
      expect(xattrCall!.args).toEqual(['-dr', 'com.apple.quarantine', installedPath()])
    })
  })

  describe('uninstall', () => {
    it('returns an error on non-darwin platforms', async () => {
      setPlatform('linux')
      const result = await uninstall()
      expect(result.ok).toBe(false)
    })

    it('removes the installed bundle', async () => {
      plantFakeBundle(installedPath())
      expect(existsSync(installedPath())).toBe(true)

      const result = await uninstall()
      expect(result.ok).toBe(true)
      expect(existsSync(installedPath())).toBe(false)
    })

    it('is a no-op when nothing is installed', async () => {
      expect(existsSync(installedPath())).toBe(false)
      const result = await uninstall()
      expect(result.ok).toBe(true)
    })
  })

  describe('openSystemSettings', () => {
    it('does nothing on non-darwin', () => {
      setPlatform('win32')
      openSystemSettings()
      expect(spawnCalls).toHaveLength(0)
    })

    it('spawns `open` via sh -c on darwin', () => {
      openSystemSettings()
      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0].cmd).toBe('sh')
      expect(spawnCalls[0].args[0]).toBe('-c')
      // The chained-fallback open command should reference the screen-saver pane
      expect(spawnCalls[0].args[1]).toMatch(/ScreenSaver-Settings.extension/)
    })
  })
})
