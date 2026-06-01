// electron-builder `afterPack` hook — make the embedded screensaver .appex have
// a VALID code signature in the packaged app.
//
// WHY THIS EXISTS
// For a `universal` mac build, electron-builder builds an x64 and an arm64 app
// and merges them with @electron/universal. That merge rewrites nested
// `Info.plist` files AFTER the .appex was signed, invalidating its signature:
//
//     codesign --verify …/ScreensaverArtExtension.appex
//     → "invalid Info.plist (plist or signature have been modified)"
//
// `pluginkit -a` silently refuses to register a screensaver extension whose
// signature is broken — it exits 0 but the extension never shows up in
// `pluginkit -m`. In the app that surfaced as the install error
//     "Failed to register the screensaver (helper exit 0)."
//
// macPackager calls afterPack once for the merged universal app, after the merge
// and before electron-builder's own signing — so this is where we fix the appex.
//
// TWO MODES (driven by LART_CODESIGN_IDENTITY; kept in lockstep with
// electron-builder.cjs):
//
//   ad-hoc ("-" / unset): electron-builder does NOT sign (identity:null), so we
//     sign the WHOLE bundle ourselves: deep ad-hoc sign, re-sign the appex with
//     its entitlements, re-seal the outer app, verify. Matches the locally-valid
//     signature Xcode gives the dev DevHost build (registers fine on this Mac).
//
//   Developer ID: electron-builder signs the frameworks/helpers/outer app with
//     the hardened runtime AND notarizes — but it ignores Contents/PlugIns, so
//     it never touches the appex. We pre-sign ONLY the appex (with its sandbox
//     entitlements) + the helper (insurance) here, hardened runtime + secure
//     timestamp; electron-builder then seals the outer app over them.

const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

const APPEX_REL = path.join('Contents', 'PlugIns', 'ScreensaverArtExtension.appex')
const HELPER_REL = path.join('Contents', 'Resources', 'lart-screensaver-helper')

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
  // Ad-hoc signatures carry no secure timestamp; a Developer ID build needs a
  // timestamp + the hardened runtime for notarization.
  const opts = adhoc ? ['--timestamp=none'] : ['--timestamp', '--options', 'runtime']

  const codesign = (args) =>
    execFileSync('/usr/bin/codesign', ['--force', '--sign', identity, ...opts, ...args], {
      stdio: 'inherit',
    })

  if (adhoc) {
    // 1. Sign all nested code + the app in one pass.
    codesign(['--deep', appPath])
    // 2. Give the appex back its entitlements (deep signing dropped them).
    codesign(['--entitlements', entitlements, appexPath])
    // 3. Re-seal the outer app over the re-signed appex.
    codesign([appPath])
  } else {
    // Developer ID: only the appex (+ helper) need our intervention; electron-
    // builder signs and seals everything else afterwards.
    if (existsSync(helperPath)) {
      codesign([helperPath])
    }
    codesign(['--entitlements', entitlements, appexPath])
  }

  // Verify the appex regardless of mode — a broken appex signature is the exact
  // condition that makes the screensaver impossible to register. (The outer app
  // is only fully signed at this point in ad-hoc mode; electron-builder signs +
  // verifies it in Developer ID mode.)
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
