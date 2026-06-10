import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { GALLERY_ENDPOINT } from './api'
import { getAccessToken } from './supabase'
import { log } from './log'
import type { CacheProgress, CacheStats } from '../../../preload'

// Re-sync on window focus only if the cache is at least this old. Catches the
// "app left open for days" case without hammering the API every time the user
// alt-tabs back.
const STALE_MS = 30 * 60 * 1000

export type SyncTrigger = 'auto' | 'manual'

interface SyncContextValue {
  syncing: boolean
  progress: CacheProgress | null
  cacheStats: CacheStats | null
  lastSyncedAt: string | null
  error: string | null
  lastTrigger: SyncTrigger | null
  syncNow: (opts?: { trigger?: SyncTrigger }) => Promise<void>
  refreshStats: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useGallerySync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useGallerySync must be used within <SyncProvider>')
  return ctx
}

// Single source of truth for gallery sync. Wraps the authenticated app so the
// auto-sync fires once on open / sign-in, and so the sidebar indicator and the
// Account page read the same state (one progress listener, one in-flight guard)
// instead of each managing their own. The main process additionally dedupes
// concurrent syncs, so this is the friendly front-end to that single run.
export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<CacheProgress | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTrigger, setLastTrigger] = useState<SyncTrigger | null>(null)

  // Synchronous guard against firing two syncs from the renderer (StrictMode
  // double-mount, a focus event mid-sync, a manual click during auto-sync).
  const syncingRef = useRef(false)
  const lastSyncedMsRef = useRef(0)

  const refreshStats = useCallback(async () => {
    try {
      setCacheStats(await window.electronAPI.cache.getStats())
    } catch {
      // Stats are cosmetic — never let them fail a render.
    }
  }, [])

  const syncNow = useCallback(
    async (opts?: { trigger?: SyncTrigger }) => {
      const trigger = opts?.trigger ?? 'manual'
      if (syncingRef.current) return // a run is already in flight
      syncingRef.current = true
      setSyncing(true)
      setLastTrigger(trigger)
      setError(null)
      setProgress(null)
      try {
        const url = `${GALLERY_ENDPOINT}?collection=classic`
        const accessToken = await getAccessToken()
        const result = await window.electronAPI.cache.sync(url, accessToken)
        if (result.ok) {
          setLastSyncedAt(result.manifest.syncedAt)
          lastSyncedMsRef.current = Date.now()
        } else {
          setError(result.error)
          log.warn('sync', 'gallery sync failed', { trigger, error: result.error })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        log.warn('sync', 'gallery sync threw', { trigger, error: message })
      } finally {
        syncingRef.current = false
        setSyncing(false)
        await refreshStats()
      }
    },
    [refreshStats],
  )

  useEffect(() => {
    // A sync may already be running in the main process (auto-sync kicked off by
    // a previous provider mount, or still finishing after a quick sign-out/in).
    window.electronAPI.cache
      .getSyncState()
      .then((state) => {
        if (state.syncing) setSyncing(true)
      })
      .catch(() => {})

    const off = window.electronAPI.cache.onProgress((p) => {
      setProgress(p)
      if (p.phase === 'cached' || p.phase === 'downloading') {
        // Tick the cache stats up live as videos arrive.
        window.electronAPI.cache.getStats().then(setCacheStats).catch(() => {})
      } else if (p.phase === 'done') {
        // Reconcile state even for a run this provider didn't start itself.
        syncingRef.current = false
        setSyncing(false)
        lastSyncedMsRef.current = Date.now()
        setLastSyncedAt((prev) => prev ?? new Date().toISOString())
        window.electronAPI.cache.getStats().then(setCacheStats).catch(() => {})
      }
    })

    void refreshStats()
    // Initial auto-sync on app open / sign-in.
    void syncNow({ trigger: 'auto' })

    // Re-sync on focus once the cache has gone stale.
    const onFocus = (): void => {
      if (syncingRef.current) return
      if (Date.now() - lastSyncedMsRef.current < STALE_MS) return
      void syncNow({ trigger: 'auto' })
    }
    window.addEventListener('focus', onFocus)

    return () => {
      off()
      window.removeEventListener('focus', onFocus)
    }
  }, [syncNow, refreshStats])

  const value: SyncContextValue = {
    syncing,
    progress,
    cacheStats,
    lastSyncedAt,
    error,
    lastTrigger,
    syncNow,
    refreshStats,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
