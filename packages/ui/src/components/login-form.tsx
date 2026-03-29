'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

export interface LoginFormProps {
  /** Called with credentials when the user submits. Return { error } to show an error. */
  onSubmit: (data: { email: string; password: string }) => Promise<{ error?: string }>
  /** Called when the user clicks "Forgot password?" */
  onForgotPassword?: () => void
  /** Called when the user clicks "Sign up" */
  onSignUpClick?: () => void
  /** Brand title shown at the top */
  title?: string
}

export function LoginForm({
  onSubmit,
  onForgotPassword,
  onSignUpClick,
  title = 'Living Art',
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
        <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-secondary border-border"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password">Password</Label>
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input
            id="login-password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      {onSignUpClick && (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-primary hover:underline"
          >
            Sign up
          </button>
        </p>
      )}
    </div>
  )
}
