import { ImageResponse } from 'next/og'
import { brand, greenGlow } from '@/lib/brand'
import { logoSwirlPath } from '@/lib/logo-path'

/**
 * The social share card (og:image / twitter:image) for the whole site. Next
 * auto-detects this file convention and attaches the generated 1200×630 PNG to
 * the metadata for every page that doesn't override it, so links shared to
 * X / Slack / iMessage / Pinterest unfurl with a branded preview instead of a
 * bare URL — which matters because sharing the art is the growth engine.
 *
 * Mirrors the marketing hero: near-black canvas + mint glow, the living-swirl
 * logo badge, the Playfair serif headline with the italic green "living gallery."
 * accent, and — on the right — a realistic Studio-Display-style monitor showing a
 * real gallery still (Starry Coast), the way the hero's <Monitor> communicates
 * the product at a glance. (satori can't blur / backdrop-filter / play video, so
 * the ambient glow is a soft gradient and the art is a single frame.)
 *
 * The art still is colocated (loaded via import.meta.url so the bundler traces it
 * on Vercel); fonts are fetched from Google at request time. Both are best-effort
 * and degrade gracefully. Brand literals live in lib/brand.ts (satori can't read
 * the CSS design tokens).
 */
export const runtime = 'edge'
export const alt = 'Living Art Screensaver — centuries of art, animated by AI, on your idle Mac'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Weight = 400 | 600 | 700
type FontEntry = { name: string; data: ArrayBuffer; weight: Weight; style: 'normal' | 'italic' }

async function loadGoogleFont(family: string, weight: Weight, italic: boolean): Promise<ArrayBuffer> {
  const spec = italic ? `ital,wght@1,${weight}` : `wght@${weight}`
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${spec}`
  // No custom UA → Google returns a plain TrueType src (satori can't read woff2).
  const css = await (await fetch(url)).text()
  const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/)
  if (!src) throw new Error(`Could not parse font src for ${family}`)
  return fetch(src[1]).then((r) => r.arrayBuffer())
}

// Best-effort per font — one failed fetch degrades that face only, never the image.
async function tryFont(name: string, weight: Weight, italic = false): Promise<FontEntry | null> {
  try {
    return { name, data: await loadGoogleFont(name, weight, italic), weight, style: italic ? 'italic' : 'normal' }
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  // Playfair Display = the site's serif headline; Inter = its sans body. Loaded
  // in parallel; whatever succeeds is used, otherwise we fall back gracefully.
  const fonts = (
    await Promise.all([
      tryFont(brand.fontSerif, 700, false),
      tryFont(brand.fontSerif, 700, true),
      tryFont(brand.fontSans, 400, false),
      tryFont(brand.fontSans, 600, false),
    ])
  ).filter((f): f is FontEntry => f !== null)

  // Only claim the serif once BOTH faces exist — else the italic accent would
  // render as a non-italic fallback next to serif text.
  const hasSerif =
    fonts.some((f) => f.name === brand.fontSerif && f.style === 'normal') &&
    fonts.some((f) => f.name === brand.fontSerif && f.style === 'italic')
  const hasSans = fonts.some((f) => f.name === brand.fontSans)
  const serif = hasSerif ? brand.fontSerif : undefined
  const sans = hasSans ? brand.fontSans : 'sans-serif'

  // Real art still for the on-screen frame — colocated so it's Vercel-traced.
  let artSrc: string | null = null
  try {
    const buf = await fetch(new URL('./starry-coast-og.jpg', import.meta.url)).then((r) => r.arrayBuffer())
    artSrc = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    artSrc = null
  }

  const logo = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${logoSwirlPath}" fill="${brand.ink}"/></svg>`,
  )}`

  // Monitor sizing — the card's focal element. Bump MONITOR_W to resize it; the
  // 16:9 screen, stand, glow, vertical centering and the headline column all
  // derive from it so the composition stays balanced.
  const MONITOR_W = 500
  const MONITOR_RIGHT = 70
  const SCREEN_W = MONITOR_W - 24 // outer(7) + inner(5) padding, both sides
  const SCREEN_H = Math.round((SCREEN_W * 9) / 16)
  const MONITOR_TOP = 150
  const NECK_W = Math.round(MONITOR_W * 0.1)
  const FOOT_W = Math.round(MONITOR_W * 0.42)
  const SHADOW_W = Math.round(MONITOR_W * 0.52)
  // Headline column fills the space left of the monitor with a ~40px gutter.
  const COPY_MAX_W = 1200 - MONITOR_RIGHT - MONITOR_W - 149

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 76px',
          color: '#ffffff',
          fontFamily: sans,
          background: `radial-gradient(820px 520px at 82% 6%, ${greenGlow(0.18)}, transparent 60%), radial-gradient(680px 520px at 0% 100%, ${greenGlow(0.06)}, transparent 60%), linear-gradient(150deg, #0b0b0c 0%, #131316 55%, #0e1210 100%)`,
        }}
      >
        {/* Realistic monitor showing a real gallery still — floated on the right */}
        <div
          style={{
            position: 'absolute',
            top: MONITOR_TOP,
            right: MONITOR_RIGHT,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              width: MONITOR_W,
              padding: 7,
              borderRadius: 20,
            background: 'linear-gradient(180deg, #40444d, #2e313a 42%, #22252f)',
            boxShadow:
              'inset 0 1.5px 0 rgba(255,255,255,0.32), inset 1.5px 0 0 rgba(255,255,255,0.12), inset -1.5px 0 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.06), 0 42px 70px -30px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ display: 'flex', width: '100%', padding: 5, borderRadius: 14, background: '#080809' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  width: SCREEN_W,
                  height: SCREEN_H,
                  borderRadius: 7,
                  overflow: 'hidden',
                  background: '#000',
                }}
              >
                {artSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artSrc} width={SCREEN_W} height={SCREEN_H} alt="" style={{ objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #1a2740, #2f4a6b)' }} />
                )}
                {/* screen glare */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: SCREEN_W,
                    height: SCREEN_H,
                    background:
                      'linear-gradient(122deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 16%, rgba(255,255,255,0) 40%)',
                  }}
                />
                {/* frosted title pill (text only, per request) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    padding: '7px 16px',
                    borderRadius: 999,
                    background: 'rgba(16,16,18,0.62)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 1, color: '#ffffff' }}>Starry Coast</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stand: neck + T-bar foot + soft floor shadow (mirrors the site Monitor) */}
          <div
            style={{
              width: NECK_W,
              height: 34,
              borderRadius: '0 0 4px 4px',
              background: 'linear-gradient(180deg, #3c4049, #282b34 55%, #1e212a)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.18), inset 1px 0 0 rgba(255,255,255,0.10), inset -1px 0 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(255,255,255,0.10)',
            }}
          />
          <div
            style={{
              width: FOOT_W,
              height: 15,
              borderRadius: 7,
              background: 'linear-gradient(180deg, #3c4049, #1e212a)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.22), inset 1px 0 0 rgba(255,255,255,0.10), inset -1px 0 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(255,255,255,0.10), 0 22px 30px -14px rgba(0,0,0,0.85)',
            }}
          />
          <div
            style={{
              width: SHADOW_W,
              height: 20,
              marginTop: 3,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0) 74%)',
            }}
          />
        </div>

        {/* Header: logo badge + wordmark, domain on the right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 16,
                background: brand.green,
                boxShadow: `0 12px 34px ${greenGlow(0.4)}`,
              }}
            >
              {/* Full badge size = the same mark-to-tile ratio as the app icon
                  (the mark's viewBox already carries its own margin). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={64} height={64} alt="" />
            </div>
            <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: 3, color: 'rgba(255,255,255,0.92)' }}>
              LIVING ART SCREENSAVER
            </div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}>living-art-screensaver.com</div>
        </div>

        {/* Headline block: green accent bar + serif headline + subhead */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 28 }}>
          <div style={{ width: 5, borderRadius: 99, background: brand.green, boxShadow: `0 0 26px ${greenGlow(0.55)}` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: COPY_MAX_W }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0 15px',
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 56,
                lineHeight: 1.05,
              }}
            >
              <span>Turn your screensaver into a</span>
              <span style={{ fontFamily: serif, fontStyle: 'italic', color: brand.green }}>living gallery.</span>
            </div>
            <div style={{ fontSize: 25, lineHeight: 1.4, color: 'rgba(255,255,255,0.72)' }}>
              Centuries of art, animated by AI and hung on your idle Mac.
            </div>
          </div>
        </div>

        {/* Footer chips with green dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Free forever', 'macOS', 'New art added every night'].map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(255,255,255,0.13)',
                fontSize: 22,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 99, background: brand.green }} />
              <span>{chip}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
