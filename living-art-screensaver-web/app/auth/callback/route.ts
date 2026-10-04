import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * The website's OAuth callback: exchange `?code=` for a cookie session, then go
 * to `next` (default /account). Must be in Supabase's redirect URL list.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-site relative redirects to avoid an open-redirect.
  const nextParam = searchParams.get('next') ?? '/account'
  const next = nextParam.startsWith('/') ? nextParam : '/account'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // The browser SDK never sees this step, so identify here.
      if (data.user) {
        const posthog = getPostHogClient()
        posthog.identify({ distinctId: data.user.id, properties: { email: data.user.email } })
        posthog.capture({ distinctId: data.user.id, event: 'login_completed', properties: { method: 'oauth' } })
        after(flushPostHog)
      }
      // Behind Vercel's proxy, x-forwarded-host is the public host.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
