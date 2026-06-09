import { UpsellBanner } from './UpsellBanner'
import { ScreensaverSetBanner } from './ScreensaverSetBanner'
import { useInstaller } from '../lib/InstallerProvider'

interface AppBannersProps {
  /** Whether to show the "unlock the full gallery" upsell — each page decides
      from its own subscription source (gallery response vs. verify endpoint). */
  showUpsell: boolean
}

// The single top-of-app banner stack, shared by every page so the order (and
// priority) lives in one place. The "set your screensaver" banner outranks the
// upsell, so it renders first when both apply. The set banner reads installer
// state from context; the upsell gate is page-specific and passed in.
export function AppBanners({ showUpsell }: AppBannersProps) {
  const { needsActivation, activating, activate } = useInstaller()

  return (
    <>
      {needsActivation && <ScreensaverSetBanner onSet={activate} setting={activating} />}
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
