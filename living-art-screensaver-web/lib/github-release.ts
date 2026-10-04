// GitHub API access for /download, /updates and /api/gallery, always through
// GITHUB_RELEASE_TOKEN (a read-only fine-grained PAT) rather than public URLs,
// so everything keeps working if the repo goes private. A release asset fetched
// with `Accept: application/octet-stream` redirects to a short-lived signed URL
// that anyone can download.

export const REPO = 'zerolocker/screensaver-art'
export const REVALIDATE_SECONDS = 120

export interface GitHubAsset {
  name: string
  url: string // API URL, used to mint a signed URL
}

export interface GitHubRelease {
  assets: GitHubAsset[]
}

export function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'living-art-screensaver-web',
  }
}

/**
 * Fetch the latest release. The default cache is stale-while-revalidate, which
 * can serve an outdated release for many minutes on a quiet route. That's fine
 * for /download; /updates passes `fresh` so installed apps learn of updates promptly.
 */
export async function getLatestRelease(token: string, opts?: { fresh?: boolean }): Promise<GitHubRelease> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: githubHeaders(token),
    ...(opts?.fresh ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
  })
  if (!res.ok) throw new Error(`GitHub releases/latest → ${res.status}`)
  return (await res.json()) as GitHubRelease
}

/** A short-lived signed URL for an asset, to redirect to (so bytes skip Vercel). */
export async function mintSignedAssetUrl(assetApiUrl: string, token: string): Promise<string | null> {
  const res = await fetch(assetApiUrl, {
    headers: { ...githubHeaders(token), Accept: 'application/octet-stream' },
    redirect: 'manual',
    cache: 'no-store',
  })
  return res.headers.get('location')
}

/** An asset's bytes, for the small update manifest that's served inline. */
export async function fetchAssetBody(assetApiUrl: string, token: string): Promise<Response> {
  return fetch(assetApiUrl, {
    headers: { ...githubHeaders(token), Accept: 'application/octet-stream' },
    cache: 'no-store',
  })
}

/**
 * Read a repo file at `ref`. Uses the `raw` media type, which allows 100 MB;
 * the default JSON response stops at 1 MB.
 */
export async function fetchRepoFile(
  path: string,
  token: string,
  opts: { ref?: string; revalidate?: number } = {},
): Promise<string> {
  const ref = opts.ref ?? 'master'
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${ref}`, {
    headers: { ...githubHeaders(token), Accept: 'application/vnd.github.raw' },
    ...(opts.revalidate === undefined
      ? { cache: 'no-store' as const }
      : { next: { revalidate: opts.revalidate } }),
  })
  if (!res.ok) throw new Error(`GitHub contents/${path} → ${res.status}`)
  return res.text()
}
