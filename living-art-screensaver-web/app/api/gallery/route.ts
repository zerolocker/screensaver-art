import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'

const GALLERY_URL = 'https://zerolocker.github.io/screensaver-art/gallery.json'
export const FREE_ITEM_COUNT = 100

interface GalleryItem {
  src: string
  title: string
  type: string
  date?: string
  image_prompt?: string
  video_prompt?: string
}

/**
 * GET /api/gallery
 *
 * Returns the gallery playlist for the macOS screensaver.
 *
 * Auth: Bearer <supabase_access_token> in Authorization header.
 *   - Active subscriber  → full gallery
 *   - No / expired sub   → first FREE_ITEM_COUNT items only
 *   - No token / invalid → first FREE_ITEM_COUNT items only (never 401, so the
 *                          screensaver always has something to show)
 *
 * Response:
 *   { items: GalleryItem[], isSubscribed: boolean, totalCount: number }
 */
export async function GET(request: NextRequest) {
  // ── Fetch gallery ───────────────────────────────────────────────────────────
  let allItems: GalleryItem[] = []
  try {
    const res = await fetch(GALLERY_URL, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Gallery fetch failed: ${res.status}`)
    allItems = await res.json()
  } catch (err) {
    console.error('Failed to fetch gallery:', err)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 502 })
  }

  // ── Resolve subscription ────────────────────────────────────────────────────
  const { isSubscribed } = await verifyNativeAuth(request)

  // ── Return appropriate slice ────────────────────────────────────────────────
  const items = isSubscribed ? allItems : allItems.slice(0, FREE_ITEM_COUNT)

  return NextResponse.json({
    items,
    isSubscribed,
    totalCount: allItems.length,   // lets the client show "X of Y" in upsell
  })
}
