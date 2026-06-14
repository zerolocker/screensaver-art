import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'
import { FREE_ITEM_COUNT, type ArtItem, type GalleryApiResponse } from '@screensaver-art/constants'

const GALLERY_URL = 'https://zerolocker.github.io/screensaver-art/gallery.json'

/**
 * GET /api/gallery
 *
 * Returns the FULL gallery playlist for the macOS screensaver app, the caller's
 * subscription state, and the free-tier threshold.
 *
 * Gating happens on the client now, not here: every user gets the whole list so
 * a free user can browse + preview everything; the app locks pieces beyond
 * `freeCount` for non-subscribers and never caches them. (See the Electron app's
 * Gallery + cache-sync.) `freeCount` is the shared `FREE_ITEM_COUNT` — published
 * here so the client gates at exactly the threshold the server defines.
 *
 * Auth: Bearer <supabase_access_token> in Authorization header.
 *   - Missing / invalid token → treated as a non-subscriber (never 401, so the
 *     screensaver/app always has something to show during onboarding).
 *
 * Response: GalleryApiResponse
 *   { items: ArtItem[], isSubscribed: boolean, freeCount: number }
 */
export async function GET(request: NextRequest) {
  // ── Fetch gallery ───────────────────────────────────────────────────────────
  let items: ArtItem[] = []
  try {
    const res = await fetch(GALLERY_URL, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Gallery fetch failed: ${res.status}`)
    items = await res.json()
  } catch (err) {
    console.error('Failed to fetch gallery:', err)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 502 })
  }

  // ── Resolve subscription ────────────────────────────────────────────────────
  const { isSubscribed } = await verifyNativeAuth(request)

  // ── Return the full list + the gating threshold ─────────────────────────────
  const body: GalleryApiResponse = { items, isSubscribed, freeCount: FREE_ITEM_COUNT }
  return NextResponse.json(body)
}
