import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  FeedbackForm,
} from '@screensaver-art/ui'
import { useFeedback } from '../lib/useFeedback'

// "Help" tab — feedback + diagnostics. Sending feedback always attaches a debug
// snapshot (app version, system info, screensaver install state, recent logs), so
// this doubles as the "something's broken" channel. Lives in its own tab (below
// Gallery and Account) so it's easy to find.
export function HelpPage() {
  const { submitFeedback } = useFeedback()
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    // No top padding: content starts flush under the app shell's titlebar strip
    // so it lines up with the sidebar title (matches the Gallery tab).
    <div className="px-6 pb-6">
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Feedback</CardTitle>
            <CardDescription>
              Got feedback? Something not working? Tell us below!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeedbackForm onSubmit={submitFeedback} />
            <p className="text-xs text-muted-foreground">
              Living Art Screensaver{appVersion ? ` v${appVersion}` : ''}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
