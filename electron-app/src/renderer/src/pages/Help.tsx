import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from '@screensaver-art/ui'
import { Loader2, Bug } from 'lucide-react'
import { useErrorReport } from '../lib/useErrorReport'

// "Help" tab — diagnostics + error reporting. Lives in its own tab (below
// Gallery and Account) so it's easy to find when something goes wrong.
export function HelpPage() {
  const { reporting, reportResult, sendReport } = useErrorReport()
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-2xl">
      <div className="titlebar-drag mb-6">
        <h2 className="text-xl font-semibold text-foreground titlebar-no-drag">Help</h2>
      </div>

      <div className="space-y-6">
        {/* Diagnostics / error reporting */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Diagnostics</CardTitle>
            <CardDescription>
              Something not working? Send us a debug report — app version, system info, screensaver
              install state, and recent logs. No video content is included.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => sendReport('manual')} disabled={reporting}>
                {reporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Bug className="mr-2 h-4 w-4" /> Send error report
                  </>
                )}
              </Button>
              {reportResult?.ok && (
                <p className="text-xs text-green-500">
                  Report sent. Reference ID: <code className="font-mono">{reportResult.id}</code>
                </p>
              )}
              {reportResult && !reportResult.ok && (
                <p className="text-xs text-red-500">
                  Couldn’t send report: {reportResult.error ?? 'unknown error'}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Living Art Screensaver{appVersion ? ` v${appVersion}` : ''}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
