import { NextRequest } from 'next/server'
import { createNativeClient } from '@/lib/supabase/native-client'
import type { User } from '@supabase/supabase-js'

export interface SubscriptionRow {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
}

export interface NativeAuthResult {
  user: User | null
  isSubscribed: boolean
  subscription: SubscriptionRow | null
}

/**
 * Extracts Bearer token from request, validates the user, and checks subscription.
 * Returns a result object — never throws. Callers decide how to handle unauthenticated requests.
 */
export async function verifyNativeAuth(request: NextRequest): Promise<NativeAuthResult> {
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!accessToken) {
    return { user: null, isSubscribed: false, subscription: null }
  }

  try {
    const supabase = createNativeClient(accessToken)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { user: null, isSubscribed: false, subscription: null }
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, user_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .single()

    const isSubscribed =
      subscription?.status === 'active' || subscription?.status === 'trialing'

    return { user, isSubscribed, subscription: subscription ?? null }
  } catch {
    return { user: null, isSubscribed: false, subscription: null }
  }
}
