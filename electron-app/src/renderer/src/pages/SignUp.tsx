import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignUpForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'
import { PasswordlessOptions } from '../components/PasswordlessOptions'
import type { OAuthProvider } from '../lib/oauth'

interface SignUpPageProps {
  oauthPending: OAuthProvider | null
  oauthError: string | null
  onStartOAuth: (provider: OAuthProvider) => void
}

export function SignUpPage({ oauthPending, oauthError, onStartOAuth }: SignUpPageProps) {
  const navigate = useNavigate()
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Living Art Screensaver</h1>
        <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
        <p className="text-muted-foreground">
          We&apos;ve sent you a confirmation link. Click it to activate your account,
          then come back here to sign in.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="text-primary hover:underline text-sm"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <SignUpForm
      title="Living Art Screensaver"
      onSubmit={async ({ email, password }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://living-art-screensaver.com/auth/login',
          },
        })
        if (error) return { error: error.message }
        // Supabase hides "email already registered" to prevent enumeration: it
        // returns a fake user (no error, no email sent) with an empty identities
        // array. Detect that so we don't wrongly claim a confirmation was sent.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          return {
            error:
              'An account with this email already exists. Try signing in, or reset your password if you forgot it.',
          }
        }
        setSuccess(true)
        return {}
      }}
      onLoginClick={() => navigate('/login')}
      alternativeActions={
        // No email-code option here: OTP can't create accounts (shouldCreateUser
        // is off), so it's sign-in only. OAuth still doubles as passwordless
        // sign-up.
        <PasswordlessOptions
          pending={oauthPending}
          error={oauthError}
          onStart={onStartOAuth}
        />
      }
    />
  )
}
