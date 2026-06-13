import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Loader2, WifiOff, ArrowDownUp, Search, X, CheckCheck } from 'lucide-react'
import { GALLERY_ENDPOINT } from '../lib/api'
import { AppBanners } from '../components/AppBanners'
import { PosterCard } from '../components/PosterCard'
import { ArtModal } from '../components/ArtModal'
import { useGallerySync } from '../lib/SyncProvider'
import { log } from '../lib/log'
import {
  type ArtItem,
  tagsOf,
  orderTags,
  matchesQuery,
  UNDATED_FALLBACK,
  DEFAULT_SELECTION_COUNT,
} from '../lib/gallery-types'
import type { Session } from '@supabase/supabase-js'

interface GalleryResponse {
  items: ArtItem[]
  isSubscribed: boolean
  // Free-tier threshold from the server: a non-subscriber may play/cache only
  // the first `freeCount` items; the rest are "locked".
  freeCount: number
}

interface GalleryPageProps {
  session: Session
}

type Tab = 'all' | 'selected'
type SortOrder = 'oldest' | 'newest'

const SORT_KEY = 'lart-gallery-sort'
// Where the subscribe CTA points (the website's billing portal deep-link).
const SUBSCRIBE_URL = 'https://living-art-screensaver.com/account'
// After the last tick, wait this long before re-syncing the cache, so rapid
// toggling triggers one sync, not one per click.
const SYNC_DEBOUNCE_MS = 1500

export function GalleryPage({ session }: GalleryPageProps) {
  const [gallery, setGallery] = useState<GalleryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionReady, setSelectionReady] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<SortOrder>(
    () => (localStorage.getItem(SORT_KEY) as SortOrder) || 'oldest',
  )
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  // Frozen snapshot of the selection when the "Selected" tab was entered, so
  // unticking a piece there dims it in place instead of making it vanish.
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set())
  const [modalItem, setModalItem] = useState<ArtItem | null>(null)

  const { syncNow } = useGallerySync()
  const syncTimer = useRef<number | undefined>(undefined)

  const fetchGallery = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = session.access_token
      const res = await fetch(`${GALLERY_ENDPOINT}?collection=classic`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: GalleryResponse = await res.json()
      setGallery(data)

      // Resolve the selection: stored explicit list, or the default first N (in
      // API order — same default cache-sync applies for a null selection).
      const freeCount = data.freeCount ?? DEFAULT_SELECTION_COUNT
      const stored = await window.electronAPI.selection.get()
      const initial = stored.selected ?? data.items.slice(0, freeCount).map((i) => i.src)
      setSelected(new Set(initial))
      setSelectionReady(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  // Connectivity: a refetch fails offline. Show a calm notice and auto-recover.
  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true)
      fetchGallery()
    }
    const handleOffline = (): void => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [fetchGallery])

  useEffect(() => {
    return () => window.clearTimeout(syncTimer.current)
  }, [])

  const onSubscribe = useCallback(() => {
    window.electronAPI.shell.openExternal(SUBSCRIBE_URL)
  }, [])

  const persistAndSync = useCallback(
    (next: Set<string>) => {
      // Persist immediately so a toggle is never lost, but debounce the cache
      // re-sync (download newly-selected). Deselected items stay cached on this
      // auto sync — only a manual "Sync Now" prunes them.
      window.electronAPI.selection.set([...next]).catch((err) => {
        log.warn('selection', 'failed to persist selection', { error: String(err) })
      })
      window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => {
        void syncNow({ trigger: 'auto' })
      }, SYNC_DEBOUNCE_MS)
    },
    [syncNow],
  )

  const items = useMemo(() => gallery?.items ?? [], [gallery])
  const freeCount = gallery?.freeCount ?? DEFAULT_SELECTION_COUNT

  // Locked = a non-subscriber's pieces beyond the free count (in API order).
  // These can't be ticked or cached — the tick becomes a "Subscribe to unlock".
  const lockedSrcs = useMemo(() => {
    if (!gallery || gallery.isSubscribed) return new Set<string>()
    return new Set(gallery.items.slice(freeCount).map((i) => i.src))
  }, [gallery, freeCount])

  const toggle = useCallback(
    (src: string) => {
      if (lockedSrcs.has(src)) return // locked pieces aren't toggleable
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(src)) next.delete(src)
        else next.add(src)
        persistAndSync(next)
        return next
      })
    },
    [persistAndSync, lockedSrcs],
  )

  const switchTab = useCallback(
    (next: Tab) => {
      if (next === 'selected') setSelectedScope(new Set(selected))
      setTab(next)
    },
    [selected],
  )

  const toggleSort = useCallback(() => {
    setSort((prev) => {
      const next = prev === 'oldest' ? 'newest' : 'oldest'
      localStorage.setItem(SORT_KEY, next)
      return next
    })
  }, [])

  const toggleTag = useCallback((t: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  // Distinct tags across the gallery, in canonical pill order (Misc fallback baked in).
  const allTags = useMemo(() => {
    const seen: string[] = []
    const set = new Set<string>()
    for (const item of items) {
      for (const t of tagsOf(item)) {
        if (!set.has(t)) {
          set.add(t)
          seen.push(t)
        }
      }
    }
    return orderTags(seen)
  }, [items])

  // Display order: by date added (undated pieces fall back to launch date).
  const sortedItems = useMemo(() => {
    const dir = sort === 'oldest' ? 1 : -1
    return [...items].sort((a, b) => {
      const da = a.date ?? UNDATED_FALLBACK
      const db = b.date ?? UNDATED_FALLBACK
      return da === db ? 0 : da < db ? -dir : dir
    })
  }, [items, sort])

  const isVisible = useCallback(
    (item: ArtItem): boolean => {
      if (tab === 'selected' && !selectedScope.has(item.src)) return false
      if (activeTags.size > 0 && !tagsOf(item).some((t) => activeTags.has(t))) return false
      if (!matchesQuery(item, query)) return false
      return true
    },
    [tab, selectedScope, activeTags, query],
  )

  const visibleItems = useMemo(() => sortedItems.filter(isVisible), [sortedItems, isVisible])
  const visibleCount = visibleItems.length

  // Select All operates on the currently-shown, unlockable pieces. It toggles:
  // if every shown unlocked piece is already selected, it deselects them;
  // otherwise it selects them all.
  const visibleUnlockedSrcs = useMemo(
    () => visibleItems.filter((it) => !lockedSrcs.has(it.src)).map((it) => it.src),
    [visibleItems, lockedSrcs],
  )
  const allVisibleSelected =
    visibleUnlockedSrcs.length > 0 && visibleUnlockedSrcs.every((s) => selected.has(s))

  const toggleSelectAll = useCallback(() => {
    if (visibleUnlockedSrcs.length === 0) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (visibleUnlockedSrcs.every((s) => next.has(s))) {
        for (const s of visibleUnlockedSrcs) next.delete(s)
      } else {
        for (const s of visibleUnlockedSrcs) next.add(s)
      }
      persistAndSync(next)
      return next
    })
  }, [visibleUnlockedSrcs, persistAndSync])

  // Block the whole view only while we have nothing yet; a refetch keeps the grid.
  if (loading && !gallery) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !gallery) {
    if (!isOnline) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">You’re offline</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your screensaver keeps playing from the cache. Reconnect to browse the gallery — it’ll
              refresh automatically.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchGallery} className="text-primary hover:underline text-sm">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="px-6 pb-8">
      <AppBanners showUpsell={!!gallery && !gallery.isSubscribed} />
      <p className="text-sm text-muted-foreground mb-4">
        Pick the art you want your screensaver to play.
      </p>
      <div className="sticky top-3 z-20 -mx-6 px-6 pt-3 pb-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-5">
            <TabButton active={tab === 'all'} onClick={() => switchTab('all')}>
              All <span className="text-xs opacity-65 tabular-nums">{items.length}</span>
            </TabButton>
            <TabButton active={tab === 'selected'} onClick={() => switchTab('selected')}>
              Selected <span className="text-xs opacity-65 tabular-nums">{selected.size}</span>
            </TabButton>
          </div>

          <button
            onClick={toggleSelectAll}
            disabled={visibleUnlockedSrcs.length === 0}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              allVisibleSelected
                ? 'Deselect all the pieces shown'
                : 'Select all the pieces shown'
            }
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </button>

          <div className="flex-1" />

          {/* Search — narrows the shown pieces by title or tag. */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search the gallery by title or tag"
              className="w-44 rounded-md border border-border bg-transparent pl-8 pr-7 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={toggleSort}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle sort order"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            {sort === 'oldest' ? 'Oldest first' : 'Newest first'}
          </button>
        </div>

        {/* Tag pills */}
        {allTags.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {allTags.map((t) => {
              const on = activeTags.has(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    on
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty states */}
      {selectionReady && tab === 'selected' && selected.size === 0 && (
        <div className="text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg py-12 px-6 mt-2">
          Nothing selected yet. Switch to <b className="text-foreground">All</b> and tick the pieces
          you want your screensaver to play.
        </div>
      )}
      {visibleCount === 0 &&
        items.length > 0 &&
        !(tab === 'selected' && selected.size === 0) && (
          <div className="text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg py-12 px-6 mt-2">
            No pieces match {query.trim() ? <>“{query.trim()}”</> : 'these filters'}.
          </div>
        )}

      {/* Art grid — all cards stay mounted; visibility is toggled so filtering
          and sorting never re-capture posters. */}
      <div
        className="grid gap-4 mt-2"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        {sortedItems.map((item) => (
          <PosterCard
            key={item.src}
            item={item}
            selected={selected.has(item.src)}
            locked={lockedSrcs.has(item.src)}
            hidden={!isVisible(item)}
            onToggle={() => toggle(item.src)}
            onSubscribe={onSubscribe}
            onOpen={() => setModalItem(item)}
          />
        ))}
      </div>

      {modalItem && (
        <ArtModal
          item={modalItem}
          selected={selected.has(modalItem.src)}
          locked={lockedSrcs.has(modalItem.src)}
          onToggle={() => toggle(modalItem.src)}
          onSubscribe={onSubscribe}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-2.5 pt-1.5 text-sm transition-colors ${
        active ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-t" />
      )}
    </button>
  )
}
