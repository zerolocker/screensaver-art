import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { InstallerStatus, ScreensaverTiming } from '../../../preload'
import { log } from './log'
import { track } from './analytics'

interface InstallerContextValue {
  // Null until the first status read resolves.
  installer: InstallerStatus | null
  // Registered but not active: show the "Set" banner.
  needsActivation: boolean
  // A "Set" is in progress.
  activating: boolean
  // Most recent setup (auto-register) or activation failure, if any.
  error: string | null
  activate: () => Promise<void>
  // The idle delays shown in the status banner. Null until read, and off macOS.
  timing: ScreensaverTiming | null
  // Start the screensaver now for an instant preview.
  preview: () => Promise<void>
  // A "Preview now" is in progress.
  previewing: boolean
}

const InstallerContext = createContext<InstallerContextValue | null>(null)

export function useInstaller(): InstallerContextValue {
  const ctx = useContext(InstallerContext)
  if (!ctx) throw new Error('useInstaller must be used within <InstallerProvider>')
  return ctx
}

// Screensaver state for the signed-in app. It registers the appex once after
// sign-in, so a failure report includes the user id.
export function InstallerProvider({ children }: { children: ReactNode }) {
  const [installer, setInstaller] = useState<InstallerStatus | null>(null)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timing, setTiming] = useState<ScreensaverTiming | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Register once per session, despite focus events and StrictMode.
  const ensuredRef = useRef(false)

  const refresh = useCallback(async () => {
    setInstaller(await window.electronAPI.installer.status())
  }, [])

  // The user may have just changed these in System Settings.
  const refreshTiming = useCallback(async () => {
    try {
      setTiming(await window.electronAPI.screensaver.timing())
    } catch {
      /* keep the previous value */
    }
  }, [])

  const preview = useCallback(async () => {
    track('screensaver_preview_clicked')
    setPreviewing(true)
    try {
      await window.electronAPI.screensaver.preview()
    } catch (err) {
      log.warn('installer', 'screensaver preview failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setPreviewing(false)
    }
  }, [])

  const activate = useCallback(async () => {
    setActivating(true)
    setError(null)
    const result = await window.electronAPI.installer.activate()
    if (!result.ok) setError(result.error ?? 'Could not set the screensaver')
    await refresh()
    setActivating(false)
  }, [refresh])

  useEffect(() => {
    let cancelled = false

    void refreshTiming()

    void (async () => {
      const status = await window.electronAPI.installer.status()
      if (cancelled) return
      setInstaller(status)

      // A missing bundle gets the recovery screen instead.
      if (status.supported && status.bundledExtensionExists && !ensuredRef.current) {
        ensuredRef.current = true
        try {
          const result = await window.electronAPI.installer.ensureRegistered()
          if (!result.ok) {
            setError(result.error ?? 'Could not set up the screensaver')
            log.warn('installer', 'auto-register failed', { error: result.error })
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (!cancelled) setInstaller(await window.electronAPI.installer.status())
        }
      }
    })()

    // Refresh on focus to pick up System Settings changes. Never registers.
    const onFocus = (): void => {
      window.electronAPI.installer.status().then(setInstaller).catch(() => {})
      void refreshTiming()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const value: InstallerContextValue = {
    installer,
    needsActivation: !!(installer?.supported && installer.registered && !installer.active),
    activating,
    error,
    activate,
    timing,
    preview,
    previewing,
  }

  return <InstallerContext.Provider value={value}>{children}</InstallerContext.Provider>
}
