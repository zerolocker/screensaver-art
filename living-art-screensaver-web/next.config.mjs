/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@screensaver-art/ui', '@screensaver-art/constants'],
  // Reverse-proxy PostHog through our own origin so the client SDK (posthog-js,
  // configured with api_host: '/ingest' in instrumentation-client.ts) isn't
  // blocked by ad/tracker blockers that recognise *.posthog.com. The static-asset
  // and event ingestion hosts are split out per PostHog's recommended config.
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
  // PostHog's ingestion endpoints use trailing slashes; don't 308-redirect them.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
