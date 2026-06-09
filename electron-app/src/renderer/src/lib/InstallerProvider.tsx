import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { InstallerStatus } from '../../../preload'

interface InstallerContextValue {
  installer: InstallerStatus | null
  /** The screensaver is installed but not the active one — the "Set" banner shows. */
  needsActivation: boolean
  installing: boolean
  activating: boolean
  uninstalling: boolean
  error: string | null
  refresh: () => Promise<void>
  install: () => Promise<void>
  activate: () => Promise<void>
  uninstall: () => Promise<void>
}

const InstallerContext = createContext<InstallerContextValue | null>(null)

export function useInstaller(): InstallerContextValue {
  const ctx = useContext(InstallerContext)
  if (!ctx) throw new Error('useInstaller must be used within <InstallerProvider>')
  return ctx
}

// Single source of truth for the screensaver installer status + actions. Lifted
// out of the Account page so the "set your screensaver" banner can live at the
// top of the app (above the upsell banner) on any page — the banner and the
// Account card read the same state, so a one-click "Set" updates both at once.
export function InstallerProvider({ children }: { children: ReactNode }) {
  const [installer, setInstaller] = useState<InstallerStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [activating, setActivating] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setInstaller(await window.electronAPI.installer.status())
  }, [])

  const install = useCallback(async () => {
    setInstalling(true)
    setError(null)
    const result = await window.electronAPI.installer.install()
    if (!result.ok) setError(result.error ?? 'Installation failed')
    await refresh()
    setInstalling(false)
  }, [refresh])

  // One-click "Set as your screensaver" — flips the active screensaver to ours
  // via the PaperSaver helper, no trip through System Settings required.
  const activate = useCallback(async () => {
    setActivating(true)
    setError(null)
    const result = await window.electronAPI.installer.activate()
    if (!result.ok) setError(result.error ?? 'Could not set the screensaver')
    await refresh()
    setActivating(false)
  }, [refresh])

  // Unregister the .appex from the system (pluginkit -r, via the PaperSaver
  // helper). After this it no longer appears in System Settings → Screen Saver.
  const uninstall = useCallback(async () => {
    setUninstalling(true)
    setError(null)
    const result = await window.electronAPI.installer.uninstall()
    if (!result.ok) setError(result.error ?? 'Uninstall failed')
    await refresh()
    setUninstalling(false)
  }, [refresh])

  useEffect(() => {
    void refresh()
    // Re-check on focus so a change made in System Settings (or a just-completed
    // "Set") is reflected app-wide — this keeps the top-of-app banner and the
    // Account card in agreement no matter where the user acted.
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const value: InstallerContextValue = {
    installer,
    needsActivation: !!(installer?.supported && installer.registered && !installer.active),
    installing,
    activating,
    uninstalling,
    error,
    refresh,
    install,
    activate,
    uninstall,
  }

  return <InstallerContext.Provider value={value}>{children}</InstallerContext.Provider>
}
