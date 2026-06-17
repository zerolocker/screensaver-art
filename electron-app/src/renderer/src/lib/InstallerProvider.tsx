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

interface InstallerContextValue {
  // Null until the first status read resolves.
  installer: InstallerStatus | null
  // Registered but not the active screensaver — the top-of-app "Set" banner shows.
  needsActivation: boolean
  // A one-click "Set" is in flight.
  activating: boolean
  // Most recent setup (auto-register) or activation failure, if any.
  error: string | null
  activate: () => Promise<void>
  // The macOS idle thresholds the "Screensaver is set" status banner explains.
  // Null until first read (and stays null off macOS).
  timing: ScreensaverTiming | null
  // Start the screensaver now for an instant preview.
  preview: () => Promise<void>
  // A "Preview now" launch is in flight.
  previewing: boolean
}

const InstallerContext = createContext<InstallerContextValue | null>(null)

export function useInstaller(): InstallerContextValue {
  const ctx = useContext(InstallerContext)
  if (!ctx) throw new Error('useInstaller must be used within <InstallerProvider>')
  return ctx
}

// Owns the screensaver installer state for the whole (signed-in) app. Mounting
// this == the user is past login, which is exactly when we want to auto-register
// the embedded .appex (so the report on a failure carries the user id, and there
// is no manual "Install" step to puzzle over). Registration is idempotent and
// version-aware in the main process: it only re-registers when the appex is
// missing from pluginkit or the app was updated since we last registered.
export function InstallerProvider({ children }: { children: ReactNode }) {
  const [installer, setInstaller] = useState<InstallerStatus | null>(null)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timing, setTiming] = useState<ScreensaverTiming | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Guards the auto-register so it runs once per session, not again on every
  // focus / StrictMode double-mount.
  const ensuredRef = useRef(false)

  const refresh = useCallback(async () => {
    setInstaller(await window.electronAPI.installer.status())
  }, [])

  // Re-read the idle thresholds — cheap, and the user may have just changed them
  // in System Settings, so we refresh on focus alongside status.
  const refreshTiming = useCallback(async () => {
    try {
      setTiming(await window.electronAPI.screensaver.timing())
    } catch {
      /* leave the previous value; the banner degrades to neutral copy */
    }
  }, [])

  const preview = useCallback(async () => {
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

      // Auto-register once, only where it can actually work. If the bundle is
      // missing the app shows a blocking recovery screen instead (see App), so
      // don't bother trying to register a missing file.
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

    // Re-read status + timing on focus so a change made in System Settings (the
    // active saver, or the idle thresholds) is reflected app-wide. Read-only —
    // never auto-registers (that's once-per-launch above).
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
