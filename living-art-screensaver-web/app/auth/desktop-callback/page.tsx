'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle } from 'lucide-react'

// The desktop (Electron) app listens for the OAuth result on this custom scheme.
const DEEP_LINK = 'livingart://auth-callback'

/**
 * Desktop OAuth hand-off page.
 *
 * The Electron app does OAuth in the system browser. We can't use the
 * `livingart://` deep link directly as Supabase's `redirect_to` — the browser
 * would be left sitting on a half-finished navigation to a custom scheme,
 * spinning forever even though the app already signed in. So the provider
 * redirects *here* with the PKCE `?code=` (or `?error=`), and this page:
 *   1. Forwards the whole query string to the app via the deep link, and
 *   2. Tells the user they can close the tab and return to the app.
 *
 * We only *forward* the code — we must NOT exchange it. The PKCE code verifier
 * lives in the Electron app's supabase-js instance, so only the app can complete
 * the exchange (that's what makes this distinct from /auth/callback, which is the
 * website's own session).
 */
export default function DesktopCallbackPage() {
  // The query string carrying the code/error, captured client-side.
  const [search, setSearch] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const query = window.location.search // ?code=… on success, ?error=… on failure
    setSearch(query)
    const params = new URLSearchParams(query)
    setIsError(Boolean(params.get('error') || params.get('error_description')))
    // Hand off to the app. Custom-scheme navigation doesn't replace this
    // document, so the message below stays visible afterwards.
    window.location.href = `${DEEP_LINK}${query}`
  }, [])

  // Re-trigger the hand-off — browsers may block the automatic one above when it
  // isn't tied to a user gesture, so the button is the reliable fallback.
  const reopenApp = (): void => {
    if (search !== null) window.location.href = `${DEEP_LINK}${search}`
  }

  if (isError) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold text-foreground">Sign-in didn’t complete</h1>
          <p className="text-muted-foreground">
            Something went wrong. Return to the Living Art Screensaver app and try again.
          </p>
        </div>
        <div className="pt-2 flex gap-3 justify-center">
          <Button onClick={reopenApp}>Return to the app</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">You’re signed in</h1>
        <p className="text-muted-foreground">
          You can close this window and return to the Living Art Screensaver app.
        </p>
      </div>
      <div className="pt-2">
        <Button onClick={reopenApp}>Return to the app</Button>
      </div>
    </div>
  )
}
