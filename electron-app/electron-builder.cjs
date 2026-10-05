// electron-builder config. JS so signing can be switched by env vars:
//   - Default: electron-builder doesn't sign; scripts/afterpack-sign.cjs ad-hoc
//     signs the bundle so the .appex still registers on this machine.
//   - LART_CODESIGN_IDENTITY set: Developer ID signing with hardened runtime.
//     electron-builder skips Contents/PlugIns, so afterpack-sign.cjs signs the
//     .appex and helper. Add APPLE_KEYCHAIN_PROFILE (or APPLE_ID /
//     APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID) to notarize;
//     scripts/aftersign-staple.cjs staples the ticket.
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

  // Auto-update feed: the website's /updates route, which proxies the latest
  // GitHub release, so no token ships in the app. Also makes electron-builder
  // emit latest-mac.yml and the zip blockmap, which release.sh uploads.
  publish: [{ provider: 'generic', url: 'https://living-art-screensaver.com/updates' }],

  // The OAuth deep link scheme (livingart://auth-callback).
  protocols: [{ name: 'Living Art Screensaver', schemes: ['livingart'] }],

  // Re-sign the .appex after the universal merge breaks its signature; staple after signing.
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

  // From scripts/bundle-appex.sh. pluginkit needs the .appex in Contents/PlugIns/;
  // the helper goes in Contents/Resources/.
  extraFiles: [
    { from: 'resources/ScreensaverArtExtension.appex', to: 'PlugIns/ScreensaverArtExtension.appex' },
  ],
  extraResources: [
    { from: 'resources/lart-screensaver-helper', to: 'lart-screensaver-helper' },
  ],

  mac: {
    category: 'public.app-category.utilities',
    // The DMG is for first installs; the zip is what auto-update downloads.
    target: [
      { target: 'dmg', arch: ['universal'] },
      { target: 'zip', arch: ['universal'] },
    ],
    // Already universal binaries, so don't lipo-merge them.
    x64ArchFiles: 'Contents/{PlugIns/**,Resources/lart-screensaver-helper}',
    // The zip's name (the dmg sets its own). No spaces: latest-mac.yml names it
    // exactly, and GitHub turns spaces in asset names into dots.
    artifactName: 'Living-Art-Screensaver-${version}-${arch}.${ext}',
    gatekeeperAssess: false,
    hardenedRuntime: signed,
    // Uses build/entitlements.mac{,.inherit}.plist.
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
