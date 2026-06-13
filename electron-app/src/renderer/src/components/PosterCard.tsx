import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { observePoster, spawnPreview } from '../lib/poster-engine'
import type { ArtItem } from '../lib/gallery-types'

// Wait this long on hover before spawning a live preview, so a quick mouse
// sweep across the grid doesn't fire up dozens of videos.
const HOVER_DELAY_MS = 220

interface PosterCardProps {
  item: ArtItem
  selected: boolean
  hidden: boolean
  onToggle: () => void
  onOpen: () => void
}

// One gallery cell: a static first-frame poster (captured by the poster engine),
// a selection tick, and a hover-to-play live preview. Always mounted — visibility
// is toggled via `hidden` (display:none) so filtering/sorting never re-captures.
export function PosterCard({ item, selected, hidden, onToggle, onOpen }: PosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Lazy first-frame capture once the cell nears the viewport.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return observePoster(canvas, item.src)
  }, [item.src])

  // Hover preview: spawn a live video after a short delay, tear it down on leave.
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    let timer: number | undefined
    let preview: ReturnType<typeof spawnPreview> | null = null

    const enter = (): void => {
      timer = window.setTimeout(() => {
        preview = spawnPreview(item.src, () => {
          if (preview) preview.video.style.opacity = '1'
        })
        preview.video.className =
          'absolute inset-0 w-full h-full object-cover pointer-events-none'
        preview.video.style.opacity = '0'
        preview.video.style.transition = 'opacity 150ms'
        card.appendChild(preview.video)
      }, HOVER_DELAY_MS)
    }
    const leave = (): void => {
      window.clearTimeout(timer)
      preview?.destroy()
      preview = null
    }
    card.addEventListener('mouseenter', enter)
    card.addEventListener('mouseleave', leave)
    return () => {
      window.clearTimeout(timer)
      preview?.destroy()
      card.removeEventListener('mouseenter', enter)
      card.removeEventListener('mouseleave', leave)
    }
  }, [item.src])

  return (
    <div
      ref={cardRef}
      onClick={onOpen}
      style={hidden ? { display: 'none' } : undefined}
      className={`group relative aspect-video rounded-lg overflow-hidden border bg-secondary cursor-pointer transition-all hover:border-primary/50 ${
        selected ? 'border-border' : 'border-border opacity-40 saturate-50 hover:opacity-70'
      }`}
    >
      <canvas ref={canvasRef} width={480} height={270} className="w-full h-full object-cover block" />

      {/* Title overlay (on hover) */}
      <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-white text-xs font-medium truncate">{item.title}</p>
      </div>

      {/* Selection tick */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        title={selected ? 'Playing — click to remove' : 'Add to your screensaver'}
        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 ${
          selected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'bg-black/40 border-white/70 text-transparent hover:border-white'
        }`}
      >
        <Check className="w-3 h-3" strokeWidth={3.5} />
      </button>
    </div>
  )
}
