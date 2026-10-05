import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { UpdateState } from '../../../preload'
import { log } from './log'

interface UpdateContextValue {
  state: UpdateState
  // An update is downloaded; the relaunch banner shows.
  updateReady: boolean
  // No-op unless packaged.
  check: () => Promise<void>
  relaunch: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdate must be used within <UpdateProvider>')
  return ctx
}

// Auto-update state, mounted high so it survives navigation. The main process
// downloads; this shows the status and offers the relaunch.
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false

    // Read the current state first, in case events fired before mount.
    void window.electronAPI.update.getState().then((s) => {
      if (!cancelled) setState(s)
    })
    const unsubscribe = window.electronAPI.update.onEvent((s) => {
      if (s.status === 'ready') log.info('update', 'update ready', { version: s.version })
      if (s.status === 'error') log.warn('update', 'update error', { error: s.error })
      setState(s)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const check = useCallback(async () => {
    await window.electronAPI.update.check()
  }, [])

  const relaunch = useCallback(async () => {
    await window.electronAPI.update.quitAndInstall()
  }, [])

  const value: UpdateContextValue = {
    state,
    updateReady: state.status === 'ready',
    check,
    relaunch,
  }

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}
