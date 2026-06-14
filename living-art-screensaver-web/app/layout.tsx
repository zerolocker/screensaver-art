import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter'
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://living-art-screensaver.com'),
  // Per-page titles compose as "<Page> — Living Art Screensaver"; pages that
  // set no title fall back to `default` (used as-is, untemplated) — e.g. the
  // homepage. This keeps the brand keyword in every tab/SERP title.
  title: {
    default: 'Living Art Screensaver — AI-Animated Art Gallery for Mac',
    template: '%s — Living Art Screensaver',
  },
  description: 'A screensaver that turns your idle display into a living art gallery, showcasing AI-animated artworks across every style, with new pieces added regularly.',
  generator: 'v0.app',
  icons: {
    icon: { url: '/icon.svg', type: 'image/svg+xml' },
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
