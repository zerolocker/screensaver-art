import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'
import { PasswordlessOptions } from '../components/PasswordlessOptions'
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
        <PasswordlessOptions
          pending={oauthPending}
          error={oauthError}
          onStart={onStartOAuth}
          onEmailCode={() => navigate('/otp')}
        />
      }
    />
  )
}
