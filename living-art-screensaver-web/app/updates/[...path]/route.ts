import { NextRequest, NextResponse } from 'next/server'
import { getLatestRelease, fetchAssetBody, mintSignedAssetUrl } from '@/lib/github-release'

/**
 * GET /updates/<asset-name>   →  the auto-update feed for the Electron app.
 *
 * electron-updater (generic provider, configured in electron-builder.cjs) points
 * here. It fetches `/updates/latest-mac.yml`, reads the zip's filename out of
 * that manifest, then fetches `/updates/<that-name>` (+ a `.blockmap`). This
 * route serves each by EXACT name from the latest GitHub release, through the
 * same GITHUB_RELEASE_TOKEN proxy as /download — so updates keep working
 * identically whether the repo is public or private (no token in the app).
 *
 *   - latest-mac.yml      → proxied inline (tiny manifest; always fresh)
 *   - *.zip / *.blockmap  → 302 to a signed CDN URL (bytes never touch Vercel)
 *
 * The catch-all `[...path]` lets the manifest reference assets by their exact
 * built filenames (incl. any %20). Token missing → 500; unknown asset → 404
 * (electron-updater treats a 404 blockmap as "no differential" and falls back to
 * a full download).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const assetName = decodeURIComponent((path ?? []).join('/'))

  if (!assetName) {
    return NextResponse.json({ error: 'Missing update asset name.' }, { status: 404 })
  }

  const token = process.env.GITHUB_RELEASE_TOKEN
  if (!token) {
    console.error('[updates] GITHUB_RELEASE_TOKEN is not set')
    return NextResponse.json(
      { error: 'Updates are temporarily unavailable (server not configured).' },
      { status: 500 },
    )
  }

  // ── Resolve the latest release (cached briefly) ────────────────────────────
  let release
  try {
    release = await getLatestRelease(token)
  } catch (err) {
    console.error('[updates] failed to fetch latest release:', err)
    return NextResponse.json(
      { error: 'Could not reach the update service. Please try again shortly.' },
      { status: 502 },
    )
  }

  const asset = release.assets.find((a) => a.name === assetName)
  if (!asset) {
    // 404 (no JSON body): electron-updater expects a plain 404 for a missing
    // manifest/blockmap and falls back gracefully.
    return new NextResponse(null, { status: 404 })
  }

  // ── The manifest: proxy bytes inline so the updater always parses fresh ─────
  if (assetName.endsWith('.yml')) {
    try {
      const res = await fetchAssetBody(asset.url, token)
      if (!res.ok) throw new Error(`yml fetch → ${res.status}`)
      const body = await res.text()
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[updates] failed to proxy manifest:', err)
      return NextResponse.json(
        { error: 'Could not read the update manifest.' },
        { status: 502 },
      )
    }
  }

  // ── The binaries (.zip / .blockmap): 302 to the signed CDN URL ─────────────
  try {
    const signed = await mintSignedAssetUrl(asset.url, token)
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    console.error('[updates] asset request returned no Location header')
  } catch (err) {
    console.error('[updates] failed to mint signed asset URL:', err)
  }

  return NextResponse.json(
    { error: 'Could not resolve the update asset. Please try again shortly.' },
    { status: 502 },
  )
}
