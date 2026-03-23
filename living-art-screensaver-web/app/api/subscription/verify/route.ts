import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This endpoint allows the macOS app to verify subscription status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', isActive: false },
        { status: 401 }
      )
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .single()

    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

    return NextResponse.json({
      isActive,
      status: subscription?.status || 'inactive',
      expiresAt: subscription?.current_period_end || null,
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error('Subscription verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error', isActive: false },
      { status: 500 }
    )
  }
}
