'use client'

import { useRouter } from 'next/navigation'
import { SignUpForm } from '@screensaver-art/ui'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()

  return (
    <SignUpForm
      onSubmit={async ({ email, password }) => {
        const supabase = createClient()
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
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
        router.push('/auth/sign-up-success')
        return {}
      }}
      onLoginClick={() => router.push('/auth/login')}
    />
  )
}
