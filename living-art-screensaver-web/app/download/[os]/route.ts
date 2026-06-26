import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { getLatestRelease, mintSignedAssetUrl } from '@/lib/github-release'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * GET /download/:os   →  302 redirect to the latest installer for that platform.
 *
 * This is the single, stable URL the marketing site links to ("Download for
 * Mac"). It resolves "latest" at request time from the GitHub Releases of
 * `zerolocker/screensaver-art`, so a new release goes live the moment
 * `gh release create` finishes — no website redeploy needed (the release lookup
 * is cached briefly, so it picks up a new release within ~2 min).
 *
 *   /download/mac  → latest `.dmg`
 *   /download/win  → latest `.exe`   (scaffolded; no Windows build ships yet)
 *
 * ── How the download is served (works for public OR private repo) ────────────
 * The actual GitHub-proxy mechanics live in lib/github-release.ts (shared with
 * the auto-update feed at /updates): we ALWAYS go through the GitHub API with a
 * server-side token (GITHUB_RELEASE_TOKEN), never a public asset URL, and 302 to
 * a short-lived signed objects.githubusercontent.com URL — so the bytes stream
 * straight from GitHub's CDN whether the repo is public or private. Going from
 * public → private is therefore a zero-change event.
 *
 * If the token is missing the route returns 500 (server misconfigured) rather
 * than falling back to a public URL — by design, so a private repo can never
 * silently start handing out broken links.
 */

// Map the URL segment (and a few friendly aliases) to the installer extension.
const PLATFORMS: Record<string, { ext: string; label: string }> = {
  mac: { ext: '.dmg', label: 'macOS' },
  macos: { ext: '.dmg', label: 'macOS' },
  osx: { ext: '.dmg', label: 'macOS' },
  win: { ext: '.exe', label: 'Windows' },
  windows: { ext: '.exe', label: 'Windows' },
}

// The install funnel's truth source. The marketing buttons fire a client-side
// `download_clicked`, but those are ad-blockable and miss direct hits to this
// URL — so we capture the actual download server-side too. We reuse the
// visitor's PostHog distinct_id from the `ph_<token>_posthog` cookie (set by
// posthog-js on the marketing page) so the download stitches onto the same
// person; absent a cookie (direct link, blocker) we mint an anonymous id.
function downloadDistinctId(request: NextRequest): string {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const raw = token ? request.cookies.get(`ph_${token}_posthog`)?.value : undefined
  if (raw) {
    try {
      const id = JSON.parse(decodeURIComponent(raw))?.distinct_id
      if (typeof id === 'string' && id) return id
    } catch {
      /* malformed cookie — fall through to an anonymous id */
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

  // ── Resolve the latest release (cached briefly) ────────────────────────────
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

  // ── Pick the asset for this platform ───────────────────────────────────────
  const asset = release.assets.find((a) => a.name.toLowerCase().endsWith(platform.ext))
  if (!asset) {
    return NextResponse.json(
      { error: `No ${platform.label} download is available in the latest release yet.` },
      { status: 404 },
    )
  }

  // ── Mint a fresh signed URL and redirect to it ─────────────────────────────
  // No-store: signed URLs are short-lived and "latest" can change between
  // releases, so every click must re-resolve.
  try {
    const signed = await mintSignedAssetUrl(asset.url, token)
    if (signed) {
      // Capture the real download (server-side ⇒ ad-blocker-safe). `after()`
      // runs post-response so it never delays the user's redirect.
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
