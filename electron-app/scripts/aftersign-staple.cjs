// electron-builder `afterSign` hook — staple the notarization ticket.
//
// By the time this runs, electron-builder has signed the app and (when Apple
// notary creds are configured) notarized it via @electron/notarize — which
// submits + waits but does NOT staple. We staple the ticket onto the .app here,
// before the DMG target is built, so the DMG contains a Gatekeeper-clean app
// that verifies even offline.
//
// electron-builder only invokes afterSign when signing actually occurred, so
// this never runs for ad-hoc/local builds. We additionally gate on notary creds
// being present (mirroring electron-builder's getNotarizeOptions) because
// stapling fails if the app wasn't notarized.

const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const hasNotaryCreds = Boolean(
    process.env.APPLE_KEYCHAIN_PROFILE || process.env.APPLE_ID || process.env.APPLE_API_KEY,
  )
  if (!hasNotaryCreds) {
    console.log(
      '[aftersign-staple] no notary creds (APPLE_KEYCHAIN_PROFILE / APPLE_ID / APPLE_API_KEY) — ' +
        'app is signed but not notarized; skipping staple',
    )
    return
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  if (!existsSync(appPath)) {
    throw new Error(`[aftersign-staple] app not found at ${appPath}`)
  }

  console.log(`[aftersign-staple] stapling notarization ticket to ${appPath}`)
  execFileSync('/usr/bin/xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  execFileSync('/usr/bin/xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' })
  console.log('[aftersign-staple] stapled + validated ✓')
}
