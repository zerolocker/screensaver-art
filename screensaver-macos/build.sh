#!/usr/bin/env bash
# Generate the Xcode project from project.yml and build the .appex, embedded in
# the DevHost scaffold.
#
#   bash build.sh           # Release, universal (x86_64 + arm64) — for shipping
#   bash build.sh Debug     # Debug, host arch — fast dev loop (auto-registers)
#
# Prints the path to the built .appex on the last line.
# Requires Xcode + xcodegen (brew install xcodegen).

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

CONFIG="${1:-Release}"

if command -v xcodegen >/dev/null 2>&1; then
    xcodegen generate >/dev/null
elif [ ! -d ScreensaverArt.xcodeproj ]; then
    echo "xcodegen not found and no ScreensaverArt.xcodeproj present." >&2
    echo "Install it with: brew install xcodegen" >&2
    exit 1
fi

echo "→ Building ScreensaverArtExtension.appex ($CONFIG)…" >&2
# Release is universal (ARCHS_STANDARD is arm64-only here); Debug is host-only.
ARCH_ARGS=()
if [ "$CONFIG" = "Release" ]; then
    ARCH_ARGS=(ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO)
fi
# The app version from bundle-appex.sh. It must change every release, because
# pluginkit caches by CFBundleVersion.
VERSION_ARGS=()
if [ -n "${LART_APPEX_VERSION:-}" ]; then
    VERSION_ARGS=(CURRENT_PROJECT_VERSION="$LART_APPEX_VERSION" MARKETING_VERSION="$LART_APPEX_VERSION")
    echo "    stamping appex version: $LART_APPEX_VERSION" >&2
fi
xcodebuild -project ScreensaverArt.xcodeproj -scheme DevHost \
    -configuration "$CONFIG" -derivedDataPath build \
    "${ARCH_ARGS[@]+"${ARCH_ARGS[@]}"}" \
    "${VERSION_ARGS[@]+"${VERSION_ARGS[@]}"}" CODE_SIGNING_ALLOWED=YES build >&2

APPEX="$DIR/build/Build/Products/$CONFIG/DevHost.app/Contents/PlugIns/ScreensaverArtExtension.appex"
[ -d "$APPEX" ] || { echo "Build did not produce $APPEX" >&2; exit 1; }
echo "$APPEX"
