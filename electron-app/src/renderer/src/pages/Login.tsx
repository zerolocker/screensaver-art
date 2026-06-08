import { useNavigate } from 'react-router-dom'
import { Button, LoginForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'
import { OAuthButtons } from '../components/OAuthButtons'
import type { OAuthProvider } from '../lib/oauth'

interface LoginPageProps {
  oauthPending: OAuthProvider | null
  oauthError: string | null
  onStartOAuth: (provider: OAuthProvider) => void
}

export function LoginPage({ oauthPending, oauthError, onStartOAuth }: LoginPageProps) {
  const navigate = useNavigate()

  return (
    <LoginForm
      title="Living Art Screensaver"
      onSubmit={async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) return { error: error.message }
        return {}
      }}
      onForgotPassword={() => {
        window.electronAPI.shell.openExternal(
          'https://living-art-screensaver.com/auth/forgot-password',
        )
      }}
      onSignUpClick={() => navigate('/signup')}
      alternativeActions={
        <div className="space-y-3">
          <OAuthButtons pending={oauthPending} onStart={onStartOAuth} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate('/otp')}
          >
            Email me a sign-in code
          </Button>
          {oauthError && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
              <span className="text-red-400 shrink-0">✕</span>
              <span className="text-neutral-300">{oauthError}</span>
            </div>
          )}
        </div>
      }
    />
  )
}
