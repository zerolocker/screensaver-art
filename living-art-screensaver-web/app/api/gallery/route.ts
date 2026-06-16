import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'
import { type ArtItem, type GalleryApiResponse } from '@screensaver-art/constants'

const GALLERY_URL = 'https://zerolocker.github.io/screensaver-art/gallery.json'

/**
 * GET /api/gallery
 *
 * Returns the FULL gallery playlist for the macOS screensaver app plus the
 * caller's subscription state.
 *
 * Gating happens on the client now, not here: every user gets the whole list so
 * a free user can browse + preview everything. Free-ness is per-item — each
 * gallery.json entry carries a `free` flag (interleaved through the catalog) —
 * and the app locks non-free pieces for non-subscribers and never caches them
 * (see the Electron app's Gallery + cache-sync, and `isItemLocked`).
 *
 * Auth: Bearer <supabase_access_token> in Authorization header.
 *   - Missing / invalid token → treated as a non-subscriber (never 401, so the
 *     screensaver/app always has something to show during onboarding).
 *
 * Response: GalleryApiResponse
 *   { items: ArtItem[], isSubscribed: boolean }
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

  // ── Return the full list (per-item `free` flag rides along for client gating) ─
  const body: GalleryApiResponse = { items, isSubscribed }
  return NextResponse.json(body)
}
