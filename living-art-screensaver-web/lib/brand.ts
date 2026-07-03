/**
 * Brand tokens for contexts that CANNOT read the CSS design tokens in
 * app/globals.css — i.e. anything rendered outside the Tailwind / CSS-variable
 * pipeline: the OG image (next/og · satori resolves neither CSS variables nor
 * oklch()), inline JSX `style` glows/tints, and (later) the Electron app or
 * HTML emails.
 *
 * app/globals.css stays the source of truth for the CSS-variable UI; the values
 * here MIRROR its brand green (`--primary`) as literal sRGB. Keep them in sync.
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
