'use client'

import { useState, type CSSProperties } from 'react'
import posthog from 'posthog-js'
import { CheckCircle2, Download, Loader2, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useIsMobileDevice } from '@/lib/device'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The site's "Download" call to action.
 *
 * On a Mac (or any desktop) it's a normal link to `/download/mac`, labelled
 * `label` with a download icon. On a phone or tablet — where the macOS app can't
 * be installed — it instead opens a dialog that emails a link to open on the
 * Mac, and relabels to `mobileLabel` with a mail icon so the action (and that
 * it's not an on-device download) is honest. Same button styling in both cases.
 */
export function DownloadCTA({
  className,
  style,
  location,
  label = 'Download for Mac',
  mobileLabel = 'Send it to my Mac',
  iconClassName = 'h-4 w-4',
}: {
  className?: string
  style?: CSSProperties
  location: string
  label?: string
  mobileLabel?: string
  iconClassName?: string
}) {
  const isMobile = useIsMobileDevice()

  // Until we know the device (and on desktop) render a real link — best for SEO,
  // accessibility, and the common case. Matches SSR so there's no hydration flip.
  if (!isMobile) {
    return (
      <a
        href="/download/mac"
        onClick={() => posthog.capture('download_clicked', { location })}
        className={className}
        style={style}
      >
        <Download className={iconClassName} strokeWidth={2.2} />
        {label}
      </a>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          style={style}
          onClick={() => posthog.capture('download_email_modal_opened', { location })}
        >
          <Mail className={iconClassName} strokeWidth={2.2} />
          {mobileLabel}
        </button>
      </DialogTrigger>
      <EmailLinkDialogContent location={location} />
    </Dialog>
  )
}

function EmailLinkDialogContent({ location }: { location: string }) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.')
      setStatus('error')
      return
    }
    setStatus('sending')
    setError('')
    posthog.capture('download_email_submitted', { location })
    try {
      const res = await fetch('/api/download-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, location, company }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Couldn't send the email. Please try again.")
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setError('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <DialogContent className="border-white/10">
        <DialogHeader>
          <span
            className="mb-1 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: 'rgba(158,232,162,0.14)' }}
          >
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </span>
          <DialogTitle className="font-serif text-[22px]">Check your inbox</DialogTitle>
          <DialogDescription className="text-[15px] leading-[1.55]">
            We sent a download link to <span className="font-medium text-foreground">{email}</span>.
            Open it on your Mac to install Living Art. (Don&apos;t see it? Check spam.)
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="border-white/10">
      <DialogHeader>
        <span
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: 'rgba(158,232,162,0.14)' }}
        >
          <Mail className="h-[22px] w-[22px] text-primary" />
        </span>
        <DialogTitle className="font-serif text-[22px]">Living Art is a Mac app</DialogTitle>
        <DialogDescription className="text-[15px] leading-[1.55]">
          Enter your email and we&apos;ll send a download link you can open on your Mac.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="mt-1 flex flex-col gap-3">
        {/* Honeypot — hidden from users, catches bots. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="hidden"
        />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          disabled={status === 'sending'}
          className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground-subtle focus:border-primary/60 disabled:opacity-60"
        />
        {status === 'error' && <p className="text-[13.5px] text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={status === 'sending'}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[13px] text-[16px] font-semibold text-primary-foreground disabled:opacity-70"
          style={{ boxShadow: '0 12px 30px -10px rgba(158,232,162,0.5)' }}
        >
          {status === 'sending' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </>
          ) : (
            'Email me the link'
          )}
        </button>
        <p className="text-center text-[12px] text-muted-foreground-subtle">
          Requires macOS. Free to download.
        </p>
      </form>
    </DialogContent>
  )
}
