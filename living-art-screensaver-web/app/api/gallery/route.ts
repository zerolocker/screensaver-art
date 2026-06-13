import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'

const GALLERY_URL = 'https://zerolocker.github.io/screensaver-art/gallery.json'

// How many artworks free (un-subscribed) users may *play*. Gating is no longer a
// server-side slice — the client renders the whole gallery and locks pieces
// beyond this count for non-subscribers, and cache-sync refuses to download a
// locked piece. We return it as `freeCount` so the client gates at exactly the
// threshold the server defines (no hand-synced magic number on the client side).
// Mirrors PRICING.freeItemCount (the number we *advertise*).
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
 * Returns the FULL gallery playlist for the macOS screensaver app, the caller's
 * subscription state, and the free-tier threshold.
 *
 * Gating happens on the client now, not here: every user gets the whole list so
 * a free user can browse + preview everything; the app locks pieces beyond
 * `freeCount` for non-subscribers and never caches them. (See the Electron app's
 * Gallery + cache-sync.)
 *
 * Auth: Bearer <supabase_access_token> in Authorization header.
 *   - Missing / invalid token → treated as a non-subscriber (never 401, so the
 *     screensaver/app always has something to show during onboarding).
 *
 * Response:
 *   { items: GalleryItem[], isSubscribed: boolean, freeCount: number }
 */
export async function GET(request: NextRequest) {
  // ── Fetch gallery ───────────────────────────────────────────────────────────
  let items: GalleryItem[] = []
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
  return NextResponse.json({ items, isSubscribed, freeCount: FREE_ITEM_COUNT })
}
