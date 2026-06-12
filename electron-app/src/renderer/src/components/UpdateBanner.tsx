import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@screensaver-art/ui'

interface UpdateBannerProps {
  // The version that's been downloaded and is ready to install.
  version?: string
  onRelaunch: () => void
  // A relaunch is in flight (the app is about to quit + reopen).
  relaunching: boolean
}

// Shown at the top of the app once a new version has downloaded in the
// background — the Claude-Desktop "Relaunch to update" prompt. Mirrors
// ScreensaverSetBanner's layout; emerald to read as a positive/ready state.
export function UpdateBanner({ version, onRelaunch, relaunching }: UpdateBannerProps) {
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 mb-6 flex items-center gap-4">
      <div className="p-2 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">
          {version ? `Version ${version} is ready to install` : 'A new version is ready to install'}
        </p>
        <p className="text-sm text-muted-foreground">
          Relaunch to update &mdash; it only takes a moment.
        </p>
      </div>
      <Button onClick={onRelaunch} disabled={relaunching} className="shrink-0">
        {relaunching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Relaunching&hellip;
          </>
        ) : (
          'Relaunch to update'
        )}
      </Button>
    </div>
  )
}
