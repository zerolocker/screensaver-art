import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Loader2, WifiOff, Search, X, CheckCheck, SlidersHorizontal, Check } from 'lucide-react'
import { GALLERY_ENDPOINT } from '../lib/api'
import { startCheckout } from '../lib/checkout'
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
type SortOrder = 'oldest' | 'newest'
// How a clicked piece previews: 'fullscreen' fills the whole display (native
// macOS fullscreen, with its brief Space animation); 'in-app' fills just the
// app window instantly. Default is 'fullscreen' — the more impressive preview.
type PreviewMode = 'fullscreen' | 'in-app'

const SORT_KEY = 'lart-gallery-sort'
const PREVIEW_MODE_KEY = 'lart-gallery-preview-mode'
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    () => (localStorage.getItem(PREVIEW_MODE_KEY) as PreviewMode) || 'fullscreen',
  )

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

      // Resolve the selection: stored explicit list, or the default free set
      // (the same default cache-sync applies for a null selection).
      const stored = await window.electronAPI.selection.get()
      const resolved = stored.selected ?? data.items.filter(isItemFree).map((i) => i.src)

      // Drop "orphans" — selected pieces no longer in the gallery (e.g. curated
      // out of gallery.json). They render no card, so they'd otherwise inflate
      // the "Selected" count and leave "Deselect all" unable to reach zero.
      // Locked-but-present pieces are intentionally KEPT (shown with a tick) so a
      // lapsed subscriber can still de-select them.
      const gallerySrcs = new Set(data.items.map((i) => i.src))
      const cleaned = resolved.filter((src) => gallerySrcs.has(src))
      setSelected(new Set(cleaned))
      setSelectionReady(true)

      // Self-heal the persisted file when we dropped orphans from an explicit
      // selection. A null/default selection stays null (don't materialize it).
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
    void startCheckout('gallery_lock')
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

  // Locked = a non-subscriber's non-free pieces (the `free` flag is per-item, so
  // these are interleaved through the grid, not clustered at the end). They can't
  // be ticked or cached — the tick becomes a "Subscribe to unlock".
  const lockedSrcs = useMemo(() => {
    if (!gallery || gallery.isSubscribed) return new Set<string>()
    return new Set(gallery.items.filter((i) => isItemLocked(i, gallery.isSubscribed)).map((i) => i.src))
  }, [gallery])

  const toggle = useCallback(
    (src: string) => {
      setSelected((prev) => {
        // A locked piece can be de-selected (it was selected while subscribed,
        // and is now locked after the subscription lapsed) but never newly
        // selected — that path prompts to subscribe instead.
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

  // Free / Paid are per-item (the `free` flag), independent of subscription — the
  // "Paid" pieces are the subscriber-only ones (locked for non-subscribers).
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

  // Select All operates on the currently-shown pieces. While any unlocked shown
  // piece is still off it reads "Select all" and turns them all on; once they're
  // all on it flips to "Deselect all", which clears every selected shown piece —
  // including locked-but-selected ones, so a lapsed subscriber can clear them in
  // one click. (Select never turns a locked piece on — that needs a sub.)
  const visibleUnlockedSrcs = useMemo(
    () => visibleItems.filter((it) => !lockedSrcs.has(it.src)).map((it) => it.src),
    [visibleItems, lockedSrcs],
  )
  const visibleSelectedSrcs = useMemo(
    () => visibleItems.filter((it) => selected.has(it.src)).map((it) => it.src),
    [visibleItems, selected],
  )
  const canSelectMore = useMemo(
    () => visibleUnlockedSrcs.some((s) => !selected.has(s)),
    [visibleUnlockedSrcs, selected],
  )
  const selectAllDisabled = visibleUnlockedSrcs.length === 0 && visibleSelectedSrcs.length === 0

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
              canSelectMore ? 'Select all the pieces shown' : 'Deselect all the pieces shown'
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

          <SettingsMenu
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
          osFullscreen={previewMode === 'fullscreen'}
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
      className={`relative py-2 text-sm transition-colors ${
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

// Gear menu for view options: sort order + how a clicked piece previews. Closes
// on outside click or Escape; stays open while toggling so several settings can
// be changed at once.
function SettingsMenu({
  sort,
  onSort,
  previewMode,
  onPreviewMode,
}: {
  sort: SortOrder
  onSort: (s: SortOrder) => void
  previewMode: PreviewMode
  onPreviewMode: (m: PreviewMode) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="View options"
        className={`flex items-center gap-1.5 text-sm transition-colors ${
          open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Options
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-lg p-1.5 z-30 animate-[fadeIn_120ms_ease-out]"
        >
          <MenuLabel>Sort order</MenuLabel>
          <MenuRadio active={sort === 'oldest'} onClick={() => onSort('oldest')}>
            Oldest first
          </MenuRadio>
          <MenuRadio active={sort === 'newest'} onClick={() => onSort('newest')}>
            Newest first
          </MenuRadio>

          <div className="my-1.5 h-px bg-border" />

          <MenuLabel>Preview a piece in</MenuLabel>
          <MenuRadio active={previewMode === 'fullscreen'} onClick={() => onPreviewMode('fullscreen')}>
            Fullscreen
          </MenuRadio>
          <MenuRadio active={previewMode === 'in-app'} onClick={() => onPreviewMode('in-app')}>
            In-app window
          </MenuRadio>
        </div>
      )}
    </div>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  )
}

function MenuRadio({
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
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
    >
      <span>{children}</span>
      {active && <Check className="w-4 h-4 text-primary" />}
    </button>
  )
}
