import { ImageResponse } from 'next/og'

/**
 * The social share card (og:image / twitter:image) for the whole site. Next
 * auto-detects this file convention and attaches the generated 1200×630 PNG to
 * the metadata for every page that doesn't override it, so links shared to
 * X / Slack / iMessage / Pinterest unfurl with a branded preview instead of a
 * bare URL — which matters because sharing the art is the growth engine.
 *
 * Generated (not a static asset) so the copy stays in one place and in sync
 * with the site's positioning. Uses the built-in font — plain Latin text only.
 */
export const runtime = 'edge'
export const alt = 'Living Art Screensaver — a new, curated piece of AI art on your Mac every day'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background:
            'radial-gradient(1000px 600px at 78% 8%, rgba(158,232,162,0.20), transparent 60%), linear-gradient(160deg, #0b0b0c 0%, #141416 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(158,232,162,0.16)',
              border: '1px solid rgba(158,232,162,0.5)',
            }}
          />
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1 }}>
            LIVING ART SCREENSAVER
          </div>
        </div>

        {/* Headline + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.08, maxWidth: 960 }}>
            A new piece of curated AI art on your Mac, every day.
          </div>
          <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.72)', maxWidth: 900 }}>
            Your screensaver &amp; wallpaper, turned into a living gallery.
          </div>
        </div>

        {/* Footer chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {['Free to download', 'macOS', 'New art daily'].map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                fontSize: 22,
                padding: '10px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
