import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /download/:os   →  302 redirect to the latest installer for that platform.
 *
 * This is the single, stable URL the marketing site links to ("Download for
 * Mac"). It resolves "latest" at request time from the GitHub Releases of
 * `zerolocker/screensaver-art`, so a new release goes live the moment
 * `gh release create` finishes — no website redeploy needed (the release lookup
 * is cached for REVALIDATE_SECONDS, so it picks up a new release within ~2 min).
 *
 *   /download/mac  → latest `.dmg`
 *   /download/win  → latest `.exe`   (scaffolded; no Windows build ships yet)
 *
 * ── How the download is served (works for public OR private repo) ────────────
 * We ALWAYS go through the GitHub API with a server-side token, never the public
 * asset URL. The token is GITHUB_RELEASE_TOKEN (a fine-grained PAT with
 * `Contents: Read-only` on this repo), set in the Vercel env (prod) and in
 * `.env.local` (local dev) — it is never exposed to the browser.
 *
 * Asking the API for an asset with `Accept: application/octet-stream` returns a
 * short-lived SIGNED URL on objects.githubusercontent.com that downloads fine
 * for an anonymous user whether the repo is public or private. We 302 the user
 * to that signed URL, so the ~200 MB streams straight from GitHub's CDN — never
 * through Vercel. Going from public → private is therefore a zero-change event.
 *
 * If the token is missing the route returns 500 (server misconfigured) rather
 * than falling back to a public URL — by design, so a private repo can never
 * silently start handing out broken links.
 */

const REPO = 'zerolocker/screensaver-art'
const REVALIDATE_SECONDS = 120

// Map the URL segment (and a few friendly aliases) to the installer extension.
const PLATFORMS: Record<string, { ext: string; label: string }> = {
  mac: { ext: '.dmg', label: 'macOS' },
  macos: { ext: '.dmg', label: 'macOS' },
  osx: { ext: '.dmg', label: 'macOS' },
  win: { ext: '.exe', label: 'Windows' },
  windows: { ext: '.exe', label: 'Windows' },
}

interface GitHubAsset {
  name: string
  url: string // API URL — used with Accept: octet-stream to mint a signed URL
}

interface GitHubRelease {
  assets: GitHubAsset[]
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    // GitHub requires a User-Agent on API requests.
    'User-Agent': 'living-art-screensaver-web',
  }
}

export async function GET(
  _request: NextRequest,
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
  let release: GitHubRelease
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: githubHeaders(token),
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) throw new Error(`GitHub releases/latest → ${res.status}`)
    release = (await res.json()) as GitHubRelease
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
    const assetRes = await fetch(asset.url, {
      headers: { ...githubHeaders(token), Accept: 'application/octet-stream' },
      redirect: 'manual',
      cache: 'no-store',
    })
    const signed = assetRes.headers.get('location')
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    console.error('[download] asset request returned no Location header', assetRes.status)
  } catch (err) {
    console.error('[download] failed to mint signed asset URL:', err)
  }

  return NextResponse.json(
    { error: 'Could not resolve the download URL. Please try again shortly.' },
    { status: 502 },
  )
}
