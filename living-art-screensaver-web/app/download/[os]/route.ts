import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { getLatestRelease, mintSignedAssetUrl } from '@/lib/github-release'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * GET /download/:os redirects to the latest GitHub release's installer, so a
 * new release goes live within ~2 minutes with no redeploy.
 *
 *   /download/mac  → latest `.dmg`
 *   /download/win  → latest `.exe` (no Windows build exists yet)
 *
 * See lib/github-release.ts. A missing token returns 500, never a public URL.
 */

const PLATFORMS: Record<string, { ext: string; label: string }> = {
  mac: { ext: '.dmg', label: 'macOS' },
  macos: { ext: '.dmg', label: 'macOS' },
  osx: { ext: '.dmg', label: 'macOS' },
  win: { ext: '.exe', label: 'Windows' },
  windows: { ext: '.exe', label: 'Windows' },
}

// Downloads are counted here on the server, where ad blockers can't drop them.
// Reuse the visitor's PostHog id from its cookie, or mint an anonymous one.
function downloadDistinctId(request: NextRequest): string {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const raw = token ? request.cookies.get(`ph_${token}_posthog`)?.value : undefined
  if (raw) {
    try {
      const id = JSON.parse(decodeURIComponent(raw))?.distinct_id
      if (typeof id === 'string' && id) return id
    } catch {
      /* malformed cookie */
    }
  }
  return `anon-download-${randomUUID()}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ os: string }> },
) {
  const { os } = await params
  const platform = PLATFORMS[os?.toLowerCase()]

  if (!platform) {
    return NextResponse.json(
      { error: `Unknown platform "${os}". Use /download/mac or /download/win.` },
      { status: 404 },
    )
  }

  const token = process.env.GITHUB_RELEASE_TOKEN
  if (!token) {
    console.error('[download] GITHUB_RELEASE_TOKEN is not set')
    return NextResponse.json(
      { error: 'Download is temporarily unavailable (server not configured).' },
      { status: 500 },
    )
  }

  let release
  try {
    release = await getLatestRelease(token)
  } catch (err) {
    console.error('[download] failed to fetch latest release:', err)
    return NextResponse.json(
      { error: 'Could not reach the release service. Please try again shortly.' },
      { status: 502 },
    )
  }

  const asset = release.assets.find((a) => a.name.toLowerCase().endsWith(platform.ext))
  if (!asset) {
    return NextResponse.json(
      { error: `No ${platform.label} download is available in the latest release yet.` },
      { status: 404 },
    )
  }

  // No-store: signed URLs are short-lived and "latest" changes.
  try {
    const signed = await mintSignedAssetUrl(asset.url, token)
    if (signed) {
      // `after()` flushes once the redirect has been sent.
      getPostHogClient().capture({
        distinctId: downloadDistinctId(request),
        event: 'download_served',
        properties: { platform: platform.label, asset: asset.name },
      })
      after(flushPostHog)
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    console.error('[download] asset request returned no Location header')
  } catch (err) {
    console.error('[download] failed to mint signed asset URL:', err)
  }

  return NextResponse.json(
    { error: 'Could not resolve the download URL. Please try again shortly.' },
    { status: 502 },
  )
}
