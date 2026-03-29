import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'

// This endpoint allows the macOS app and Electron app to verify subscription status
export async function GET(request: NextRequest) {
  const { user, isSubscribed, subscription } = await verifyNativeAuth(request)

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', isActive: false },
      { status: 401 }
    )
  }

  return NextResponse.json({
    isActive: isSubscribed,
    subscription: subscription || null,
  })
}
