import { useNavigate } from 'react-router-dom'
import { OtpForm } from '@screensaver-art/ui'
import { supabase } from '../lib/supabase'

export function OtpPage() {
  const navigate = useNavigate()

  return (
    <OtpForm
      title="Living Art Screensaver"
      onRequestCode={async (email) => {
        // shouldCreateUser: true (the Supabase default) makes the code flow double
        // as sign-up — a first-time email gets an account created on verification.
        // This is now the only email-based path (password auth was removed).
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        })
        if (error) return { error: error.message }
        return {}
      }}
      onVerify={async ({ email, code }) => {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email',
        })
        if (error) return { error: error.message }
        // onAuthStateChange (SIGNED_IN) handles navigation to /gallery.
        return {}
      }}
      onBack={() => navigate('/login')}
    />
  )
}
