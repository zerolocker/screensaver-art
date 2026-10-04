import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Loader2, WifiOff, Search, X, CheckCheck } from 'lucide-react'
import { GALLERY_ENDPOINT } from '../lib/api'
import { usePlanPicker } from '../lib/PlanPickerProvider'
import { AppBanners } from '../components/AppBanners'
import { PosterCard } from '../components/PosterCard'
import { ArtModal } from '../components/ArtModal'
import { TabButton } from '../components/TabButton'
import { Pagination } from '../components/Pagination'
import {
  GallerySettingsMenu,
  type SortOrder,
  type PreviewMode,
} from '../components/GallerySettingsMenu'
import { useGallerySync } from '../lib/SyncProvider'
import { log } from '../lib/log'
import {
  type ArtItem,
  tagsOf,
  orderTags,
  matchesQuery,
  UNDATED_FALLBACK,
  isItemFree,
  isItemLocked,
} from '@screensaver-art/constants'
import type { Session } from '@supabase/supabase-js'

interface GalleryResponse {
  items: ArtItem[]
  isSubscribed: boolean
}

interface GalleryPageProps {
  session: Session
}

type Tab = 'all' | 'free' | 'paid' | 'selected'

const SORT_KEY = 'lart-gallery-sort'
const PREVIEW_MODE_KEY = 'lart-gallery-preview-mode'
// Debounce before re-syncing after a selection change.
const SYNC_DEBOUNCE_MS = 1500
// 3 columns × 17 rows. Each visible card captures a frame from its video, so
// paging bounds the cost. Filters apply before paging.
const PAGE_SIZE = 51

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
  // Zero-based page within the filtered items.
  const [page, setPage] = useState(0)
  // Selection when the "Selected" tab opened, so unticking dims a card instead of hiding it.
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set())
  const [modalItem, setModalItem] = useState<ArtItem | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    () => (localStorage.getItem(PREVIEW_MODE_KEY) as PreviewMode) || 'fullscreen',
  )

  const { syncNow } = useGallerySync()
  const { openPlanPicker } = usePlanPicker()
  const syncTimer = useRef<number | undefined>(undefined)

  const fetchGallery = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = session.access_token
      const res = await fetch(GALLERY_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: GalleryResponse = await res.json()
      setGallery(data)

      // Null selection means the free pieces, as in cache-sync.
      const stored = await window.electronAPI.selection.get()
      const resolved = stored.selected ?? data.items.filter(isItemFree).map((i) => i.src)

      // Drop selected pieces that left the gallery; they'd inflate the count.
      // Keep locked ones so a lapsed subscriber can still deselect them.
      const gallerySrcs = new Set(data.items.map((i) => i.src))
      const cleaned = resolved.filter((src) => gallerySrcs.has(src))
      setSelected(new Set(cleaned))
      setSelectionReady(true)

      // Save the cleaned list. A null selection stays null.
      if (stored.selected && data.items.length > 0 && cleaned.length !== stored.selected.length) {
        log.info('selection', 'pruned orphaned selections', {
          before: stored.selected.length,
          after: cleaned.length,
        })
        window.electronAPI.selection.set(cleaned).catch((err) => {
          log.warn('selection', 'failed to persist cleaned selection', { error: String(err) })
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  // A refetch fails offline: show a notice and recover automatically.
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

  // A lock click opens the plan picker.
  const onSubscribe = useCallback(() => {
    openPlanPicker('gallery_lock')
  }, [openPlanPicker])

  const persistAndSync = useCallback(
    (next: Set<string>) => {
      // Save now; debounce the sync.
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

  // Locked pieces can't be selected; the tick becomes "Subscribe to unlock".
  const lockedSrcs = useMemo(() => {
    if (!gallery || gallery.isSubscribed) return new Set<string>()
    return new Set(gallery.items.filter((i) => isItemLocked(i, gallery.isSubscribed)).map((i) => i.src))
  }, [gallery])

  const toggle = useCallback(
    (src: string) => {
      setSelected((prev) => {
        // A locked piece can be deselected (after a lapse) but not selected.
        if (!prev.has(src) && lockedSrcs.has(src)) return prev
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

  const selectSort = useCallback((next: SortOrder) => {
    setSort(next)
    localStorage.setItem(SORT_KEY, next)
  }, [])

  const selectPreviewMode = useCallback((next: PreviewMode) => {
    setPreviewMode(next)
    localStorage.setItem(PREVIEW_MODE_KEY, next)
  }, [])

  const toggleTag = useCallback((t: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  // Distinct tags, in pill order.
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

  // By date added.
  const sortedItems = useMemo(() => {
    const dir = sort === 'oldest' ? 1 : -1
    return [...items].sort((a, b) => {
      const da = a.date ?? UNDATED_FALLBACK
      const db = b.date ?? UNDATED_FALLBACK
      return da === db ? 0 : da < db ? -dir : dir
    })
  }, [items, sort])

  // Free / Paid come from each piece's `free` flag, not the user's subscription.
  const freeCount = useMemo(() => items.filter(isItemFree).length, [items])
  const paidCount = items.length - freeCount

  const isVisible = useCallback(
    (item: ArtItem): boolean => {
      if (tab === 'selected' && !selectedScope.has(item.src)) return false
      if (tab === 'free' && !isItemFree(item)) return false
      if (tab === 'paid' && isItemFree(item)) return false
      if (activeTags.size > 0 && !tagsOf(item).some((t) => activeTags.has(t))) return false
      if (!matchesQuery(item, query)) return false
      return true
    },
    [tab, selectedScope, activeTags, query],
  )

  const visibleItems = useMemo(() => sortedItems.filter(isVisible), [sortedItems, isVisible])
  const visibleCount = visibleItems.length

  // Clamp: a filter change can shrink the list below the current page.
  const pageCount = Math.max(1, Math.ceil(visibleCount / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageStart = clampedPage * PAGE_SIZE
  // Cards on the current page. The others stay mounted but hidden, so their
  // frames are captured once.
  const pageSrcs = useMemo(
    () => new Set(visibleItems.slice(pageStart, pageStart + PAGE_SIZE).map((it) => it.src)),
    [visibleItems, pageStart],
  )

  // Back to page 1 when the filters change.
  useEffect(() => {
    setPage(0)
  }, [tab, query, activeTags, sort])

  const goToPage = useCallback((next: number) => {
    setPage(next)
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Acts on the shown pieces. "Select all" never selects locked pieces;
  // "Deselect all" also clears locked ones.
  const visibleUnlockedSrcs = useMemo(
    () => visibleItems.filter((it) => !lockedSrcs.has(it.src)).map((it) => it.src),
    [visibleItems, lockedSrcs],
  )
  const canSelectMore = useMemo(
    () => visibleUnlockedSrcs.some((s) => !selected.has(s)),
    [visibleUnlockedSrcs, selected],
  )
  const hasVisibleSelected = useMemo(
    () => visibleItems.some((it) => selected.has(it.src)),
    [visibleItems, selected],
  )
  const selectAllDisabled = visibleUnlockedSrcs.length === 0 && !hasVisibleSelected

  const toggleSelectAll = useCallback(() => {
    if (selectAllDisabled) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (visibleUnlockedSrcs.some((s) => !next.has(s))) {
        for (const s of visibleUnlockedSrcs) next.add(s)
      } else {
        for (const it of visibleItems) if (next.has(it.src)) next.delete(it.src)
      }
      persistAndSync(next)
      return next
    })
  }, [selectAllDisabled, visibleUnlockedSrcs, visibleItems, persistAndSync])

  // Block the view only on first load.
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
      <AppBanners showUpsell={!!gallery && !gallery.isSubscribed} lockedCount={lockedSrcs.size} />
      <p className="text-sm text-muted-foreground">
        Pick the art you want your screensaver to play below.
      </p>
      <div className="sticky top-3 z-20 -mx-6 px-6 pt-3 pb-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-5">
            <TabButton active={tab === 'all'} onClick={() => switchTab('all')}>
              All <span className="text-xs opacity-65 tabular-nums">{items.length}</span>
            </TabButton>
            <TabButton active={tab === 'free'} onClick={() => switchTab('free')}>
              Free <span className="text-xs opacity-65 tabular-nums">{freeCount}</span>
            </TabButton>
            <TabButton active={tab === 'paid'} onClick={() => switchTab('paid')}>
              Paid <span className="text-xs opacity-65 tabular-nums">{paidCount}</span>
            </TabButton>
            <TabButton active={tab === 'selected'} onClick={() => switchTab('selected')}>
              Selected <span className="text-xs opacity-65 tabular-nums">{selected.size}</span>
            </TabButton>
          </div>

          <button
            onClick={toggleSelectAll}
            disabled={selectAllDisabled}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              canSelectMore
                ? 'Select all pieces in the current view (every page, not just this one)'
                : 'Deselect all pieces in the current view (every page, not just this one)'
            }
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {canSelectMore ? 'Select all' : 'Deselect all'}
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

          <GallerySettingsMenu
            sort={sort}
            onSort={selectSort}
            previewMode={previewMode}
            onPreviewMode={selectPreviewMode}
          />
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

      {/* All cards stay mounted and are shown or hidden, so frames are captured once. */}
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
            hidden={!pageSrcs.has(item.src)}
            onToggle={() => toggle(item.src)}
            onSubscribe={onSubscribe}
            onOpen={() => setModalItem(item)}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <Pagination
          page={clampedPage}
          pageCount={pageCount}
          rangeStart={pageStart + 1}
          rangeEnd={Math.min(pageStart + PAGE_SIZE, visibleCount)}
          total={visibleCount}
          onChange={goToPage}
        />
      )}

      {modalItem && (
        <ArtModal
          item={modalItem}
          selected={selected.has(modalItem.src)}
          locked={lockedSrcs.has(modalItem.src)}
          onToggle={() => toggle(modalItem.src)}
          onSubscribe={onSubscribe}
          onClose={() => setModalItem(null)}
          osFullscreen={previewMode === 'fullscreen'}
        />
      )}
    </div>
  )
}
