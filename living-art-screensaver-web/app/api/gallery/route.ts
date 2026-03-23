import { NextRequest, NextResponse } from 'next/server'
import { createNativeClient } from '@/lib/supabase/native-client'

const GALLERY_URL = 'https://zerolocker.github.io/screensaver-art/gallery.json'
const FREE_ITEM_COUNT = 2

interface GalleryItem {
  src: string
  title: string
  type: string
  date?: string
  image_prompt?: string
  video_prompt?: string
  collection?: string
}

/**
 * GET /api/gallery?collection=classic
 *
 * Returns the gallery playlist for the macOS screensaver.
 *
 * Auth: Bearer <supabase_access_token> in Authorization header.
 *   - Active subscriber  → full gallery filtered by collection
 *   - No / expired sub   → first FREE_ITEM_COUNT items only
 *   - No token / invalid → first FREE_ITEM_COUNT items only (never 401, so the
 *                          screensaver always has something to show)
 *
 * Response:
 *   { items: GalleryItem[], isSubscribed: boolean, totalCount: number }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const collection = searchParams.get('collection') ?? null   // null → return all collections

  // ── Fetch & filter gallery ──────────────────────────────────────────────────
  let allItems: GalleryItem[] = []
  try {
    const res = await fetch(GALLERY_URL, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Gallery fetch failed: ${res.status}`)
    allItems = await res.json()
  } catch (err) {
    console.error('Failed to fetch gallery:', err)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 502 })
  }

  // Filter by collection if requested (items without a collection field fall
  // back to "classic" for backwards compatibility)
  const collectionItems = collection
    ? allItems.filter(item => (item.collection ?? 'classic') === collection)
    : allItems

  // ── Resolve subscription ────────────────────────────────────────────────────
  let isSubscribed = false

  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (accessToken) {
    try {
      const supabase = createNativeClient(accessToken)

      // Validate the token by fetching the user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!userError && user) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .single()

        isSubscribed =
          subscription?.status === 'active' || subscription?.status === 'trialing'
      }
    } catch (err) {
      // Invalid token or network error — treat as unauthenticated, serve free tier
      console.error('Subscription check error:', err)
    }
  }

  // ── Return appropriate slice ────────────────────────────────────────────────
  const items = isSubscribed
    ? collectionItems
    : collectionItems.slice(0, FREE_ITEM_COUNT)

  return NextResponse.json({
    items,
    isSubscribed,
    totalCount: collectionItems.length,   // lets the client show "X of Y" in upsell
  })
}
