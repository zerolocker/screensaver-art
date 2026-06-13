import { useEffect, useRef } from 'react'
import { X, Check } from 'lucide-react'
import { type ArtItem, tagsOf } from '../lib/gallery-types'

interface ArtModalProps {
  item: ArtItem
  selected: boolean
  onToggle: () => void
  onClose: () => void
}

function formatDate(date?: string): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// Larger preview of a single piece with its metadata (title, tags, date added)
// and an add/remove action. Click-outside or Escape closes.
export function ArtModal({ item, selected, onToggle, onClose }: ArtModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Release the media pipeline when the modal closes.
      const v = videoRef.current
      if (v) {
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [onClose])

  const dateStr = formatDate(item.date)
  const meta = [tagsOf(item).join(' · '), dateStr ? `Added ${dateStr}` : null]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative w-[min(880px,calc(100vw-48px))] animate-[scaleIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={item.src}
          autoPlay
          loop
          muted
          playsInline
          className="w-full aspect-video object-cover bg-black rounded-t-xl"
        />
        <div className="flex items-center gap-4 bg-card border border-t-0 border-border rounded-b-xl p-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
          </div>
          <button
            onClick={onToggle}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'bg-secondary text-foreground border border-border hover:bg-muted'
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
        </div>

        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-secondary hover:bg-muted border border-border rounded-full p-1.5 transition-colors"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>
      </div>
    </div>
  )
}
