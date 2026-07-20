'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, Infinity } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import {
  PRICING,
  normalizeSubscriptionStatus,
  type PaidPlan,
  type SubscriptionStatus,
} from '@screensaver-art/constants'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  /** Set once the one-time "Own it forever" purchase completed. */
  lifetime_purchased_at?: string | null
  /** Stripe-hosted receipt for that purchase, captured by the webhook. */
  lifetime_receipt_url?: string | null
}

export interface SubscriptionCardProps {
  subscription: Subscription | null
  /** Called when the user starts a purchase. The host app handles Stripe checkout. */
  onCheckout: (plan: PaidPlan) => Promise<{ error?: string }>
  /** Called when the user clicks "Manage Subscription". The host app handles Stripe portal. */
  onManage: () => Promise<{ error?: string }>
  /** Opens an external URL (the receipt). Electron passes shell.openExternal; web defaults to a new tab. */
  openExternal?: (url: string) => void
}

// Keyed by the canonical vocabulary, so TypeScript enforces that every status
// the normalizer can return has a chip (no silent fallback to "Inactive").
const statusConfig: Record<
  SubscriptionStatus,
  { icon: typeof CheckCircle; label: string; color: string; bgColor: string }
> = {
  active: {
    icon: CheckCircle,
    label: 'Active',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  inactive: {
    icon: XCircle,
    label: 'Inactive',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  past_due: {
    icon: AlertCircle,
    label: 'Past Due',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  trialing: {
    icon: Clock,
    label: 'Trial',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
}

// Three states (see the account screenshots):
//   1. Lifetime owner — terminal "Your plan: Lifetime" card, nothing to sell.
//   2. Active subscriber — status + current plan, an "Own it forever" upgrade
//      box, and Manage.
//   3. Free (or lapsed) — "Unlock the gallery" with both offers, lifetime
//      featured.
export function SubscriptionCard({
  subscription,
  onCheckout,
  onManage,
  openExternal,
}: SubscriptionCardProps) {
  // Which action is in flight — keys the spinner to the clicked button while
  // disabling all of them.
  const [loading, setLoading] = useState<'lifetime' | 'monthly' | 'manage' | null>(null)

  // Normalize on read too: rows written before the webhook normalized (or by any
  // other writer) can still carry Stripe's `canceled`, which would otherwise miss
  // the lookup and render as "Inactive".
  const status = normalizeSubscriptionStatus(subscription?.status)
  const config = statusConfig[status]
  const StatusIcon = config.icon

  const isLifetime = Boolean(subscription?.lifetime_purchased_at)
  const isActive = status === 'active' || status === 'trialing'

  const openReceipt = () => {
    const url = subscription?.lifetime_receipt_url
    if (!url) return
    if (openExternal) openExternal(url)
    else window.open(url, '_blank', 'noopener')
  }

  async function run(action: 'lifetime' | 'monthly' | 'manage', fn: () => Promise<{ error?: string }>) {
    setLoading(action)
    const result = await fn()
    if (result.error) {
      alert(result.error)
    }
    setLoading(null)
  }

  const spinner = <Loader2 className="mr-2 h-4 w-4 animate-spin" />

  // ── 1. Lifetime owner — terminal state ────────────────────────────────────
  if (isLifetime) {
    const purchased = subscription?.lifetime_purchased_at
      ? new Date(subscription.lifetime_purchased_at).toLocaleDateString()
      : null
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Your plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Infinity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Lifetime</p>
              <p className="text-sm text-muted-foreground">Unlocked forever — paid once</p>
            </div>
          </div>
          {purchased && (
            <p className="text-sm text-muted-foreground">
              Purchased {purchased}
              {subscription?.lifetime_receipt_url && (
                <>
                  {' · '}
                  <button
                    onClick={openReceipt}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    View receipt
                  </button>
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── 2. Active subscriber — current plan + upgrade path ────────────────────
  if (isActive) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <p className="font-medium text-foreground">{config.label}</p>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-medium text-foreground">Living Art Screensaver</p>
              <p className="text-sm text-muted-foreground">{PRICING.promoPrice}{PRICING.interval}</p>
              <p className="text-xs text-muted-foreground/80">{PRICING.billingNote}</p>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <div>
                <p className="font-medium text-foreground">{PRICING.lifetimeLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Stop paying monthly — one payment unlocks everything for good, including all
                  future art.
                </p>
              </div>
              <Button
                onClick={() => run('lifetime', () => onCheckout('lifetime'))}
                variant="outline"
                className="w-full"
                disabled={loading !== null}
              >
                {loading === 'lifetime' ? spinner : null}
                Upgrade to Lifetime · {PRICING.lifetimePrice}
              </Button>
              <p className="text-xs text-muted-foreground/80 text-center">
                Your subscription ends automatically — no double billing.
              </p>
            </div>

            <Button
              onClick={() => run('manage', onManage)}
              variant="outline"
              className="w-full"
              disabled={loading !== null}
            >
              {loading === 'manage' ? spinner : null}
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── 3. Free plan (incl. lapsed/past-due) — both offers, lifetime featured ─
  // @container: the two offer boxes go side-by-side when the *card* (not the
  // viewport) is wide — wide in the Electron app, stacked in the website's
  // half-width account grid.
  return (
    <Card className="bg-card border-border @container">
      <CardHeader>
        <CardTitle className="text-foreground">Unlock the gallery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Keep a lapsed/past-due subscriber informed about their old sub. */}
        {subscription && status !== 'inactive' && (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${config.color}`} />
            </div>
            <p className="font-medium text-foreground">{config.label}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          You&apos;re on the free plan. Unlock all artworks plus new pieces added every day, two
          ways:
        </p>

        <div className="grid gap-4 @2xl:grid-cols-2">
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-primary/5 border border-primary/40">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{PRICING.lifetimeLabel}</p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Best value
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground leading-none">
                {PRICING.lifetimePrice}
              </span>
              <span className="text-muted-foreground">once</span>
            </div>
            <p className="text-xs text-muted-foreground/80">{PRICING.lifetimeNote}</p>
            <Button
              onClick={() => run('lifetime', () => onCheckout('lifetime'))}
              variant="outline"
              className="w-full mt-auto"
              disabled={loading !== null}
            >
              {loading === 'lifetime' ? spinner : null}
              Buy once - own it forever
            </Button>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="font-medium text-foreground">Subscribe</p>
            <div className="flex items-end gap-2">
              <span className="text-lg font-semibold text-muted-foreground line-through">
                {PRICING.regularPrice}
              </span>
              <span className="text-3xl font-bold text-foreground leading-none">{PRICING.promoPrice}</span>
              <span className="text-muted-foreground">{PRICING.interval}</span>
            </div>
            <p className="text-xs text-muted-foreground/80">
              {PRICING.billingNote} · promo through {PRICING.promoThrough} · cancel anytime
            </p>
            <Button
              onClick={() => run('monthly', () => onCheckout('monthly'))}
              variant="outline"
              className="w-full mt-auto"
              disabled={loading !== null}
            >
              {loading === 'monthly' ? spinner : null}
              Subscribe
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
