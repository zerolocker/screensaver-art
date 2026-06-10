'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

export interface OtpFormProps {
  /**
   * Email the user a one-time sign-in code. Return { error } to show an error.
   * Doubles as sign-up — the account is created on first verification.
   */
  onRequestCode: (email: string) => Promise<{ error?: string }>
  /** Verify the code the user entered. Return { error } to show an error. */
  onVerify: (data: { email: string; code: string }) => Promise<{ error?: string }>
  /** Called when the user wants to go back to the other sign-in methods. */
  onBack?: () => void
  /** Brand title shown at the top */
  title?: string
}

export function OtpForm({ onRequestCode, onVerify, onBack, title = 'Living Art' }: OtpFormProps) {
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await onRequestCode(email)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setCode('')
    setStage('code')
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await onVerify({ email, code })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    // On success the auth state change navigates away; keep the spinner up.
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
        <h2 className="text-xl font-semibold text-foreground">
          {stage === 'email' ? 'Sign in with a code' : 'Enter your code'}
        </h2>
        <p className="text-muted-foreground">
          {stage === 'email'
            ? 'No password needed — we’ll email you a one-time sign-in code.'
            : `We emailed a sign-in code to ${email}. Enter it below.`}
        </p>
      </div>

      {stage === 'email' ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-email">Email</Label>
            <Input
              id="otp-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary border-border"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
              <span className="text-red-400 shrink-0">✕</span>
              <span className="text-neutral-300">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending code...
              </>
            ) : (
              'Email me a code'
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-code">Sign-in code</Label>
            <Input
              id="otp-code"
              name="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="bg-secondary border-border tracking-[0.5em] text-center text-lg"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
              <span className="text-red-400 shrink-0">✕</span>
              <span className="text-neutral-300">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & sign in'
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStage('email')
              setError(null)
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            Use a different email
          </button>
        </form>
      )}

      {onBack && (
        <p className="text-center text-sm text-muted-foreground">
          <button type="button" onClick={onBack} className="text-primary hover:underline">
            Back to other sign-in options
          </button>
        </p>
      )}
    </div>
  )
}
