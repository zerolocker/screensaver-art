import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock } from 'lucide-react'
import { observePoster, spawnPreview } from '../lib/poster-engine'
import { type ArtItem, PRICING } from '@screensaver-art/constants'

// Wait this long on hover before spawning a live preview, so a quick mouse
// sweep across the grid doesn't fire up dozens of videos.
const HOVER_DELAY_MS = 220

// Lock-icon upsell tooltip dimensions, used to position it (fixed) just below the
// lock and flip above near the bottom edge.
const TIP_W = 248
const TIP_H = 76

interface PosterCardProps {
  item: ArtItem
  selected: boolean
  // Locked = a non-subscriber's piece beyond the free count. The tick becomes a
  // lock that prompts to subscribe instead of toggling selection.
  locked: boolean
  hidden: boolean
  onToggle: () => void
  onSubscribe: () => void
  onOpen: () => void
}

// One gallery cell: a static first-frame poster (captured by the poster engine),
// a selection tick (or a lock for non-subscribers), and a hover-to-play live
// preview. Always mounted — visibility is toggled via `hidden` (display:none) so
// filtering/sorting never re-captures.
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

  // Instant upsell tooltip for the lock icon — explains what a click does (jump
  // to checkout) before it happens. Rendered in a portal so the card's
  // overflow-hidden can't clip it. Position is computed from the lock's rect.
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const showTip = (e: React.SyntheticEvent<HTMLElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const flipAbove = r.bottom + 8 + TIP_H > window.innerHeight
    const left = Math.max(8, Math.min(r.right - TIP_W, window.innerWidth - 8 - TIP_W))
    setTip({ top: flipAbove ? r.top - 8 - TIP_H : r.bottom + 8, left })
  }
  const hideTip = (): void => setTip(null)

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

      {/* Selection tick — or a lock for non-subscribers. A locked piece that is
          still selected (chosen while subscribed, now lapsed) shows the tick so
          it stays de-selectable; only a locked + unselected piece shows the lock.
          Always visible and above the hover-preview video. */}
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
          aria-label="Subscribe to unlock this piece"
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

      {/* Upsell tooltip for the lock — portaled to <body> so the card's
          overflow-hidden can't clip it; appears instantly (no native title
          delay) and matches the app's popover palette. */}
      {tip &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', top: tip.top, left: tip.left, width: TIP_W }}
            className="z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed">
              <span className="font-medium">Click to subscribe.</span> Unlock the full gallery plus
              new pieces every day for{' '}
              <span className="font-semibold text-primary">
                {PRICING.promoPrice}
                {PRICING.interval}
              </span>
              .
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{PRICING.billingNote}.</p>
          </div>,
          document.body,
        )}
    </div>
  )
}
