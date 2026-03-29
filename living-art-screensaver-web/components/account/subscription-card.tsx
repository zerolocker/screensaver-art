'use client'

import { useRouter } from 'next/navigation'
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
        const result = await createCheckoutSession('living-art-monthly', window.location.origin)
        if (result.error) return { error: result.error }
        if (result.url) router.push(result.url)
        return {}
      }}
      onManage={async () => {
        const result = await createCustomerPortalSession(window.location.origin)
        if (result.error) return { error: result.error }
        if (result.url) router.push(result.url)
        return {}
      }}
    />
  )
}
