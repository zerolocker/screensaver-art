import { describe, it, expect, vi } from 'vitest'

// updater.ts imports electron + electron-updater at module load; stub both so the
// pure reducer can be imported without an Electron runtime.
vi.mock('electron', () => ({ app: { isPackaged: false }, powerMonitor: { on: vi.fn() } }))
vi.mock('electron-updater', () => ({ autoUpdater: {} }))

import { reduceUpdateState, type UpdateState } from './updater'

const IDLE: UpdateState = { status: 'idle' }

describe('reduceUpdateState', () => {
  it('enters checking (preserving any known version)', () => {
    expect(reduceUpdateState(IDLE, { type: 'checking' })).toEqual({ status: 'checking' })
    expect(
      reduceUpdateState({ status: 'idle', version: '1.0.0' }, { type: 'checking' }),
    ).toEqual({ status: 'checking', version: '1.0.0' })
  })

  it('goes straight to downloading on update-available (autoDownload)', () => {
    expect(reduceUpdateState(IDLE, { type: 'available', version: '1.2.0' })).toEqual({
      status: 'downloading',
      version: '1.2.0',
      percent: 0,
    })
  })

  it('tracks progress while keeping the version learned at available', () => {
    const after = reduceUpdateState(
      { status: 'downloading', version: '1.2.0', percent: 0 },
      { type: 'progress', percent: 42 },
    )
    expect(after).toEqual({ status: 'downloading', version: '1.2.0', percent: 42 })
  })

  it('becomes ready when the download finishes', () => {
    expect(
      reduceUpdateState({ status: 'downloading', version: '1.2.0', percent: 99 }, {
        type: 'downloaded',
        version: '1.2.0',
      }),
    ).toEqual({ status: 'ready', version: '1.2.0' })
  })

  it('returns to idle when there is no update', () => {
    expect(
      reduceUpdateState({ status: 'checking', version: '1.0.0' }, { type: 'not-available' }),
    ).toEqual({ status: 'idle' })
  })

  it('records an error and keeps the version for context', () => {
    expect(
      reduceUpdateState({ status: 'downloading', version: '1.2.0' }, {
        type: 'error',
        message: 'net::ERR',
      }),
    ).toEqual({ status: 'error', version: '1.2.0', error: 'net::ERR' })
  })

  // Once downloaded, the "Relaunch" banner must never flicker away because a
  // background re-check ran (observed in the field: every 6h re-check re-entered
  // 'checking' → banner hidden → full zip re-downloaded → 'ready' again).
  describe('ready is sticky', () => {
    const READY: UpdateState = { status: 'ready', version: '1.2.0' }

    it('a re-check does not hide the banner', () => {
      expect(reduceUpdateState(READY, { type: 'checking' })).toEqual(READY)
    })

    it('not-available does not hide the banner', () => {
      expect(reduceUpdateState(READY, { type: 'not-available' })).toEqual(READY)
    })

    it('re-announcing the same downloaded version does not restart the download UI', () => {
      expect(reduceUpdateState(READY, { type: 'available', version: '1.2.0' })).toEqual(READY)
    })

    it('a NEWER version does supersede a downloaded one', () => {
      expect(reduceUpdateState(READY, { type: 'available', version: '1.3.0' })).toEqual({
        status: 'downloading',
        version: '1.3.0',
        percent: 0,
      })
    })
  })
})
