// electron-builder configuration — JS (not YAML) so code signing + notarization
// can be toggled by environment variables without a second config file.
//
// ── Local / contributors (default, no env): unsigned for distribution ────────
//   `identity: null` makes electron-builder skip signing. scripts/afterpack-
//   sign.cjs then ad-hoc signs the whole bundle so the embedded .appex still
//   has a valid signature and registers with pluginkit on this machine.
//
// ── Release (Developer ID): set LART_CODESIGN_IDENTITY ───────────────────────
//   LART_CODESIGN_IDENTITY="Developer ID Application: NAME (TEAMID)"
//     → electron-builder signs the frameworks/helpers/outer app with the
//       hardened runtime (build/entitlements.mac.*.plist). It ignores
//       Contents/PlugIns by design, so scripts/afterpack-sign.cjs pre-signs the
//       .appex (with its sandbox entitlements) + the helper.
//   To also notarize + staple, add Apple notary creds via electron-builder's
//   native env vars — either a keychain profile from `notarytool
//   store-credentials`:
//     APPLE_KEYCHAIN_PROFILE="living-art-notary"
//   or APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID. electron-builder
//   notarizes during signing; scripts/aftersign-staple.cjs staples the ticket
//   onto the .app before the DMG is built.
//
//   Example:
//     LART_CODESIGN_IDENTITY="Developer ID Application: Jingwen Xu (65WVV3H5N8)" \
//     APPLE_KEYCHAIN_PROFILE="living-art-notary" \
//     pnpm dist:mac

const identity = process.env.LART_CODESIGN_IDENTITY
const signed = Boolean(identity) && identity !== '-'

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.livingart.screensaver.app',
  productName: 'Living Art Screensaver',
  copyright: 'Copyright © 2026 Living Art',

  // Repair/sign the embedded .appex after the universal merge (which invalidates
  // its signature), and staple the notarization ticket after signing.
  afterPack: 'scripts/afterpack-sign.cjs',
  afterSign: 'scripts/aftersign-staple.cjs',

  directories: {
    output: 'dist',
    buildResources: 'build',
  },

  files: [
    'out/**/*',
    'package.json',
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
  ],

  // scripts/bundle-appex.sh builds the screensaver extension + PaperSaver helper
  // (both universal) into resources/. Place them where installer.ts looks:
  //   - the .appex in Contents/PlugIns/ (embedded extension → required for
  //     pluginkit registration + the parent-bundle-id prefix)
  //   - the helper CLI in Contents/Resources/ (process.resourcesPath)
  extraFiles: [
    { from: 'resources/ScreensaverArtExtension.appex', to: 'PlugIns/ScreensaverArtExtension.appex' },
  ],
  extraResources: [
    { from: 'resources/lart-screensaver-helper', to: 'lart-screensaver-helper' },
  ],

  mac: {
    category: 'public.app-category.utilities',
    // One universal DMG for Intel + Apple Silicon.
    target: [{ target: 'dmg', arch: ['universal'] }],
    // Our embedded .appex + helper are already universal Mach-O, so they're
    // byte-identical across electron-builder's x64/arm64 passes — tell
    // @electron/universal not to lipo-merge them.
    x64ArchFiles: 'Contents/{PlugIns/**,Resources/lart-screensaver-helper}',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    gatekeeperAssess: false,
    // Hardened runtime is required for notarization; only enable it when we're
    // actually signing with Developer ID (ad-hoc local builds leave it off).
    hardenedRuntime: signed,
    // `null` → skip signing (local/ad-hoc). A Developer ID name → real signing.
    // electron-builder auto-uses build/entitlements.mac{,.inherit}.plist.
    identity: signed ? identity : null,
  },

  dmg: {
    artifactName: '${productName}-${version}.${ext}',
    title: '${productName}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },

  win: {
    target: ['nsis'],
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
  },
}
