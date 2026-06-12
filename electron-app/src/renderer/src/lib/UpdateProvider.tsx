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
  // Current auto-update state. Starts 'idle'; the main process pushes changes.
  state: UpdateState
  // A downloaded update is waiting — the "Relaunch to update" banner shows.
  updateReady: boolean
  // Trigger a manual check (no-op in dev / unpackaged builds).
  check: () => Promise<void>
  // Quit + install the downloaded update, then relaunch.
  relaunch: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdate must be used within <UpdateProvider>')
  return ctx
}

// Owns auto-update state for the whole app. Mounted high in the tree so the
// state survives navigation and a download that finished while the user was on
// another page still surfaces the banner. Downloads happen silently in the main
// process (autoDownload); this just reflects status and offers the relaunch.
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false

    // Seed from the main process in case an event (e.g. 'ready') fired before
    // this mounted, then subscribe to subsequent pushes.
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
