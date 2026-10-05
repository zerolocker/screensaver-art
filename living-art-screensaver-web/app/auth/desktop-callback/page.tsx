'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle } from 'lucide-react'

const DEEP_LINK = 'livingart://auth-callback'

/**
 * Where the app's OAuth sign-in lands in the browser. Redirecting straight to
 * the `livingart://` deep link leaves the browser spinning, so the provider
 * comes here and this page forwards the query string to the app, then says the
 * tab can be closed. It must not exchange the code itself: only the app holds
 * the PKCE verifier.
 */
export default function DesktopCallbackPage() {
  const [search, setSearch] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const query = window.location.search // ?code=… on success, ?error=… on failure
    setSearch(query)
    const params = new URLSearchParams(query)
    setIsError(Boolean(params.get('error') || params.get('error_description')))
    // A custom-scheme navigation leaves this page visible.
    window.location.href = `${DEEP_LINK}${query}`
  }, [])

  // Browsers may block the automatic hand-off without a user gesture.
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
