import { NextRequest, NextResponse } from 'next/server'
import { createNativeClient } from '@/lib/supabase/native-client'

// This endpoint allows the macOS app and Electron app to verify subscription status
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized', isActive: false },
      { status: 401 }
    )
  }

  try {
    const supabase = createNativeClient(accessToken)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', isActive: false },
        { status: 401 }
      )
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, user_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .single()

    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

    return NextResponse.json({
      isActive,
      subscription: subscription || null,
    })
  } catch (error) {
    console.error('Subscription verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error', isActive: false },
      { status: 500 }
    )
  }
}
