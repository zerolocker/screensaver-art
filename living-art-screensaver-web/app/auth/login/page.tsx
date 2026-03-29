'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoginForm } from '@screensaver-art/ui'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  return (
    <LoginForm
      onSubmit={async ({ email, password }) => {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) return { error: error.message }
        router.push('/account')
        router.refresh()
        return {}
      }}
      onForgotPassword={() => router.push('/auth/forgot-password')}
      onSignUpClick={() => router.push('/auth/sign-up')}
    />
  )
}
