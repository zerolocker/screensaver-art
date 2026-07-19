// Shared GitHub-release proxy used by both /download/[os] and /updates/[...path].
//
// Both routes resolve "latest" from this repo's GitHub Releases at request time
// and serve assets through a server-side token (GITHUB_RELEASE_TOKEN, a
// fine-grained PAT with Contents: Read-only) — never a public asset URL. Asking
// the API for an asset with `Accept: application/octet-stream` yields a
// short-lived SIGNED objects.githubusercontent.com URL that downloads fine for
// anonymous users on a public OR private repo. So going public → private is a
// zero-change event for both the manual download and the auto-updater.

export const REPO = 'zerolocker/screensaver-art'
export const REVALIDATE_SECONDS = 120

export interface GitHubAsset {
  name: string
  url: string // API URL — used with Accept: octet-stream to mint a signed URL
}

export interface GitHubRelease {
  assets: GitHubAsset[]
}

export function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    // GitHub requires a User-Agent on API requests.
    'User-Agent': 'living-art-screensaver-web',
  }
}

/**
 * Fetch the latest release. Throws on a non-OK response.
 *
 * `fresh` skips the data cache. The default (cached) mode is
 * stale-while-revalidate: after the window expires the next request still gets
 * the OLD release and only *triggers* a background refresh — on a low-traffic
 * route that can serve a just-superseded release for many minutes (observed:
 * the auto-update feed still said 1.4.5 seventeen minutes after 1.4.6
 * published). Fine for /download (a human retrying is cheap); wrong for
 * /updates, where a stale answer silently delays every installed app's
 * "Relaunch to update" banner — so the updater feed passes `fresh: true`.
 */
export async function getLatestRelease(token: string, opts?: { fresh?: boolean }): Promise<GitHubRelease> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: githubHeaders(token),
    ...(opts?.fresh ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
  })
  if (!res.ok) throw new Error(`GitHub releases/latest → ${res.status}`)
  return (await res.json()) as GitHubRelease
}

/**
 * Mint a fresh short-lived signed URL for an asset (for a 302 redirect, so the
 * bytes stream from GitHub's CDN, never through Vercel). Returns the signed URL,
 * or null if GitHub didn't hand one back.
 */
export async function mintSignedAssetUrl(assetApiUrl: string, token: string): Promise<string | null> {
  const res = await fetch(assetApiUrl, {
    headers: { ...githubHeaders(token), Accept: 'application/octet-stream' },
    redirect: 'manual',
    cache: 'no-store',
  })
  return res.headers.get('location')
}

/**
 * Fetch an asset's raw bytes server-side (follows the signed-URL redirect). Used
 * for the tiny update manifest, which we proxy inline rather than redirect.
 */
export async function fetchAssetBody(assetApiUrl: string, token: string): Promise<Response> {
  return fetch(assetApiUrl, {
    headers: { ...githubHeaders(token), Accept: 'application/octet-stream' },
    cache: 'no-store',
  })
}
