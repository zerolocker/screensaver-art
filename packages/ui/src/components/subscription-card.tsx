'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { PRICING } from '@screensaver-art/constants'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
}

export interface SubscriptionCardProps {
  subscription: Subscription | null
  /** Called when the user clicks "Subscribe". The host app handles Stripe checkout. */
  onSubscribe: () => Promise<{ error?: string }>
  /** Called when the user clicks "Manage Subscription". The host app handles Stripe portal. */
  onManage: () => Promise<{ error?: string }>
}

const statusConfig = {
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

export function SubscriptionCard({ subscription, onSubscribe, onManage }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false)

  const status = subscription?.status || 'inactive'
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive
  const StatusIcon = config.icon

  const isActive = status === 'active' || status === 'trialing'

  async function handleSubscribe() {
    setLoading(true)
    const result = await onSubscribe()
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
  }

  async function handleManage() {
    setLoading(true)
    const result = await onManage()
    if (result.error) {
      alert(result.error)
    }
    setLoading(false)
  }

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
            {isActive && subscription?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {isActive ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-medium text-foreground">Living Art Screensaver</p>
              <p className="text-sm text-muted-foreground">{PRICING.promoPrice}{PRICING.interval}</p>
              <p className="text-xs text-muted-foreground/80">{PRICING.billingNote}</p>
            </div>
            <Button
              onClick={handleManage}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Manage Subscription'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
             You're on the free plan — {PRICING.freeItemCount} artworks. Subscribe to unlock the full gallery plus new pieces every day.
            </p>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="mt-2 flex items-end gap-2">
                <span className="text-lg font-semibold text-muted-foreground line-through">
                  {PRICING.regularPrice}
                </span>
                <span className="text-3xl font-bold text-foreground leading-none">{PRICING.promoPrice}</span>
                <span className="text-muted-foreground">{PRICING.interval}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {PRICING.billingNote} · promo price valid through {PRICING.promoThrough}
              </p>
            </div>
            <Button
              onClick={handleSubscribe}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Subscribe'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
