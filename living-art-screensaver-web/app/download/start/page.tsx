'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Download } from 'lucide-react'
import { detectIsMac } from '@/lib/device'

/**
 * Landing page for the "email me a download link" flow. The link in the email
 * (sent by /api/download-link via Supabase) points here, so opening it is the
 * event we count: `download_email_link_clicked`. On a Mac we also auto-start the
 * DMG; a prominent manual button is always the reliable fallback.
 */
export default function DownloadStartPage() {
  const [isMac, setIsMac] = useState<boolean | undefined>(undefined)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // The metric: how many people opened the link in the email.
    posthog.capture('download_email_link_clicked')

    // Supabase appends auth tokens/errors to the redirect URL; drop them so a
    // token never lingers in history and the URL stays clean.
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const mac = detectIsMac()
    setIsMac(mac)

    if (mac) {
      // Kick off the download via a hidden iframe so an error response (JSON)
      // can't replace this page, and the manual button stays available.
      const t = setTimeout(() => {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = '/download/mac'
        document.body.appendChild(iframe)
      }, 700)
      return () => clearTimeout(t)
    }
  }, [])

  const onMac = isMac !== false // treat unknown as Mac (this link is meant for Macs)

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <span
          className="mb-7 flex h-16 w-16 items-center justify-center rounded-[18px] bg-primary"
          style={{ boxShadow: '0 10px 30px -6px rgba(158,232,162,0.55)' }}
        >
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </span>

        <h1 className="m-0 font-serif text-[30px] font-bold leading-[1.15] tracking-[-0.01em]">
          {onMac ? 'Your download is starting' : 'Living Art is a Mac app'}
        </h1>
        <p className="mt-3 mb-8 text-[16px] leading-[1.55] text-muted-foreground">
          {onMac
            ? "If it doesn't start automatically, use the button below."
            : 'Open this link on your Mac to download and install Living Art.'}
        </p>

        <a
          href="/download/mac"
          onClick={() => posthog.capture('download_clicked', { location: 'email_landing' })}
          className="inline-flex items-center gap-[9px] rounded-full bg-primary px-[28px] py-[15px] text-[16.5px] font-semibold text-primary-foreground no-underline"
          style={{ boxShadow: '0 12px 34px -10px rgba(158,232,162,0.6)' }}
        >
          <Download className="h-4 w-4" strokeWidth={2.2} />
          Download for Mac
        </a>

        <Link
          href="/"
          className="mt-6 text-[14px] text-muted-foreground-subtle no-underline transition-colors hover:text-foreground"
        >
          ← Back to living-art-screensaver.com
        </Link>
      </div>
    </main>
  )
}
