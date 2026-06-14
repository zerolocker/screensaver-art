import { useEffect, useRef } from 'react'
import { X, Check, Lock } from 'lucide-react'
import { type ArtItem, tagsOf } from '@screensaver-art/constants'

interface ArtModalProps {
  item: ArtItem
  selected: boolean
  // Locked = a non-subscriber's piece beyond the free count: the add action
  // becomes "Subscribe to unlock".
  locked: boolean
  onToggle: () => void
  onSubscribe: () => void
  onClose: () => void
  // When true, also push the app window into native macOS fullscreen while the
  // preview is open, so the piece fills the whole display (the "Fullscreen"
  // preview mode). When false the preview just fills the app window ("In-app").
  osFullscreen?: boolean
}

function formatDate(date?: string): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// Full-screen preview of a single piece so the art reads the way it will as a
// screensaver. The video fills the viewport with object-cover (mirroring the
// screensaver's AVLayerVideoGravity.resizeAspectFill); the title/tags/date and
// the add/remove (or "Subscribe to unlock") action float over a bottom gradient
// scrim. Clicking anywhere (except that action button), Escape, or the close
// button dismisses — so it's a quick tap back to the gallery.
export function ArtModal({
  item,
  selected,
  locked,
  onToggle,
  onSubscribe,
  onClose,
  osFullscreen,
}: ArtModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Release the media pipeline only when the modal actually unmounts. This MUST
  // stay out of the keydown effect above: onClose is a fresh closure on every
  // parent render, so a combined effect would re-run its cleanup on any Gallery
  // re-render (tapping "Add to screensaver", or supabase refreshing the session
  // on window focus) and strip the <video> src — which React never restores,
  // leaving a black frame with the controls still visible.
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v) {
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [])

  // Drive native macOS fullscreen for the lifetime of the preview, restoring the
  // windowed state on close. No-op (and no IPC) in "In-app" mode.
  useEffect(() => {
    if (!osFullscreen) return
    window.electronAPI?.window?.setFullScreen(true)
    return () => {
      window.electronAPI?.window?.setFullScreen(false)
    }
  }, [osFullscreen])

  const dateStr = formatDate(item.date)
  const meta = [tagsOf(item).join(' · '), dateStr ? `Added ${dateStr}` : null]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <div
      className="fixed inset-0 z-50 bg-black animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <video
        ref={videoRef}
        src={item.src}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover bg-black"
      />

      {/* Close — top-right, clear of the macOS traffic lights (top-left). */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/90 bg-black/40 hover:bg-black/60 border border-white/15 backdrop-blur-sm transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Metadata + action float over a gradient scrim so they stay legible
          over any frame of the art without obscuring it. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-4 p-6 pt-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{item.title}</h3>
          {meta && <p className="text-sm text-white/70 mt-1">{meta}</p>}
        </div>
        {locked ? (
          <button
            onClick={(e) => {
              // The only element that doesn't dismiss the preview.
              e.stopPropagation()
              onSubscribe()
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:brightness-105"
          >
            <Lock className="w-4 h-4" /> Subscribe to unlock
          </button>
        ) : (
          <button
            onClick={(e) => {
              // The only element that toggles instead of dismissing.
              e.stopPropagation()
              onToggle()
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? 'bg-white/10 text-white border border-white/25 backdrop-blur-sm hover:bg-white/20'
                : 'bg-primary text-primary-foreground hover:brightness-105'
            }`}
          >
            {selected ? (
              <>
                <Check className="w-4 h-4" /> In your screensaver
              </>
            ) : (
              'Add to screensaver'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
