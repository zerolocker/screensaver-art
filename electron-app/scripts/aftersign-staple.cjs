// electron-builder `afterSign` hook: staple the notarization ticket to the .app
// before the DMG is built, so it passes Gatekeeper offline. electron-builder
// notarizes but doesn't staple. Skipped without notary credentials, since an
// app that wasn't notarized can't be stapled.

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
