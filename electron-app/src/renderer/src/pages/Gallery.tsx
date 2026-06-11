import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Lock, Play, ChevronLeft, ChevronRight, X, WifiOff } from 'lucide-react'
import { GALLERY_ENDPOINT } from '../lib/api'
import { AppBanners } from '../components/AppBanners'
import type { Session } from '@supabase/supabase-js'

const ITEMS_PER_PAGE = 12

interface ArtItem {
  src: string
  title: string
  type: string
  collection?: string
}

interface GalleryResponse {
  items: ArtItem[]
  isSubscribed: boolean
  totalCount: number
}

interface GalleryPageProps {
  session: Session
}

export function GalleryPage({ session }: GalleryPageProps) {
  const [gallery, setGallery] = useState<GalleryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [previewItem, setPreviewItem] = useState<ArtItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      setCurrentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  // Track connectivity. The gallery list comes from the server, so a refetch
  // (e.g. after returning to this tab or waking the machine) fails when offline.
  // Rather than flash a scary "Failed to fetch" + "Try again", we show a calm
  // offline notice and re-fetch automatically once the connection is back.
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

  // Escape key closes preview modal
  useEffect(() => {
    if (!previewItem) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [previewItem])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page)
    // Scroll the parent <main> container to top
    scrollRef.current?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Only block the whole view while we have nothing to show yet. A refetch over
  // already-loaded data keeps the gallery on screen instead of flashing a spinner.
  if (loading && !gallery) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !gallery) {
    // Offline is the usual reason a fresh load fails. Show a calm, on-brand notice
    // (the screensaver keeps playing from the cache) and recover automatically —
    // the online/offline effect refetches when the connection returns.
    if (!isOnline) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">You’re offline</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your screensaver keeps playing from the cache. Reconnect to browse the
              gallery — it’ll refresh automatically.
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

  const items = gallery?.items ?? []
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE)
  const isLastPage = currentPage === totalPages

  return (
    <div ref={scrollRef} className="p-6">
      {/* Header */}
      <div className="titlebar-drag mb-6">
        <div className="titlebar-no-drag">
          <h2 className="text-xl font-semibold text-foreground">Gallery</h2>
          <p className="text-sm text-muted-foreground">
            {gallery?.isSubscribed
              ? `${items.length} art pieces`
              : `${items.length} of ${gallery?.totalCount} art pieces (subscribe for full access)`}
          </p>
        </div>
      </div>

      <AppBanners showUpsell={!!gallery && !gallery.isSubscribed} />

      {/* Video preview modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-[fadeIn_150ms_ease-out]"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-4xl w-full mx-6 animate-[scaleIn_150ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-xl overflow-hidden shadow-2xl">
              <video
                src={previewItem.src}
                autoPlay
                loop
                muted
                className="w-full"
              />
              {/* Title overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-5">
                <p className="text-white font-medium text-lg">{previewItem.title}</p>
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute -top-3 -right-3 bg-secondary/80 hover:bg-secondary border border-border rounded-full p-1.5 transition-colors"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Art grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedItems.map((item) => (
          <ArtCard key={item.src} item={item} onPreview={() => setPreviewItem(item)} />
        ))}

        {/* Locked items placeholder (last page only) */}
        {isLastPage && !gallery?.isSubscribed && gallery && gallery.totalCount > items.length && (
          Array.from({ length: Math.min(3, gallery.totalCount - items.length) }).map((_, i) => (
            <div
              key={`locked-${i}`}
              className="aspect-video rounded-lg bg-secondary/50 border border-border flex flex-col items-center justify-center gap-2"
            >
              <Lock className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Subscribe to unlock</p>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 pb-4">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

function ArtCard({ item, onPreview }: { item: ArtItem; onPreview: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <button
      onClick={onPreview}
      className="group relative aspect-video rounded-lg overflow-hidden border border-border bg-secondary hover:border-primary/50 transition-colors text-left"
    >
      <video
        ref={videoRef}
        src={item.src}
        muted
        loop
        preload="metadata"
        className="w-full h-full object-cover"
        onMouseEnter={() => videoRef.current?.play()}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
          }
        }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
        <p className="text-white text-sm font-medium">{item.title}</p>
      </div>
      {/* Play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/50 rounded-full p-2">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </div>
    </button>
  )
}
