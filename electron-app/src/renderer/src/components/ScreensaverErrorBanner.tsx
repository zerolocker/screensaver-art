import { AlertCircle, Bug, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@screensaver-art/ui'

interface ScreensaverErrorBannerProps {
  message: string
  onReport: () => void
  reporting: boolean
  reported: boolean
}

// Shown at the top of the app when the screensaver couldn't be registered with
// the system (e.g. a bad code signature pluginkit refuses). The user's only
// recovery is to send a report and restart, so we offer the report inline.
export function ScreensaverErrorBanner({
  message,
  onReport,
  reporting,
  reported,
}: ScreensaverErrorBannerProps) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent p-5 mb-6 flex items-center gap-4">
      <div className="p-2 rounded-full bg-red-500/15 text-red-500 shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">Couldn&rsquo;t set up your screensaver</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" onClick={onReport} disabled={reporting || reported} className="shrink-0">
        {reporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending&hellip;
          </>
        ) : reported ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Report sent
          </>
        ) : (
          <>
            <Bug className="mr-2 h-4 w-4" /> Send report
          </>
        )}
      </Button>
    </div>
  )
}
