import { useEffect, useState, useRef } from 'react'
import { Loader2, Lock, Play } from 'lucide-react'
import { supabase, GALLERY_ENDPOINT } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

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
  const [previewItem, setPreviewItem] = useState<ArtItem | null>(null)

  useEffect(() => {
    fetchGallery()
  }, [session])

  async function fetchGallery() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
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
    <div className="p-6">
      {/* Header */}
      <div className="titlebar-drag mb-6">
        <div className="titlebar-no-drag">
          <h2 className="text-xl font-semibold text-foreground">Gallery</h2>
          <p className="text-sm text-muted-foreground">
            {gallery?.isSubscribed
              ? `${gallery.items.length} art pieces`
              : `${gallery?.items.length} of ${gallery?.totalCount} art pieces (subscribe for full access)`}
          </p>
        </div>
      </div>

      {/* Video preview modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewItem(null)}
        >
          <div className="max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <video
              src={previewItem.src}
              autoPlay
              loop
              muted
              className="w-full rounded-lg"
            />
            <p className="text-center text-foreground mt-3 font-medium">
              {previewItem.title}
            </p>
            <button
              onClick={() => setPreviewItem(null)}
              className="block mx-auto mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Art grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {gallery?.items.map((item, i) => (
          <ArtCard key={i} item={item} onPreview={() => setPreviewItem(item)} />
        ))}

        {/* Locked items placeholder */}
        {!gallery?.isSubscribed && gallery && gallery.totalCount > gallery.items.length && (
          Array.from({ length: Math.min(3, gallery.totalCount - gallery.items.length) }).map((_, i) => (
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
