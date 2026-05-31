import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { EventEmitter } from 'events'

// Point the appex/helper at a throwaway tmp dir so the test never touches the
// real resources/ artifacts (and so "missing"/"present" cases are controllable).
const TMP = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-test-'))
  process.env.LART_APPEX_PATH = path.join(dir, 'ScreensaverArtExtension.appex')
  process.env.LART_HELPER_PATH = path.join(dir, 'lart-screensaver-helper')
  return dir
})

// installer.ts imports `app` from electron. We don't run inside Electron,
// so stub it with the bare-minimum surface installer.ts touches.
vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

import { getStatus, install, uninstall, activate, openSystemSettings, _testHooks } from './installer'

const APPEX = () => process.env.LART_APPEX_PATH!
const EXTENSION_BUNDLE_ID = 'com.livingart.screensaver.app.Extension'

const realSpawn = _testHooks.spawn
const realRun = _testHooks.run

// Capture fire-and-forget spawn calls (killall/open) instead of running them.
const spawnCalls: { cmd: string; args: ReadonlyArray<string> }[] = []
function fakeSpawn(cmd: string, args: ReadonlyArray<string>) {
  spawnCalls.push({ cmd, args })
  const ee = new EventEmitter() as EventEmitter & { unref: () => void }
  ee.unref = () => {}
  setImmediate(() => ee.emit('exit', 0))
  return ee as unknown as ReturnType<typeof realSpawn>
}

// Canned output for the capturing runner (pluginkit queries + helper calls).
type RunResult = { code: number; stdout: string; stderr: string }
const runCalls: { cmd: string; args: ReadonlyArray<string> }[] = []
let runImpl: (cmd: string, args: ReadonlyArray<string>) => RunResult
function fakeRun(cmd: string, args: ReadonlyArray<string>) {
  runCalls.push({ cmd, args })
  return Promise.resolve(runImpl(cmd, args))
}

// Default canned behaviour: nothing registered, helper says inactive.
function defaultRunImpl(cmd: string, args: ReadonlyArray<string>): RunResult {
  if (cmd.endsWith('pluginkit') && args.includes('-m')) return { code: 0, stdout: '', stderr: '' }
  if (cmd === APPEX() || cmd.endsWith('lart-screensaver-helper')) {
    // helper
    if (args[0] === 'status') return { code: 0, stdout: '{"active":false}', stderr: '' }
  }
  if (cmd === process.env.LART_HELPER_PATH) {
    if (args[0] === 'status') return { code: 0, stdout: '{"active":false}', stderr: '' }
  }
  return { code: 0, stdout: '', stderr: '' }
}

function plantBundle(at: string) {
  mkdirSync(at, { recursive: true })
  writeFileSync(join(at, 'marker.txt'), 'fake')
}

const ORIGINAL_PLATFORM = process.platform
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

describe('installer', () => {
  beforeEach(() => {
    spawnCalls.length = 0
    runCalls.length = 0
    runImpl = defaultRunImpl
    _testHooks.spawn = fakeSpawn as unknown as typeof realSpawn
    _testHooks.run = fakeRun as unknown as typeof realRun
    setPlatform('darwin')
    if (existsSync(APPEX())) rmSync(APPEX(), { recursive: true, force: true })
  })

  afterEach(() => {
    _testHooks.spawn = realSpawn
    _testHooks.run = realRun
    setPlatform(ORIGINAL_PLATFORM)
    if (existsSync(APPEX())) rmSync(APPEX(), { recursive: true, force: true })
  })

  // A pluginkit -m line that includes our extension, for the "registered" cases.
  const registeredLine = `    ${EXTENSION_BUNDLE_ID}(1.0.0)\tUUID\t2026-05-31\t${APPEX()}`

  describe('getStatus', () => {
    it('reports unsupported on non-darwin platforms', async () => {
      setPlatform('linux')
      const s = await getStatus()
      expect(s.supported).toBe(false)
      expect(s.registered).toBe(false)
      expect(s.active).toBe(false)
      expect(s.bundledExtensionExists).toBe(false)
      expect(s.registeredPath).toBeNull()
      expect(s.platform).toBe('linux')
    })

    it('reports supported=true on darwin', async () => {
      const s = await getStatus()
      expect(s.supported).toBe(true)
      expect(s.platform).toBe('darwin')
    })

    it('detects a bundled extension in resources/', async () => {
      plantBundle(APPEX())
      const s = await getStatus()
      expect(s.bundledExtensionExists).toBe(true)
    })

    it('parses registration + path from pluginkit output', async () => {
      runImpl = (cmd, args) => {
        if (cmd.endsWith('pluginkit') && args.includes('-m')) {
          return { code: 0, stdout: registeredLine, stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const s = await getStatus()
      expect(s.registered).toBe(true)
      expect(s.registeredPath).toBe(APPEX())
    })

    it('reflects the helper active state', async () => {
      runImpl = (cmd, args) => {
        if (cmd === process.env.LART_HELPER_PATH && args[0] === 'status') {
          return { code: 0, stdout: '{"active":true}', stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const s = await getStatus()
      expect(s.active).toBe(true)
    })
  })

  describe('install', () => {
    it('returns an error on non-darwin platforms', async () => {
      setPlatform('win32')
      const result = await install()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/win32/)
    })

    it('returns an error if the bundled extension is missing', async () => {
      const result = await install()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Bundled screensaver missing/)
    })

    it('registers via pluginkit -a and confirms via re-query', async () => {
      plantBundle(APPEX())
      // After -a, registration query returns our extension.
      runImpl = (cmd, args) => {
        if (cmd.endsWith('pluginkit') && args.includes('-m')) {
          return { code: 0, stdout: registeredLine, stderr: '' }
        }
        return { code: 0, stdout: '', stderr: '' }
      }
      const result = await install()
      expect(result.ok).toBe(true)
      // killall ran (fire-and-forget) before the pluginkit -a run.
      expect(spawnCalls.some((c) => c.cmd === 'sh')).toBe(true)
      const add = runCalls.find((c) => c.cmd.endsWith('pluginkit') && c.args.includes('-a'))
      expect(add).toBeDefined()
      expect(add!.args).toEqual(['-a', APPEX()])
    })

    it('fails when pluginkit does not register the extension', async () => {
      plantBundle(APPEX())
      runImpl = () => ({ code: 1, stdout: '', stderr: 'boom' }) // -m stays empty → not registered
      const result = await install()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/failed to register/)
    })
  })

  describe('uninstall', () => {
    it('returns an error on non-darwin platforms', async () => {
      setPlatform('linux')
      const result = await uninstall()
      expect(result.ok).toBe(false)
    })

    it('runs pluginkit -r on the registered path', async () => {
      runImpl = (cmd, args) => {
        if (cmd.endsWith('pluginkit') && args.includes('-m')) {
          return { code: 0, stdout: registeredLine, stderr: '' }
        }
        return { code: 0, stdout: '', stderr: '' }
      }
      const result = await uninstall()
      expect(result.ok).toBe(true)
      const rm = runCalls.find((c) => c.cmd.endsWith('pluginkit') && c.args.includes('-r'))
      expect(rm).toBeDefined()
      expect(rm!.args).toEqual(['-r', APPEX()])
    })
  })

  describe('activate', () => {
    it('runs the helper activate and succeeds on exit 0', async () => {
      runImpl = (cmd, args) => {
        if (cmd === process.env.LART_HELPER_PATH && args[0] === 'activate') {
          return { code: 0, stdout: '{"active":true}', stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const result = await activate()
      expect(result.ok).toBe(true)
      expect(runCalls.some((c) => c.cmd === process.env.LART_HELPER_PATH && c.args[0] === 'activate')).toBe(true)
    })

    it('surfaces the helper error on failure', async () => {
      runImpl = (cmd, args) => {
        if (cmd === process.env.LART_HELPER_PATH && args[0] === 'activate') {
          return { code: 1, stdout: '', stderr: 'activate failed: nope' }
        }
        return defaultRunImpl(cmd, args)
      }
      const result = await activate()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/activate failed: nope/)
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
      expect(spawnCalls[0].args[1]).toMatch(/ScreenSaver-Settings.extension/)
    })
  })
})
