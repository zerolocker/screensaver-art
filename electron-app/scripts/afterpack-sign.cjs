// electron-builder `afterPack` hook: give the embedded .appex a valid signature.
//
// The universal merge rewrites the appex's Info.plist after it was signed, and
// `pluginkit -a` silently ignores an appex with a broken signature. This runs
// after the merge and before electron-builder signs. LART_CODESIGN_IDENTITY
// picks the mode (matching electron-builder.cjs):
//   - Ad-hoc (unset or "-"): electron-builder doesn't sign, so sign the whole
//     bundle here.
//   - Developer ID: electron-builder signs everything except Contents/PlugIns,
//     so sign only the appex and helper here.

const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

const APPEX_REL = path.join('Contents', 'PlugIns', 'ScreensaverArtExtension.appex')
const HELPER_REL = path.join('Contents', 'Resources', 'lart-screensaver-helper')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Skip the per-arch temp builds: the universal merge needs their non-binary
  // files identical, and signing them separately breaks that.
  if (/-(x64|arm64|armv7l|ia32)-temp$/.test(context.appOutDir)) {
    console.log(`[afterpack-sign] skipping per-arch temp build ${context.appOutDir}`)
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  const appexPath = path.join(appPath, APPEX_REL)
  const helperPath = path.join(appPath, HELPER_REL)
  const entitlements = path.join(
    __dirname,
    '..',
    '..',
    'screensaver-macos',
    'ScreensaverArtExtension',
    'ScreensaverArtExtension.entitlements',
  )

  if (!existsSync(appexPath)) {
    throw new Error(`[afterpack-sign] expected appex not found at ${appexPath}`)
  }

  const identity = process.env.LART_CODESIGN_IDENTITY || '-'
  const adhoc = identity === '-'
  // Notarization needs a timestamp and the hardened runtime.
  const opts = adhoc ? ['--timestamp=none'] : ['--timestamp', '--options', 'runtime']

  const codesign = (args) =>
    execFileSync('/usr/bin/codesign', ['--force', '--sign', identity, ...opts, ...args], {
      stdio: 'inherit',
    })

  if (adhoc) {
    codesign(['--deep', appPath])
    // Deep signing dropped the appex's entitlements.
    codesign(['--entitlements', entitlements, appexPath])
    // Re-seal the app over the re-signed appex.
    codesign([appPath])
  } else {
    if (existsSync(helperPath)) {
      codesign([helperPath])
    }
    codesign(['--entitlements', entitlements, appexPath])
  }

  // A broken appex signature makes registration fail, so always verify it.
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appexPath], {
    stdio: 'inherit',
  })
  if (adhoc) {
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
      stdio: 'inherit',
    })
  }
  console.log(
    `[afterpack-sign] ${adhoc ? 'ad-hoc signed bundle' : 'pre-signed appex + helper'} (${identity}); appex signature valid ✓`,
  )
}
