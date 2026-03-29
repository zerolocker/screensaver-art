import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignUpForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'

export function SignUpPage() {
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://living-art-screensaver.com/auth/login',
          },
        })
        if (error) return { error: error.message }
        setSuccess(true)
        return {}
      }}
      onLoginClick={() => navigate('/login')}
    />
  )
}
