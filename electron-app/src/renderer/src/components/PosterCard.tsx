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
        // z-0 keeps the live preview above the canvas but below the always-on
        // title and selection tick (both z-10).
        preview.video.className =
          'absolute inset-0 w-full h-full object-cover pointer-events-none z-0'
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
      className="group relative isolate aspect-video rounded-lg overflow-hidden border border-border bg-secondary cursor-pointer transition-colors hover:border-primary/50"
    >
      <canvas ref={canvasRef} width={480} height={270} className="w-full h-full object-cover block" />

      {/* Title — always visible (z-10 keeps it above the hover-preview video). */}
      <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/75 to-transparent pointer-events-none z-10">
        <p className="text-white text-xs font-medium truncate">{item.title}</p>
      </div>

      {/* Selection tick — always visible and above the hover-preview video. */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        title={selected ? 'Playing — click to remove' : 'Add to your screensaver'}
        className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 ${
          selected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'bg-black/50 border-white/80 text-transparent hover:border-white hover:bg-black/70'
        }`}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
    </div>
  )
}
