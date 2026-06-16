import { useState } from 'react'
import { startCheckout } from '../lib/checkout'
import { UpsellBanner } from './UpsellBanner'
import { ScreensaverSetBanner } from './ScreensaverSetBanner'
import { ScreensaverErrorBanner } from './ScreensaverErrorBanner'
import { UpdateBanner } from './UpdateBanner'
import { useInstaller } from '../lib/InstallerProvider'
import { useUpdate } from '../lib/UpdateProvider'
import { useErrorReport } from '../lib/useErrorReport'

interface AppBannersProps {
  /** Whether to show the "unlock the full gallery" upsell — each page decides
      from its own subscription source (gallery response vs. verify endpoint). */
  showUpsell: boolean
  /** How many pieces are locked for this (non-subscriber) viewer. When known,
      the upsell quantifies the wall ("Unlock N more artworks") instead of a
      vague "full gallery". Omit (0/undefined) on pages that don't compute it. */
  lockedCount?: number
}

// The single top-of-app banner stack, shared by every page so the order (and
// priority) lives in one place. Priority, highest first:
//   1. app update ready ("Relaunch to update")
//   2. screensaver setup error (registration failed) — needs a report
//   3. "set your screensaver" prompt (registered but not active)
//   4. unlock-the-gallery upsell
// The screensaver/update banners read state from context; the upsell gate is
// page-specific and passed in.
export function AppBanners({ showUpsell, lockedCount }: AppBannersProps) {
  const { installer, needsActivation, activating, activate, error } = useInstaller()
  const { state: update, updateReady, relaunch } = useUpdate()
  const { reporting, reportResult, sendReport } = useErrorReport()

  const [relaunching, setRelaunching] = useState(false)
  const handleRelaunch = async () => {
    setRelaunching(true)
    await relaunch()
    // The app is quitting; if it somehow returns (e.g. install failed), re-enable.
    setRelaunching(false)
  }

  // A registration failure (not registered at all) is a setup error we surface
  // up top with a report button. An activation failure (registered but couldn't
  // be made active) is shown inline on the Set banner, where the retry lives.
  const setupFailed = !!error && !!installer && !installer.registered

  return (
    <>
      {updateReady && (
        <UpdateBanner version={update.version} onRelaunch={handleRelaunch} relaunching={relaunching} />
      )}
      {setupFailed && (
        <ScreensaverErrorBanner
          message={error}
          onReport={() => sendReport('screensaver_setup_error', error, { installer })}
          reporting={reporting}
          reported={!!reportResult?.ok}
        />
      )}
      {needsActivation && (
        <ScreensaverSetBanner
          onSet={activate}
          setting={activating}
          error={installer?.registered ? error : null}
        />
      )}
      {showUpsell && (
        <UpsellBanner onSubscribe={() => void startCheckout()} lockedCount={lockedCount} />
      )}
    </>
  )
}
