/**
 * Brand colours as literals, for places that can't read the CSS tokens in
 * app/globals.css: the OG image (satori supports neither CSS variables nor
 * oklch) and inline styles. Keep them in sync with globals.css.
 */
export const brand = {
  /** Mint green — mirrors `--primary` in app/globals.css. */
  green: '#9ee8a2',
  greenRgb: '158, 232, 162',
  /** Dark green ink for marks/text on the green (≈ `--primary-foreground`). */
  ink: '#0d2114',
  /** Near-black page canvas (≈ `--background`). */
  bg: '#0b0b0c',
  /** Headline serif + body sans — mirror the next/font families in app/layout.tsx. */
  fontSerif: 'Playfair Display',
  fontSans: 'Inter',
} as const

/** Mint green at a given alpha — for glows, shadows and tints in JS style objects. */
export const greenGlow = (alpha: number) => `rgba(${brand.greenRgb}, ${alpha})`
