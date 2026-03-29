'use client'

import { useState } from 'react'
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
}

export function SignUpForm({
  onSubmit,
  onLoginClick,
  title = 'Living Art',
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
        <p className="text-muted-foreground">Start your living art journey</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
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
            type="password"
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
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="bg-secondary border-border"
          />
        </div>

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg">
            {error}
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

      {onLoginClick && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onLoginClick}
            className="text-primary hover:underline"
          >
            Sign in
          </button>
        </p>
      )}
    </div>
  )
}
