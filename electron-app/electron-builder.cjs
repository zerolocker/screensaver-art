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
  copyright: 'Copyright © 2026 Living Art Screensaver',

  // Auto-update feed (electron-updater). A `generic` provider pointed at the
  // website's /updates route, which proxies the latest GitHub release through the
  // same GITHUB_RELEASE_TOKEN as /download — so updates work identically whether
  // the repo is public or private (no token baked into the app). This block also
  // makes electron-builder (a) emit dist/latest-mac.yml + the zip .blockmap and
  // (b) bake the URL into Contents/Resources/app-update.yml. See CLAUDE.md ›
  // Auto-update. scripts/release.sh uploads latest-mac.yml + the zip (+ blockmap)
  // to the release alongside the DMG.
  publish: [{ provider: 'generic', url: 'https://living-art-screensaver.com/updates' }],

  // Custom URL scheme for OAuth deep links (livingart://auth-callback). This
  // registers CFBundleURLTypes on macOS and the protocol in the Windows
  // installer so the OS hands the post-login redirect back to the app.
  protocols: [{ name: 'Living Art Screensaver', schemes: ['livingart'] }],

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
    // Universal (Intel + Apple Silicon) for both Intel + Apple Silicon. The DMG
    // is the first-install download; the zip is what electron-updater/Squirrel.Mac
    // downloads to apply an in-place update (it can't update from a DMG). Both
    // are emitted from the same signed/notarized/stapled .app (the afterPack appex
    // re-sign + afterSign staple run before any target is built), so the zip
    // carries a valid embedded .appex signature just like the DMG.
    target: [
      { target: 'dmg', arch: ['universal'] },
      { target: 'zip', arch: ['universal'] },
    ],
    // Our embedded .appex + helper are already universal Mach-O, so they're
    // byte-identical across electron-builder's x64/arm64 passes — tell
    // @electron/universal not to lipo-merge them.
    x64ArchFiles: 'Contents/{PlugIns/**,Resources/lart-screensaver-helper}',
    // Governs the zip (the dmg overrides artifactName below). SPACE-FREE on
    // purpose: this name is referenced verbatim inside latest-mac.yml and must
    // match the asset on GitHub — but GitHub Releases rewrites spaces in uploaded
    // asset names to dots, which would break the updater's lookup. A hyphenated
    // name uploads unchanged. (The dmg gets its clean hyphenated name in
    // scripts/release.sh; the updater can't be renamed after the fact.)
    artifactName: 'Living-Art-Screensaver-${version}-${arch}.${ext}',
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
