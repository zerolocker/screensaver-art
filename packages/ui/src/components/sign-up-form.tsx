'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

export interface SignUpFormProps {
  /** Called with credentials when the user submits. Return { error } to show an error. */
  onSubmit: (data: { email: string; password: string }) => Promise<{ error?: string }>
  /** Called when the user clicks "Sign in" */
  onLoginClick?: () => void
  /** Brand title shown at the top */
  title?: string
  /**
   * Passwordless sign-up options (OAuth buttons, email code) rendered above the
   * password form, separated by an "or" divider. These create the account on
   * first use, so they're the quickest way to sign up. Rendered outside the
   * <form>.
   */
  alternativeActions?: ReactNode
}

export function SignUpForm({
  onSubmit,
  onLoginClick,
  title = 'Living Art',
  alternativeActions,
}: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const result = await onSubmit({ email, password })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
        <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
        {onLoginClick ? (
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onLoginClick}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        ) : (
          <p className="text-muted-foreground">Start your living art journey</p>
        )}
      </div>

      {/* Passwordless sign-up first — no password to choose, account created on
          first use. The email/password form below is the fallback. */}
      {alternativeActions && (
        <div className="space-y-4">
          {alternativeActions}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or sign up with a password
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-secondary border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-secondary border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password">Confirm Password</Label>
          <Input
            id="signup-confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </div>
  )
}
