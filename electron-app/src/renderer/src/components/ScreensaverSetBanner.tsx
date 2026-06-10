import { Monitor, Loader2 } from 'lucide-react'
import { Button } from '@screensaver-art/ui'

interface ScreensaverSetBannerProps {
  onSet: () => void
  setting: boolean
  // Shown inline when a "Set" attempt failed — the retry lives right here.
  error?: string | null
}

export function ScreensaverSetBanner({ onSet, setting, error }: ScreensaverSetBannerProps) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-5 mb-6 flex items-center gap-4">
      <div className="p-2 rounded-full bg-amber-500/15 text-amber-500 shrink-0">
        <Monitor className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">
          Your screensaver isn&rsquo;t set to this app yet
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button onClick={onSet} disabled={setting} className="shrink-0">
        {setting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting&hellip;
          </>
        ) : (
          'Set'
        )}
      </Button>
    </div>
  )
}
