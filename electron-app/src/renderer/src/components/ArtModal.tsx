import { useEffect, useRef } from 'react'
import { X, Check, Lock } from 'lucide-react'
import { type ArtItem, isRealArtwork, tagsOf } from '@screensaver-art/constants'

interface ArtModalProps {
  item: ArtItem
  selected: boolean
  // Locked: the add button becomes "Unlock", which opens the plan picker.
  locked: boolean
  onToggle: () => void
  onSubscribe: () => void
  onClose: () => void
  // Use native fullscreen while open ("Fullscreen" mode), rather than just the window ("In-app").
  osFullscreen?: boolean
}

function formatDate(date?: string): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// A real artwork's credit, e.g. "Original by Gustave Caillebotte, 1877 · Art
// Institute of Chicago · Public domain · Motion by AI". Null for AI pieces.
// "Original" rather than "Painting", since prints and drawings qualify too.
function artworkCredit(item: ArtItem): string | null {
  if (!isRealArtwork(item) || !item.artist) return null
  return [
    `Original by ${[item.artist, item.original_date].filter(Boolean).join(', ')}`,
    item.museum,
    item.license === 'CC0' ? 'CC0' : 'Public domain',
    'Motion by AI',
  ]
    .filter(Boolean)
    .join(' · ')
}

// A full-screen preview of one piece, filling the view like the screensaver
// does. Clicking anywhere but the action button, Escape, or close dismisses it.
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

  // Release the video only on unmount. Keep this separate from the keydown
  // effect: onClose changes on every parent render, and a shared cleanup would
  // strip the <video> src mid-preview, leaving a black frame.
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v) {
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [])

  // Fullscreen while open, windowed again on close. Nothing in "In-app" mode.
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
  const credit = artworkCredit(item)

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

      {/* Top-right, clear of the traffic lights. */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/90 bg-black/40 hover:bg-black/60 border border-white/15 backdrop-blur-sm transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Title and action over a gradient, legible on any frame. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-4 p-6 pt-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{item.title}</h3>
          {credit && <p className="text-sm text-white/85 mt-1">{credit}</p>}
          {meta && <p className="text-sm text-white/70 mt-1">{meta}</p>}
        </div>
        {locked && !selected ? (
          <button
            onClick={(e) => {
              // The only element that doesn't dismiss the preview.
              e.stopPropagation()
              onSubscribe()
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:brightness-105"
          >
            <Lock className="w-4 h-4" /> Unlock
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
              // Locked but selected (subscription lapsed): only removal is offered.
              locked ? (
                <>
                  <Lock className="w-4 h-4" /> Locked — remove
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> In your screensaver
                </>
              )
            ) : (
              'Add to screensaver'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
