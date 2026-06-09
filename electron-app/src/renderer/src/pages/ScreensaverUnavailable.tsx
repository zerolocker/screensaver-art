import { Button } from '@screensaver-art/ui'
import { AlertTriangle, Bug, Loader2, RotateCw, CheckCircle2 } from 'lucide-react'
import { useErrorReport } from '../lib/useErrorReport'
import type { InstallerStatus } from '../../../preload'

// Shown (post-login, full screen) when the embedded screensaver component is
// missing from the app bundle — a should-never-happen state that means an
// incomplete download or a damaged install. We block here because the app can't
// deliver its one job without it. Rendered after sign-in so the error report
// carries the user id (lets us de-dup reports of the same broken build).
export function ScreensaverUnavailable({ installer }: { installer: InstallerStatus }) {
  const { reporting, reportResult, sendReport } = useErrorReport()

  return (
    <div className="titlebar-drag flex items-center justify-center min-h-screen p-8">
      <div className="titlebar-no-drag w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Screensaver component missing</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This copy of the app is missing its screensaver component, so it can&rsquo;t set up your
          screensaver. This usually means the download was incomplete or the app bundle is damaged.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Send us a report and restart the app. If that doesn&rsquo;t fix it, reinstall from{' '}
          living-art-screensaver.com.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => window.electronAPI.app.restart()}>
            <RotateCw className="mr-2 h-4 w-4" /> Restart app
          </Button>
          <Button
            variant="outline"
            onClick={() => sendReport('bundle_missing', 'Bundled screensaver appex missing', { installer })}
            disabled={reporting || reportResult?.ok}
          >
            {reporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : reportResult?.ok ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Report sent
              </>
            ) : (
              <>
                <Bug className="mr-2 h-4 w-4" /> Send error report
              </>
            )}
          </Button>
        </div>

        {reportResult && !reportResult.ok && (
          <p className="mt-3 text-xs text-red-500">
            Couldn&rsquo;t send the report{reportResult.error ? `: ${reportResult.error}` : ''}.
          </p>
        )}
      </div>
    </div>
  )
}
