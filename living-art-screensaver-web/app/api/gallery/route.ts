import { NextRequest, NextResponse } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'
import { fetchRepoFile } from '@/lib/github-release'
import { type ArtItem, type GalleryApiResponse } from '@screensaver-art/constants'

const GALLERY_PATH = 'gallery.json'
const REVALIDATE_SECONDS = 300

/**
 * GET /api/gallery: the full gallery plus whether the caller is subscribed.
 * Everyone gets every piece; the app locks non-free pieces itself
 * (`isItemLocked`).
 *
 * gallery.json is read from `master` through the GitHub API, so a push is the
 * whole deploy and a private repo still works. A missing token returns 500.
 *
 * Auth: optional `Authorization: Bearer <supabase_access_token>`. A missing or
 * invalid token means "not subscribed", never a 401.
 */
export async function GET(request: NextRequest) {
  const token = process.env.GITHUB_RELEASE_TOKEN
  if (!token) {
    console.error('[gallery] GITHUB_RELEASE_TOKEN is not set')
    return NextResponse.json(
      { error: 'Gallery is temporarily unavailable (server not configured).' },
      { status: 500 },
    )
  }

  let items: ArtItem[] = []
  try {
    items = JSON.parse(await fetchRepoFile(GALLERY_PATH, token, { revalidate: REVALIDATE_SECONDS }))
  } catch (err) {
    console.error('Failed to fetch gallery:', err)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 502 })
  }

  const { isSubscribed } = await verifyNativeAuth(request)

  const body: GalleryApiResponse = { items, isSubscribed }
  return NextResponse.json(body)
}
