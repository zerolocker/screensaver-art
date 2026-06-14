'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackForm } from '@screensaver-art/ui'
import type { ResizedImage } from '@screensaver-art/ui'
import { createClient } from '@/lib/supabase/client'

// Logged-in feedback on the website. Reuses the shared FeedbackForm (identical to
// the Electron app's Help tab) and POSTs to /api/feedback with a Bearer token —
// the same endpoint the desktop app uses. Debug info here is the browser-side
// analog of the app's diagnostics (there's no installer/cache state on the web).
export function FeedbackCard() {
  async function handleSubmit({ message, image }: { message: string; image: ResizedImage | null }) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'You appear to be signed out. Please refresh and try again.' }
    }

    const body = {
      kind: 'feedback' as const,
      source: 'website' as const,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      message,
      image,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        language: navigator.language,
      },
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data: { id?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { error: data.error || `Couldn't send feedback (HTTP ${res.status})` }
      }
      return { id: data.id }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error — please try again.' }
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Send Feedback</CardTitle>
        <CardDescription>
          Got feedback? Something not working? Tell us below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FeedbackForm onSubmit={handleSubmit} />
      </CardContent>
    </Card>
  )
}
