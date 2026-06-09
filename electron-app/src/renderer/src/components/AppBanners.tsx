import { UpsellBanner } from './UpsellBanner'
import { ScreensaverSetBanner } from './ScreensaverSetBanner'
import { ScreensaverErrorBanner } from './ScreensaverErrorBanner'
import { useInstaller } from '../lib/InstallerProvider'
import { useErrorReport } from '../lib/useErrorReport'

interface AppBannersProps {
  /** Whether to show the "unlock the full gallery" upsell — each page decides
      from its own subscription source (gallery response vs. verify endpoint). */
  showUpsell: boolean
}

// The single top-of-app banner stack, shared by every page so the order (and
// priority) lives in one place. Priority, highest first:
//   1. screensaver setup error (registration failed) — needs a report
//   2. "set your screensaver" prompt (registered but not active)
//   3. unlock-the-gallery upsell
// The screensaver banners read installer state from context; the upsell gate is
// page-specific and passed in.
export function AppBanners({ showUpsell }: AppBannersProps) {
  const { installer, needsActivation, activating, activate, error } = useInstaller()
  const { reporting, reportResult, sendReport } = useErrorReport()

  // A registration failure (not registered at all) is a setup error we surface
  // up top with a report button. An activation failure (registered but couldn't
  // be made active) is shown inline on the Set banner, where the retry lives.
  const setupFailed = !!error && !!installer && !installer.registered

  return (
    <>
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
        <UpsellBanner
          onSubscribe={() =>
            window.electronAPI.shell.openExternal('https://living-art-screensaver.com/account')
          }
        />
      )}
    </>
  )
}
