import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// Avoid pulling in electron (logger imports app) — we only assert behaviour.
vi.mock('./logger', () => ({
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}))

import {
  parseIdleSeconds,
  parseDisplaySleepMinutes,
  getScreensaverTiming,
  startScreensaverPreview,
  _testHooks,
} from './screensaver-timing'

const realRun = _testHooks.run
const realSpawn = _testHooks.spawn
const realPlatform = process.platform

function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

afterEach(() => {
  _testHooks.run = realRun
  _testHooks.spawn = realSpawn
  setPlatform(realPlatform)
  vi.restoreAllMocks()
})

describe('parseIdleSeconds', () => {
  it('parses a clean integer (with trailing newline / spaces)', () => {
    expect(parseIdleSeconds('1200\n')).toBe(1200)
    expect(parseIdleSeconds('  300  ')).toBe(300)
  })
  it('treats 0 (Never) as a real value', () => {
    expect(parseIdleSeconds('0')).toBe(0)
  })
  it('returns null for non-integers / error output', () => {
    expect(parseIdleSeconds('')).toBeNull()
    expect(parseIdleSeconds('12.5')).toBeNull()
    expect(parseIdleSeconds('does not exist')).toBeNull()
  })
})

describe('parseDisplaySleepMinutes', () => {
  const pmset = [
    'System-wide power settings:',
    'Currently in use:',
    ' standby              1',
    ' Sleep On Power Button 1',
    ' displaysleep         30',
    ' disksleep            10',
  ].join('\n')

  it('extracts the displaysleep minutes', () => {
    expect(parseDisplaySleepMinutes(pmset)).toBe(30)
  })
  it('treats 0 (Never) as a real value', () => {
    expect(parseDisplaySleepMinutes(' displaysleep         0\n')).toBe(0)
  })
  it('returns null when displaysleep is absent', () => {
    expect(parseDisplaySleepMinutes('sleep 1\n')).toBeNull()
  })
})

describe('getScreensaverTiming', () => {
  beforeEach(() => setPlatform('darwin'))

  it('reads idleTime (seconds) and displaysleep (minutes)', async () => {
    _testHooks.run = vi.fn(async (cmd: string) => {
      if (cmd.endsWith('defaults')) return { code: 0, stdout: '1200\n', stderr: '' }
      if (cmd.endsWith('pmset')) return { code: 0, stdout: ' displaysleep         30\n', stderr: '' }
      return { code: 1, stdout: '', stderr: '' }
    })
    expect(await getScreensaverTiming()).toEqual({ screensaverStartSec: 1200, displayOffMin: 30 })
  })

  it('reports null for a reader that errors (key missing)', async () => {
    _testHooks.run = vi.fn(async (cmd: string) => {
      if (cmd.endsWith('defaults')) return { code: 1, stdout: '', stderr: 'does not exist' }
      return { code: 0, stdout: ' displaysleep         10\n', stderr: '' }
    })
    expect(await getScreensaverTiming()).toEqual({ screensaverStartSec: null, displayOffMin: 10 })
  })

  it('returns nulls (and reads nothing) off macOS', async () => {
    setPlatform('win32')
    const run = vi.fn()
    _testHooks.run = run
    expect(await getScreensaverTiming()).toEqual({ screensaverStartSec: null, displayOffMin: null })
    expect(run).not.toHaveBeenCalled()
  })
})

describe('startScreensaverPreview', () => {
  function fakeSpawn(emit: (ee: EventEmitter) => void) {
    const calls: { cmd: string; args: ReadonlyArray<string> }[] = []
    const spawn = (cmd: string, args: ReadonlyArray<string>) => {
      calls.push({ cmd, args })
      const ee = new EventEmitter()
      setImmediate(() => emit(ee))
      return ee as unknown as ReturnType<typeof realSpawn>
    }
    return { spawn: spawn as unknown as typeof realSpawn, calls }
  }

  it('opens ScreenSaverEngine and resolves ok on exit 0', async () => {
    setPlatform('darwin')
    const { spawn, calls } = fakeSpawn((ee) => ee.emit('exit', 0))
    _testHooks.spawn = spawn
    expect(await startScreensaverPreview()).toEqual({ ok: true })
    expect(calls[0].cmd).toBe('/usr/bin/open')
    expect(calls[0].args[0]).toContain('ScreenSaverEngine.app')
  })

  it('resolves with an error when open fails to launch', async () => {
    setPlatform('darwin')
    const { spawn } = fakeSpawn((ee) => ee.emit('error', new Error('boom')))
    _testHooks.spawn = spawn
    const res = await startScreensaverPreview()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/boom/)
  })

  it('is a no-op off macOS', async () => {
    setPlatform('linux')
    const res = await startScreensaverPreview()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not supported/i)
  })
})
