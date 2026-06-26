'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  OAuthButtons,
  OtpForm,
  OAUTH_PROVIDER_OPTIONS,
  type OAuthProvider,
} from '@screensaver-art/ui'
import { Loader2 } from 'lucide-react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

// Single passwordless auth screen — no email/password. Social sign-in and the
// email one-time code both create the account on first use, so there's no
// separate sign-up step. (Matches the Electron app.)
function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Where to land after auth. pricing-section etc. pass ?redirect=…
  const next = searchParams.get('redirect') ?? '/account'

  const [mode, setMode] = useState<'choose' | 'otp'>('choose')
  const [error, setError] = useState<string | null>(null)

  async function startOAuth(provider: OAuthProvider) {
    setError(null)
    posthog.capture('oauth_sign_in_clicked', { provider })
    const supabase = createClient()
    const { scopes, queryParams } = OAUTH_PROVIDER_OPTIONS[provider]
    // @supabase/ssr uses the PKCE flow: the provider redirects back to
    // /auth/callback?code=…, which exchanges the code for a cookie session.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, scopes, queryParams },
    })
    if (error) setError(error.message)
    // On success the browser navigates to the provider — nothing more to do here.
  }

  if (mode === 'otp') {
    return (
      <OtpForm
        title="Living Art Screensaver"
        onBack={() => setMode('choose')}
        onRequestCode={async (email) => {
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithOtp({
            email,
            // Default-true: the code flow doubles as sign-up.
            options: { shouldCreateUser: true },
          })
          if (!error) posthog.capture('otp_code_requested')
          return error ? { error: error.message } : {}
        }}
        onVerify={async ({ email, code }) => {
          const supabase = createClient()
          const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
          if (error) return { error: error.message }
          if (data.user) {
            // Stitch the prior anonymous session to the user, then record login.
            posthog.identify(data.user.id, { email: data.user.email })
            posthog.capture('login_completed', { method: 'email_otp' })
          }
          router.push(next)
          router.refresh()
          return {}
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">Living Art Screensaver</h1>
        <h2 className="text-xl font-semibold text-foreground">Sign in or create an account</h2>
        <p className="text-muted-foreground">No password needed.</p>
      </div>

      <OAuthButtons onSelect={startOAuth} />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setMode('otp')}
      >
        Continue with email
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
          <span className="text-red-400 shrink-0">✕</span>
          <span className="text-neutral-300">{error}</span>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
