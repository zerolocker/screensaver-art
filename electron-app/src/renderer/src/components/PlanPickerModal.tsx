import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@screensaver-art/ui'
import { PRICING, type PaidPlan } from '@screensaver-art/constants'

interface PlanPickerModalProps {
  /** Kick off checkout for the chosen plan. The picker closes itself after. */
  onCheckout: (plan: PaidPlan) => void
  onClose: () => void
}

// The one step between any "Unlock" CTA and Stripe: pick lifetime (pre-selected
// — it's the better deal and the one we lead with) or the subscription. Rendered
// in a portal above everything, including the fullscreen art preview (z-50).
export function PlanPickerModal({ onCheckout, onClose }: PlanPickerModalProps) {
  const [plan, setPlan] = useState<PaidPlan>('lifetime')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const options: {
    id: PaidPlan
    title: string
    badge?: string
    price: string
    priceSuffix: string
    note: string
  }[] = [
    {
      id: 'lifetime',
      title: PRICING.lifetimeLabel,
      badge: 'Best value',
      price: PRICING.lifetimePrice,
      priceSuffix: 'once',
      note: PRICING.lifetimeNote,
    },
    {
      id: 'monthly',
      title: 'Subscribe',
      price: PRICING.promoPrice,
      priceSuffix: PRICING.interval,
      note: `${PRICING.billingNote}. Cancel anytime.`,
    },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unlock the full gallery"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Unlock the full gallery</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlock all artworks, plus new pieces added every night.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {options.map((opt) => {
            const active = plan === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setPlan(opt.id)}
                role="radio"
                aria-checked={active}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-secondary/50 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${
                      active ? 'border-primary' : 'border-muted-foreground/50'
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground">{opt.title}</span>
                    {opt.badge && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {opt.badge}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0">
                    <span className="text-lg font-bold text-foreground">{opt.price}</span>{' '}
                    <span className="text-sm text-muted-foreground">{opt.priceSuffix}</span>
                  </span>
                </div>
                <p className="mt-1 pl-7 text-sm text-muted-foreground">{opt.note}</p>
              </button>
            )
          })}
        </div>

        <Button className="mt-5 w-full" onClick={() => onCheckout(plan)}>
          {plan === 'lifetime'
            ? `Unlock forever · ${PRICING.lifetimePrice}`
            : `Subscribe · ${PRICING.promoPrice}${PRICING.interval}`}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
