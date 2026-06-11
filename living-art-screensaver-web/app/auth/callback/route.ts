import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth (PKCE) callback. The provider redirects the browser here with a `?code=`;
 * we exchange it for a session (which @supabase/ssr writes to cookies) and send
 * the user on to `next` (defaults to /account). The matching URL must be listed
 * in Supabase Auth → URL Configuration → Redirect URLs (e.g.
 * https://living-art-screensaver.com/auth/callback).
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-site relative redirects to avoid an open-redirect.
  const nextParam = searchParams.get('next') ?? '/account'
  const next = nextParam.startsWith('/') ? nextParam : '/account'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Behind Vercel's proxy the load balancer host is in x-forwarded-host;
      // prefer it in production so the redirect targets the public domain.
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
