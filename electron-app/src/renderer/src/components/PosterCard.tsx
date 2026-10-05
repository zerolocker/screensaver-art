import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock } from 'lucide-react'
import { observePoster, spawnPreview } from '../lib/poster-engine'
import { type ArtItem } from '@screensaver-art/constants'

// Hover delay before a preview plays, so sweeping the mouse starts nothing.
const HOVER_DELAY_MS = 220

// Tooltip size, for placing it below the lock (or above, near the bottom edge).
const TIP_W = 248
const TIP_H = 76

interface PosterCardProps {
  item: ArtItem
  selected: boolean
  // Locked: the tick becomes a lock that opens the plan picker.
  locked: boolean
  hidden: boolean
  onToggle: () => void
  onSubscribe: () => void
  onOpen: () => void
}

// A gallery card: first-frame poster, selection tick (or lock), and a hover
// preview. Hidden rather than unmounted, so its frame is captured once.
export function PosterCard({
  item,
  selected,
  locked,
  hidden,
  onToggle,
  onSubscribe,
  onOpen,
}: PosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const showTip = (e: React.SyntheticEvent<HTMLElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const flipAbove = r.bottom + 8 + TIP_H > window.innerHeight
    const left = Math.max(8, Math.min(r.right - TIP_W, window.innerWidth - 8 - TIP_W))
    setTip({ top: flipAbove ? r.top - 8 - TIP_H : r.bottom + 8, left })
  }
  const hideTip = (): void => setTip(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return observePoster(canvas, item.src)
  }, [item.src])

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
        // Above the canvas, below the title and tick (z-10).
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

      {/* Title, above the preview video. */}
      <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/75 to-transparent pointer-events-none z-10">
        <p className="text-white text-xs font-medium truncate">{item.title}</p>
      </div>

      {/* A tick, or a lock. A locked piece that's still selected (after a lapse)
          shows the tick so it can be deselected. */}
      {locked && !selected ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            hideTip()
            onSubscribe()
          }}
          onMouseEnter={showTip}
          onMouseLeave={hideTip}
          onFocus={showTip}
          onBlur={hideTip}
          aria-label="Unlock this piece"
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white/80 bg-black/55 text-white cursor-pointer transition-all hover:scale-110 hover:border-white hover:bg-black/75"
        >
          <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          title={
            selected
              ? locked
                ? 'Locked — click to remove (subscribe to play)'
                : 'Playing — click to remove'
              : 'Add to your screensaver'
          }
          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 ${
            selected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-black/50 border-white/80 text-transparent hover:border-white hover:bg-black/70'
          }`}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
      )}

      {/* Lock tooltip, portaled so the card can't clip it. */}
      {tip &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', top: tip.top, left: tip.left, width: TIP_W }}
            className="z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed">
              You&apos;re on the free plan. Click to unlock all artworks (including this) plus new
              pieces added every day with paid plans.
            </p>
          </div>,
          document.body,
        )}
    </div>
  )
}
