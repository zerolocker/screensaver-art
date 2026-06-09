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

import { getStatus, ensureRegistered, activate, _testHooks } from './installer'

const APPEX = () => process.env.LART_APPEX_PATH!
const HELPER = () => process.env.LART_HELPER_PATH!

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

// Canned output for the capturing runner. Every pluginkit interaction now goes
// through the PaperSaver helper, so the only command installer.ts runs is the
// helper itself (status/find/register/unregister/activate).
type RunResult = { code: number; stdout: string; stderr: string }
const runCalls: { cmd: string; args: ReadonlyArray<string> }[] = []
let runImpl: (cmd: string, args: ReadonlyArray<string>) => RunResult
function fakeRun(cmd: string, args: ReadonlyArray<string>) {
  runCalls.push({ cmd, args })
  return Promise.resolve(runImpl(cmd, args))
}

// Default canned behaviour: helper says inactive and nothing registered.
function defaultRunImpl(cmd: string, args: ReadonlyArray<string>): RunResult {
  if (cmd === HELPER()) {
    if (args[0] === 'status') return { code: 0, stdout: '{"active":false}', stderr: '' }
    if (args[0] === 'find') return { code: 0, stdout: '{"registered":false,"path":null}', stderr: '' }
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

  // Helper `find` output for the "registered" cases (PaperSaver already parsed
  // pluginkit and resolved the path).
  const foundJson = () => `{"registered":true,"path":"${APPEX()}"}`

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

    it('reads registration + path from the helper `find` report', async () => {
      runImpl = (cmd, args) => {
        if (cmd === HELPER() && args[0] === 'find') {
          return { code: 0, stdout: foundJson(), stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const s = await getStatus()
      expect(s.registered).toBe(true)
      expect(s.registeredPath).toBe(APPEX())
    })

    it('reflects the helper active state', async () => {
      runImpl = (cmd, args) => {
        if (cmd === HELPER() && args[0] === 'status') {
          return { code: 0, stdout: '{"active":true}', stderr: '' }
        }
        if (cmd === HELPER() && args[0] === 'find') {
          return { code: 0, stdout: foundJson(), stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const s = await getStatus()
      expect(s.active).toBe(true)
    })

    // After uninstall, pluginkit no longer knows the extension but the system's
    // active-screensaver preference can still name it, so the helper keeps
    // reporting active=true. `active` is gated on `registered` to avoid the
    // contradictory "Set as your screensaver" + "Install Screensaver" UI.
    it('reports active=false when the extension is no longer registered', async () => {
      runImpl = (cmd, args) => {
        if (cmd === HELPER() && args[0] === 'status') {
          return { code: 0, stdout: '{"active":true}', stderr: '' }
        }
        if (cmd === HELPER() && args[0] === 'find') {
          return { code: 0, stdout: '{"registered":false,"path":null}', stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const s = await getStatus()
      expect(s.registered).toBe(false)
      expect(s.active).toBe(false)
    })
  })

  describe('ensureRegistered', () => {
    // Canned PlistBuddy reply for the bundled appex's CFBundleVersion.
    const withVersion = (
      version: string,
      extra: (cmd: string, args: ReadonlyArray<string>) => RunResult | null = () => null,
    ) => {
      runImpl = (cmd, args) => {
        if (cmd === '/usr/libexec/PlistBuddy') return { code: 0, stdout: version, stderr: '' }
        return extra(cmd, args) ?? defaultRunImpl(cmd, args)
      }
    }

    it('no-ops on non-darwin platforms', async () => {
      setPlatform('win32')
      const r = await ensureRegistered(null)
      expect(r.ok).toBe(true)
      expect(r.didRegister).toBe(false)
      expect(r.registered).toBe(false)
    })

    it('fails when the bundled extension is missing', async () => {
      const r = await ensureRegistered(null)
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/missing/i)
    })

    it('registers when not yet registered, killing stale processes first', async () => {
      plantBundle(APPEX())
      withVersion('1.0.3', (cmd, args) =>
        cmd === HELPER() && args[0] === 'register'
          ? { code: 0, stdout: foundJson(), stderr: '' }
          : null,
      )
      const r = await ensureRegistered(null)
      expect(r.ok).toBe(true)
      expect(r.didRegister).toBe(true)
      expect(r.registered).toBe(true)
      expect(r.version).toBe('1.0.3')
      expect(spawnCalls.some((c) => c.cmd === 'sh')).toBe(true)
      const reg = runCalls.find((c) => c.cmd === HELPER() && c.args[0] === 'register')
      expect(reg!.args).toEqual(['register', APPEX()])
    })

    it('does nothing when already registered at the same version', async () => {
      plantBundle(APPEX())
      withVersion('1.0.3', (cmd, args) =>
        cmd === HELPER() && args[0] === 'find'
          ? { code: 0, stdout: foundJson(), stderr: '' }
          : null,
      )
      const r = await ensureRegistered('1.0.3')
      expect(r.ok).toBe(true)
      expect(r.didRegister).toBe(false)
      // No re-register, no process kill — it was already current.
      expect(spawnCalls.some((c) => c.cmd === 'sh')).toBe(false)
      expect(runCalls.some((c) => c.cmd === HELPER() && c.args[0] === 'register')).toBe(false)
    })

    it('re-registers when the bundled version changed (app updated)', async () => {
      plantBundle(APPEX())
      withVersion('1.0.4', (cmd, args) =>
        cmd === HELPER() && (args[0] === 'find' || args[0] === 'register')
          ? { code: 0, stdout: foundJson(), stderr: '' }
          : null,
      )
      const r = await ensureRegistered('1.0.3')
      expect(r.didRegister).toBe(true)
      expect(r.version).toBe('1.0.4')
      expect(spawnCalls.some((c) => c.cmd === 'sh')).toBe(true)
      expect(runCalls.some((c) => c.cmd === HELPER() && c.args[0] === 'register')).toBe(true)
    })

    it('reports failure when the helper does not register', async () => {
      plantBundle(APPEX())
      withVersion('1.0.3', (cmd, args) =>
        cmd === HELPER() && args[0] === 'register'
          ? { code: 1, stdout: '', stderr: 'register failed: boom' }
          : null,
      )
      const r = await ensureRegistered(null)
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/register/i)
      expect(r.registered).toBe(false)
    })
  })

  describe('activate', () => {
    it('runs the helper activate and succeeds on exit 0', async () => {
      runImpl = (cmd, args) => {
        if (cmd === HELPER() && args[0] === 'activate') {
          return { code: 0, stdout: '{"active":true}', stderr: '' }
        }
        return defaultRunImpl(cmd, args)
      }
      const result = await activate()
      expect(result.ok).toBe(true)
      expect(runCalls.some((c) => c.cmd === HELPER() && c.args[0] === 'activate')).toBe(true)
    })

    it('surfaces the helper error on failure', async () => {
      runImpl = (cmd, args) => {
        if (cmd === HELPER() && args[0] === 'activate') {
          return { code: 1, stdout: '', stderr: 'activate failed: nope' }
        }
        return defaultRunImpl(cmd, args)
      }
      const result = await activate()
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/activate failed: nope/)
    })
  })
})
