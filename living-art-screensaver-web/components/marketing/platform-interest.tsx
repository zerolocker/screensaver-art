'use client'

import { useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The platforms a visitor can vote for. `slug` is what we store + aggregate;
 * `label` is user-facing — people self-identify by *device* ("iPhone"), not OS
 * ("iOS"). Extend this list as we consider new targets; the API validates
 * against the same slugs.
 */
const PLATFORM_OPTIONS = [
  { slug: 'windows', label: 'Windows' },
  { slug: 'ipad', label: 'iPad' },
  { slug: 'ios', label: 'iPhone' },
  { slug: 'appletv', label: 'Apple TV' },
  { slug: 'android', label: 'Android' },
  { slug: 'linux', label: 'Linux' },
] as const

const DEFAULT_LABEL = 'Want it on Windows / iPad / iOS / TV?'

type Step = 1 | 2 | 'voted' | 'emailed'

/**
 * A lightweight cross-platform demand probe. Living Art is Mac-only today; this
 * link lets a visitor *self-report* which other platforms they want — a better
 * signal than inferring their device, and it captures multi-platform intent
 * (e.g. a Mac user who also wants it on their iPad + TV).
 *
 * Two steps on purpose: step 1 collects the platform vote, step 2 asks for an
 * (optional) email. Splitting them means a reluctant user still leaves the
 * cheap, valuable signal — the vote — even if they decline the email.
 *
 * Analytics (frontend, per product decision): `platform_interest_opened` on
 * open and `platform_interest_selected` (with the chosen platforms) on the step-1
 * vote. The email submit is tracked server-side in /api/platform-interest
 * (`platform_interest_submitted`) — not duplicated here.
 */
export function PlatformInterest({
  location,
  label = DEFAULT_LABEL,
  className,
}: {
  location: string
  label?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')

  function reset() {
    setStep(1)
    setSelected([])
    setEmail('')
    setCompany('')
    setStatus('idle')
    setError('')
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) posthog.capture('platform_interest_opened', { location })
    else setTimeout(reset, 200) // reset after the close animation
  }

  function toggle(slug: string) {
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]))
  }

  function onContinue() {
    if (selected.length === 0) return
    // The platform vote — the primary demand signal — is captured here on the
    // frontend so a user who declines the email is still counted.
    posthog.capture('platform_interest_selected', { platforms: selected, location })
    setStep(2)
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.')
      setStatus('error')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/platform-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, platforms: selected, location, company }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Couldn't save that. Please try again.")
        setStatus('error')
        return
      }
      setStep('emailed')
    } catch {
      setError('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/10">
        {/* ── Success (vote-only or vote+email) ─────────────────────────── */}
        {(step === 'voted' || step === 'emailed') && (
          <DialogHeader>
            <span
              className="mb-1 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'rgba(158,232,162,0.14)' }}
            >
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </span>
            <DialogTitle className="font-serif text-[22px]">
              {step === 'emailed' ? "You're on the list" : 'Your vote is in'}
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-[1.55]">
              {step === 'emailed'
                ? "Thanks — we'll email you the moment it's ready. Demand like yours is exactly how we decide what to build next."
                : 'Thanks — your platform vote was counted. It helps us decide what to build next.'}
            </DialogDescription>
          </DialogHeader>
        )}

        {/* ── Step 1: pick platforms (the vote) ─────────────────────────── */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-[22px]">Where do you want Living Art?</DialogTitle>
              <DialogDescription className="text-[15px] leading-[1.55]">
                It&apos;s Mac-only today. Tell us where you&apos;d use it — your vote helps us decide
                what to build next.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-1 flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map(({ slug, label }) => {
                const on = selected.includes(slug)
                return (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(slug)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-[14.5px] transition-colors',
                      on
                        ? 'border-primary bg-primary/15 text-foreground'
                        : 'border-white/12 text-muted-foreground hover:border-white/25',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={onContinue}
              disabled={selected.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[13px] text-[16px] font-semibold text-primary-foreground disabled:opacity-50"
              style={{ boxShadow: '0 12px 30px -10px rgba(158,232,162,0.5)' }}
            >
              Continue
            </button>
          </>
        )}

        {/* ── Step 2: optional email ────────────────────────────────────── */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-[22px]">Want us to email you?</DialogTitle>
              <DialogDescription className="text-[15px] leading-[1.55]">
                Optional — leave your email and we&apos;ll tell you when it ships. Your vote is
                already counted either way.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmitEmail} className="mt-1 flex flex-col gap-3">
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
                    Adding you…
                  </>
                ) : (
                  'Notify me'
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep('voted')}
                disabled={status === 'sending'}
                className="text-center text-[13px] text-muted-foreground-subtle underline-offset-4 hover:text-muted-foreground hover:underline disabled:opacity-60"
              >
                Just count my vote
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
