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
      onSubscribe={async () => {
        posthog.capture('subscribe_clicked', { location: 'account_page' })
        const result = await createCheckoutSession('living-art-monthly', window.location.origin)
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
