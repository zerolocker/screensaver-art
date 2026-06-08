import { useNavigate } from 'react-router-dom'
import { Button, LoginForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'

export function LoginPage() {
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
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => navigate('/otp')}
        >
          Email me a sign-in code
        </Button>
      }
    />
  )
}
