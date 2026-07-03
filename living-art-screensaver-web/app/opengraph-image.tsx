import { ImageResponse } from 'next/og'

/**
 * The social share card (og:image / twitter:image) for the whole site. Next
 * auto-detects this file convention and attaches the generated 1200×630 PNG to
 * the metadata for every page that doesn't override it, so links shared to
 * X / Slack / iMessage / Pinterest unfurl with a branded preview instead of a
 * bare URL — which matters because sharing the art is the growth engine.
 *
 * Design mirrors the marketing hero: near-black canvas + the mint-green glow,
 * the layered-cube logo badge, and the Playfair Display serif headline with the
 * italic green "living gallery." accent (Playfair is fetched from Google Fonts
 * at request time; if that fails we degrade to the built-in font). Kept in one
 * place so the copy stays in sync with the site's positioning.
 */
export const runtime = 'edge'
export const alt = 'Living Art Screensaver — centuries of art, animated by AI, on your idle Mac'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand tokens (mirrors app/globals.css: --primary ≈ mint green, --primary-foreground ≈ dark green ink).
const GREEN = '#9ee8a2'
const INK = '#0d2114'

// Little "framed canvases" — gradients that evoke different eras/styles so the
// card reads as an art gallery, not a color palette.
const CANVASES = [
  'linear-gradient(150deg, #4a3420 0%, #b07a3e 100%)', // warm / classical
  'linear-gradient(150deg, #1f3d2c 0%, #8fd6a0 100%)', // green / landscape
  'linear-gradient(150deg, #20284d 0%, #6a86c4 100%)', // blue / nocturne
]

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
      tryFont('Playfair Display', 700, false),
      tryFont('Playfair Display', 700, true),
      tryFont('Inter', 400, false),
      tryFont('Inter', 600, false),
    ])
  ).filter((f): f is FontEntry => f !== null)

  // Only claim the serif once BOTH faces exist — else the italic accent would
  // render as a non-italic fallback next to serif text.
  const hasSerif =
    fonts.some((f) => f.name === 'Playfair Display' && f.style === 'normal') &&
    fonts.some((f) => f.name === 'Playfair Display' && f.style === 'italic')
  const hasSans = fonts.some((f) => f.name === 'Inter')
  const serif = hasSerif ? 'Playfair Display' : undefined
  const sans = hasSans ? 'Inter' : 'sans-serif'

  const logo = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  )}`

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
          padding: '66px 80px',
          color: '#ffffff',
          fontFamily: sans,
          background:
            'radial-gradient(900px 520px at 86% 2%, rgba(158,232,162,0.24), transparent 62%), radial-gradient(700px 520px at 0% 100%, rgba(158,232,162,0.07), transparent 60%), linear-gradient(150deg, #0b0b0c 0%, #131316 55%, #0e1210 100%)',
        }}
      >
        {/* Framed gallery — floated top-right inside the glow, like hung paintings */}
        <div style={{ position: 'absolute', top: 150, right: 76, display: 'flex', gap: 16 }}>
          {CANVASES.map((art, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: 116,
                height: 158,
                padding: 7,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 26px 50px rgba(0,0,0,0.5)',
                transform: `rotate(${(i - 1) * 4}deg) translateY(${i === 1 ? -10 : 6}px)`,
              }}
            >
              <div style={{ display: 'flex', flex: 1, borderRadius: 5, background: art }} />
            </div>
          ))}
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
                background: GREEN,
                boxShadow: '0 12px 34px rgba(158,232,162,0.4)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={36} height={36} alt="" />
            </div>
            <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: 3, color: 'rgba(255,255,255,0.92)' }}>
              LIVING ART SCREENSAVER
            </div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 1, color: 'rgba(255,255,255,0.5)' }}>
            living-art-screensaver.com
          </div>
        </div>

        {/* Headline block: green accent bar + eyebrow + serif headline + subhead */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 30 }}>
          <div
            style={{
              width: 5,
              borderRadius: 99,
              background: GREEN,
              boxShadow: '0 0 26px rgba(158,232,162,0.55)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 4, color: GREEN }}>
              AI-ANIMATED · NEW EVERY NIGHT
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0 16px',
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 62,
                lineHeight: 1.04,
              }}
            >
              <span>Turn your screensaver into a</span>
              <span style={{ fontFamily: serif, fontStyle: 'italic', color: GREEN }}>living gallery.</span>
            </div>
            <div style={{ fontSize: 27, lineHeight: 1.42, color: 'rgba(255,255,255,0.72)' }}>
              Centuries of art, animated by AI and hung on your idle Mac.
            </div>
          </div>
        </div>

        {/* Footer chips with green dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Free to download', 'macOS', 'A new piece every night'].map((chip) => (
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
              <div style={{ width: 8, height: 8, borderRadius: 99, background: GREEN }} />
              <span>{chip}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
