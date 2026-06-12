import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the GitHub-release proxy so the route's branching is tested in isolation
// (no network, no token). The real helper is exercised against live GitHub by
// the /download route in production; here we prove the /updates logic.
vi.mock('@/lib/github-release', () => ({
  getLatestRelease: vi.fn(),
  fetchAssetBody: vi.fn(),
  mintSignedAssetUrl: vi.fn(),
}))

import { GET } from '../[...path]/route'
import { getLatestRelease, fetchAssetBody, mintSignedAssetUrl } from '@/lib/github-release'

const ZIP = 'Living-Art-Screensaver-1.2.0-universal.zip'

const RELEASE = {
  assets: [
    { name: 'latest-mac.yml', url: 'https://api.github.com/.../yml' },
    { name: ZIP, url: 'https://api.github.com/.../zip' },
    { name: `${ZIP}.blockmap`, url: 'https://api.github.com/.../blockmap' },
  ],
}

// The route reads params as a Promise (Next 15 dynamic API).
const call = (segments: string[]) =>
  GET({} as never, { params: Promise.resolve({ path: segments }) })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GITHUB_RELEASE_TOKEN = 'test-token'
  vi.mocked(getLatestRelease).mockResolvedValue(RELEASE as never)
})

afterEach(() => {
  delete process.env.GITHUB_RELEASE_TOKEN
})

describe('GET /updates/[...path]', () => {
  it('proxies the manifest inline as text/yaml', async () => {
    vi.mocked(fetchAssetBody).mockResolvedValue(new Response('version: 1.2.0\n', { status: 200 }))

    const res = await call(['latest-mac.yml'])

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/yaml')
    expect(res.headers.get('cache-control')).toBe('no-store')
    await expect(res.text()).resolves.toContain('version: 1.2.0')
    expect(mintSignedAssetUrl).not.toHaveBeenCalled() // inline, not redirected
  })

  it('302-redirects the zip to a signed CDN URL', async () => {
    vi.mocked(mintSignedAssetUrl).mockResolvedValue('https://objects.githubusercontent.com/signed-zip')

    const res = await call([ZIP])

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://objects.githubusercontent.com/signed-zip')
    expect(fetchAssetBody).not.toHaveBeenCalled() // streamed via CDN, not proxied
  })

  it('302-redirects the blockmap too', async () => {
    vi.mocked(mintSignedAssetUrl).mockResolvedValue('https://objects.githubusercontent.com/signed-bm')

    const res = await call([`${ZIP}.blockmap`])

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://objects.githubusercontent.com/signed-bm')
  })

  it('404s when the asset is not in the latest release', async () => {
    const res = await call(['does-not-exist.zip'])
    expect(res.status).toBe(404)
  })

  it('500s when the token is not configured', async () => {
    delete process.env.GITHUB_RELEASE_TOKEN
    const res = await call(['latest-mac.yml'])
    expect(res.status).toBe(500)
    expect(getLatestRelease).not.toHaveBeenCalled()
  })

  it('502s when GitHub is unreachable', async () => {
    vi.mocked(getLatestRelease).mockRejectedValue(new Error('network down'))
    const res = await call(['latest-mac.yml'])
    expect(res.status).toBe(502)
  })
})
