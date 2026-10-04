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

// The Help tab. Feedback always includes diagnostics, so it doubles as the
// "something's broken" channel.
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
