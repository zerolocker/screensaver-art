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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
          },
        })
        if (error) return { error: error.message }
        router.push('/auth/sign-up-success')
        return {}
      }}
      onLoginClick={() => router.push('/auth/login')}
    />
  )
}
