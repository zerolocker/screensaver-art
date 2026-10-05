import { useState } from 'react'
import { usePlanPicker } from '../lib/PlanPickerProvider'
import { UpsellBanner } from './UpsellBanner'
import { ScreensaverSetBanner } from './ScreensaverSetBanner'
import { ScreensaverStatusBanner, LOCK_SCREEN_SETTINGS_URL } from './ScreensaverStatusBanner'
import { ScreensaverErrorBanner } from './ScreensaverErrorBanner'
import { UpdateBanner } from './UpdateBanner'
import { useInstaller } from '../lib/InstallerProvider'
import { useUpdate } from '../lib/UpdateProvider'
import { useErrorReport } from '../lib/useErrorReport'

interface AppBannersProps {
  /** Each page decides from its own subscription source. */
  showUpsell: boolean
  /** If set, the upsell says "Unlock N more artworks". */
  lockedCount?: number
}

// The banners at the top of every page, highest priority first:
//   1. app update ready ("Relaunch to update")
//   2. screensaver setup error (registration failed) — needs a report
//   3. "set your screensaver" prompt (registered but not active)
//   3b. screensaver status (active), with "Preview now"
//   4. unlock-the-gallery upsell
export function AppBanners({ showUpsell, lockedCount }: AppBannersProps) {
  const { installer, needsActivation, activating, activate, error, timing, preview, previewing } =
    useInstaller()
  const { state: update, updateReady, relaunch } = useUpdate()
  const { reporting, reportResult, sendReport } = useErrorReport()
  const { openPlanPicker } = usePlanPicker()

  const [relaunching, setRelaunching] = useState(false)
  const handleRelaunch = async () => {
    setRelaunching(true)
    await relaunch()
    // Quitting; re-enable if the install fails.
    setRelaunching(false)
  }

  // Registration failures get a banner with a report button; activation
  // failures show on the Set banner, next to the retry.
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
      {installer?.active && (
        <ScreensaverStatusBanner
          timing={timing}
          onPreview={() => void preview()}
          previewing={previewing}
          onOpenSettings={() => void window.electronAPI.shell.openExternal(LOCK_SCREEN_SETTINGS_URL)}
        />
      )}
      {showUpsell && (
        <UpsellBanner onUnlock={() => openPlanPicker('upsell_banner')} lockedCount={lockedCount} />
      )}
    </>
  )
}
