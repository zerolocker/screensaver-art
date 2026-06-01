// electron-builder `afterPack` hook — re-sign the packaged mac app so the
// embedded screensaver .appex has a VALID code signature.
//
// WHY THIS EXISTS
// For a `universal` mac build, electron-builder builds an x64 and an arm64 app
// and merges them with @electron/universal. That merge rewrites nested
// `Info.plist` files AFTER Xcode signed the .appex, which invalidates the
// appex's signature:
//
//     codesign --verify …/ScreensaverArtExtension.appex
//     → "invalid Info.plist (plist or signature have been modified)"
//
// `pluginkit -a` silently refuses to register a screensaver extension whose
// signature is broken — it exits 0 but the extension never shows up in
// `pluginkit -m`. In the app that surfaced as the install error
//     "Failed to register the screensaver (helper exit 0)."
// The merge also leaves the merged frameworks unsigned and the outer app's seal
// referencing the now-stale appex, which would trigger a "damaged app"
// Gatekeeper block on a downloaded (quarantined) DMG.
//
// macPackager calls afterPack exactly once for the merged universal app, after
// the merge and before its own (no-op under identity:null) signing — so this is
// the place to repair everything. We re-sign the WHOLE bundle consistently:
//
//   1. `--deep` sign everything (frameworks, helper apps, the appex, the app)
//      so all nested code is signed.
//   2. Re-sign the appex WITH its entitlements (step 1's --deep can't apply the
//      appex's sandbox + /Users/Shared temporary-exception entitlements).
//   3. Re-seal the outer app so its signature matches the re-signed appex.
//
// Ad-hoc ("-") matches the locally-valid signature Xcode produces for the dev
// DevHost build, which registers fine. Set LART_CODESIGN_IDENTITY to a
// "Developer ID Application" identity once notarization is set up (this hook
// already signs inside-out + can apply the hardened runtime, both of which
// notarization requires).

const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

const APPEX_REL = path.join('Contents', 'PlugIns', 'ScreensaverArtExtension.appex')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // afterPack fires for BOTH the per-arch sub-builds of a universal build
  // (electron-builder packs them into `<appOutDir>-<arch>-temp` dirs) AND the
  // final merged app. We must NOT sign the per-arch temp builds: @electron/
  // universal merges them and requires their non-binary files (including each
  // framework's `_CodeSignature/CodeResources`) to be byte-identical across
  // arches. Signing them independently diverges those files and the merge fails
  // with "Expected all non-binary files to have identical SHAs…". Sign only the
  // merged universal app (and standalone single-arch builds), never the temps.
  if (/-(x64|arm64|armv7l|ia32)-temp$/.test(context.appOutDir)) {
    console.log(`[afterpack-sign] skipping per-arch temp build ${context.appOutDir}`)
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  const appexPath = path.join(appPath, APPEX_REL)
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
  // Ad-hoc signatures carry no secure timestamp; a Developer ID build needs a
  // timestamp + the hardened runtime for notarization.
  const opts = adhoc ? ['--timestamp=none'] : ['--timestamp', '--options', 'runtime']

  const codesign = (args) =>
    execFileSync('/usr/bin/codesign', ['--force', '--sign', identity, ...opts, ...args], {
      stdio: 'inherit',
    })

  // 1. Sign all nested code + the app in one pass.
  codesign(['--deep', appPath])
  // 2. Give the appex back its entitlements (deep signing dropped them).
  codesign(['--entitlements', entitlements, appexPath])
  // 3. Re-seal the outer app over the re-signed appex.
  codesign([appPath])

  // Fail the build loudly if either signature isn't valid — that's the exact
  // condition that made the shipped screensaver impossible to register / launch.
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appexPath], {
    stdio: 'inherit',
  })
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit',
  })
  console.log(`[afterpack-sign] re-signed bundle (${identity}); appex + app signatures valid ✓`)
}
