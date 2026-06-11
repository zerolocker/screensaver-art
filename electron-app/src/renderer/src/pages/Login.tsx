import { useNavigate } from 'react-router-dom'
import { PasswordlessOptions } from '../components/PasswordlessOptions'
import type { OAuthProvider } from '../lib/oauth'

interface LoginPageProps {
  oauthPending: OAuthProvider | null
  oauthError: string | null
  onStartOAuth: (provider: OAuthProvider) => void
}

// Single passwordless auth screen — no email/password. Social sign-in and the
// email one-time code both create the account on first use, so there's no
// separate sign-up step.
export function LoginPage({ oauthPending, oauthError, onStartOAuth }: LoginPageProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">Living Art Screensaver</h1>
        <p className="text-muted-foreground">
          Sign in or create an account to continue.
        </p>
      </div>

      <PasswordlessOptions
        pending={oauthPending}
        error={oauthError}
        onStart={onStartOAuth}
        onEmailCode={() => navigate('/otp')}
      />

      <p className="text-center text-xs text-muted-foreground">
        No password needed. We’ll email you a one-time code, or use a provider above.
      </p>
    </div>
  )
}
