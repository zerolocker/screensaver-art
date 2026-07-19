import { Sparkles } from 'lucide-react'
import { Button } from '@screensaver-art/ui'
import { PRICING } from '@screensaver-art/constants'

interface UpsellBannerProps {
  /** Opens the plan-picker modal (lifetime vs subscription). */
  onUnlock: () => void
  /** Number of locked pieces. When > 0 the copy quantifies the wall ("Unlock N
      more artworks") — concrete scarcity converts better than "the full gallery". */
  lockedCount?: number
}

export function UpsellBanner({ onUnlock, lockedCount }: UpsellBannerProps) {
  const headline =
    lockedCount && lockedCount > 0
      ? `Unlock ${lockedCount} more artworks`
      : 'Unlock the full gallery'
  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 mb-6 flex items-center gap-4">
      <div className="p-2 rounded-full bg-primary/15 text-primary shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{headline}</p>
        <p className="text-sm text-muted-foreground">
          You're on the free plan — {PRICING.freeItemCount} artworks. Unlock everything plus new
          pieces added every day from {PRICING.promoPrice}
          {PRICING.interval}, or one payment of {PRICING.lifetimePrice}.
        </p>
      </div>
      <Button onClick={onUnlock} className="shrink-0">
        Unlock
      </Button>
    </div>
  )
}
