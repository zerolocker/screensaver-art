#!/usr/bin/env bash
# bundle-appex.sh — build the macOS screensaver .appex and the PaperSaver
# activation helper, then copy both (universal) into the Electron app's
# resources/ so they ship inside the packaged app.
#
# electron-builder embeds resources/ScreensaverArtExtension.appex into
# Contents/PlugIns/ and resources/lart-screensaver-helper into Contents/Resources/
# (see electron-builder.yml). installer.ts finds them via process.resourcesPath.
#
# Run from electron-app/ before `pnpm dev` or `pnpm dist`.

set -euo pipefail

ELECTRON_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ELECTRON_DIR}/.." && pwd)"
RES="${ELECTRON_DIR}/resources"

mkdir -p "${RES}"

if [[ "$(uname)" != "Darwin" ]]; then
    echo "→ Skipping .appex/helper bundle on non-macOS host."
    exit 0
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1. Build the screensaver extension (Release = universal) via Xcode, stamping
#    its version from this Electron app's package.json. pluginkit caches appex
#    registrations by CFBundleVersion, so this version MUST bump every release —
#    otherwise an updated app keeps running the old screensaver code (the app's
#    launch-time re-register only takes effect when the version actually changes).
LART_APPEX_VERSION="$(node -p "require('${ELECTRON_DIR}/package.json').version")"
export LART_APPEX_VERSION
echo "→ Stamping appex version from package.json: ${LART_APPEX_VERSION}"
APPEX="$(bash "${REPO_ROOT}/screensaver-macos/build.sh" Release | tail -1)"

# 2. Build the PaperSaver activation helper (universal) via SwiftPM.
echo "→ Building lart-screensaver-helper (universal)…"
( cd "${REPO_ROOT}/screensaver-helper" && swift build -c release --arch arm64 --arch x86_64 >/dev/null )
HELPER="${REPO_ROOT}/screensaver-helper/.build/apple/Products/Release/lart-screensaver-helper"
[ -f "${HELPER}" ] || HELPER="${REPO_ROOT}/screensaver-helper/.build/release/lart-screensaver-helper"

# 3. Copy both into resources/.
rm -rf "${RES}/ScreensaverArtExtension.appex"
cp -R "${APPEX}" "${RES}/ScreensaverArtExtension.appex"
cp "${HELPER}" "${RES}/lart-screensaver-helper"

# 4. Fail loudly if either artifact isn't universal (would break Intel Macs).
assert_universal() {
    local f="$1" archs
    archs="$(lipo -archs "$f")"
    echo "    $(basename "$f"): ${archs}"
    [[ "${archs}" == *x86_64* && "${archs}" == *arm64* ]] || {
        echo "ERROR: ${f} is not universal (${archs})." >&2
        exit 1
    }
}
echo "→ Verifying universal binaries:"
assert_universal "${RES}/ScreensaverArtExtension.appex/Contents/MacOS/ScreensaverArtExtension"
assert_universal "${RES}/lart-screensaver-helper"

echo "✓ Bundled universal .appex + helper into electron-app/resources/"
