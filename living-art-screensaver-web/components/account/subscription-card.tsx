'use client'

import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { SubscriptionCard as SharedSubscriptionCard } from '@screensaver-art/ui'
import type { Subscription } from '@screensaver-art/ui'
import { createCheckoutSession, createCustomerPortalSession } from '@/app/actions/stripe'

interface SubscriptionCardProps {
  subscription: Subscription | null
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const router = useRouter()

  return (
    <SharedSubscriptionCard
      subscription={subscription}
      onCheckout={async (plan) => {
        posthog.capture('subscribe_clicked', { location: 'account_page', plan })
        const productId = plan === 'lifetime' ? 'living-art-lifetime' : 'living-art-monthly'
        const result = await createCheckoutSession(productId, window.location.origin)
        if (result.error) return { error: result.error }
        if (result.url) router.push(result.url)
        return {}
      }}
      onManage={async () => {
        posthog.capture('customer_portal_opened')
        const result = await createCustomerPortalSession(window.location.origin)
        if (result.error) return { error: result.error }
        if (result.url) router.push(result.url)
        return {}
      }}
    />
  )
}
