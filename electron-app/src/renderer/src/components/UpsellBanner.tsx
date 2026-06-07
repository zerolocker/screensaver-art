import { Sparkles } from 'lucide-react'
import { Button, PRICING } from '@screensaver-art/ui'

interface UpsellBannerProps {
  onSubscribe: () => void
}

export function UpsellBanner({ onSubscribe }: UpsellBannerProps) {
  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 mb-6 flex items-center gap-4">
      <div className="p-2 rounded-full bg-primary/15 text-primary shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">Unlock the full gallery</p>
        <p className="text-sm text-muted-foreground">
          You're on the free plan — {PRICING.freeItemCount} artworks. Unlock the full gallery plus a
          new piece every day for {PRICING.promoPrice}
          {PRICING.interval}. {PRICING.billingNote}.
        </p>
      </div>
      <Button onClick={onSubscribe} className="shrink-0">
        Subscribe
      </Button>
    </div>
  )
}
