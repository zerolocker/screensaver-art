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

// On focus, re-sync only if the cache is at least this old.
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

// Gallery sync state for the signed-in app, shared by the sidebar and the
// Account page. Syncs once on open or sign-in.
export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<CacheProgress | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTrigger, setLastTrigger] = useState<SyncTrigger | null>(null)

  // Prevents a second sync from StrictMode, focus, or a click mid-sync.
  const syncingRef = useRef(false)
  const lastSyncedMsRef = useRef(0)

  const refreshStats = useCallback(async () => {
    try {
      setCacheStats(await window.electronAPI.cache.getStats())
    } catch {
      // Cosmetic; never fail on them.
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
        const accessToken = await getAccessToken()
        // Only a manual sync deletes deselected files.
        const result = await window.electronAPI.cache.sync(
          GALLERY_ENDPOINT,
          accessToken,
          trigger === 'manual',
        )
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
    // A sync may already be running in the main process.
    window.electronAPI.cache
      .getSyncState()
      .then((state) => {
        if (state.syncing) setSyncing(true)
      })
      .catch(() => {})

    const off = window.electronAPI.cache.onProgress((p) => {
      setProgress(p)
      if (p.phase === 'cached' || p.phase === 'downloading') {
        window.electronAPI.cache.getStats().then(setCacheStats).catch(() => {})
      } else if (p.phase === 'done') {
        // Also for runs this provider didn't start.
        syncingRef.current = false
        setSyncing(false)
        lastSyncedMsRef.current = Date.now()
        setLastSyncedAt((prev) => prev ?? new Date().toISOString())
        window.electronAPI.cache.getStats().then(setCacheStats).catch(() => {})
      }
    })

    void refreshStats()
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
