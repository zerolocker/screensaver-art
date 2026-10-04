#!/usr/bin/env bash
# Build the screensaver .appex and the helper (both universal) into resources/,
# where electron-builder.cjs picks them up. `pnpm dev` and `pnpm dist` run it.

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

# 1. Build the appex with the app's version: pluginkit caches by CFBundleVersion,
#    so without a bump an updated app keeps running the old screensaver code.
LART_APPEX_VERSION="$(node -p "require('${ELECTRON_DIR}/package.json').version")"
export LART_APPEX_VERSION
echo "→ Stamping appex version from package.json: ${LART_APPEX_VERSION}"
APPEX="$(bash "${REPO_ROOT}/screensaver-macos/build.sh" Release | tail -1)"

# 2. Build the helper.
echo "→ Building lart-screensaver-helper (universal)…"
( cd "${REPO_ROOT}/screensaver-helper" && swift build -c release --arch arm64 --arch x86_64 >/dev/null )
HELPER="${REPO_ROOT}/screensaver-helper/.build/apple/Products/Release/lart-screensaver-helper"
[ -f "${HELPER}" ] || HELPER="${REPO_ROOT}/screensaver-helper/.build/release/lart-screensaver-helper"

# 3. Copy both into resources/.
rm -rf "${RES}/ScreensaverArtExtension.appex"
cp -R "${APPEX}" "${RES}/ScreensaverArtExtension.appex"
cp "${HELPER}" "${RES}/lart-screensaver-helper"

# 4. Fail if either isn't universal (Intel Macs need it).
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
