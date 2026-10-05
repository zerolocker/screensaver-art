import { NextRequest, NextResponse } from 'next/server'
import { getLatestRelease, fetchAssetBody, mintSignedAssetUrl } from '@/lib/github-release'

/**
 * GET /updates/<asset-name>: electron-updater's feed. Serves each file by exact
 * name from the latest GitHub release:
 *   - latest-mac.yml      → proxied inline, always fresh
 *   - *.zip / *.blockmap  → 302 to a signed CDN URL
 * An unknown asset is a plain 404, which electron-updater handles (a missing
 * blockmap means a full download).
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

  // Always fresh: a stale answer delays every installed app's update.
  let release
  try {
    release = await getLatestRelease(token, { fresh: true })
  } catch (err) {
    console.error('[updates] failed to fetch latest release:', err)
    return NextResponse.json(
      { error: 'Could not reach the update service. Please try again shortly.' },
      { status: 502 },
    )
  }

  const asset = release.assets.find((a) => a.name === assetName)
  if (!asset) {
    return new NextResponse(null, { status: 404 })
  }

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
