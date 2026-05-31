#!/usr/bin/env bash
# build.sh — (re)generate the Xcode project from project.yml and build the
# ScreensaverArtExtension.appex (embedded in the DevHost build scaffold).
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
# Force a universal binary for Release (ARCHS_STANDARD is arm64-only on this
# Xcode). Pass as command-line overrides so they win regardless of project
# defaults. Debug stays single-arch (host) for a fast dev loop.
ARCH_ARGS=()
if [ "$CONFIG" = "Release" ]; then
    ARCH_ARGS=(ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO)
fi
xcodebuild -project ScreensaverArt.xcodeproj -scheme DevHost \
    -configuration "$CONFIG" -derivedDataPath build \
    "${ARCH_ARGS[@]+"${ARCH_ARGS[@]}"}" CODE_SIGNING_ALLOWED=YES build >&2

APPEX="$DIR/build/Build/Products/$CONFIG/DevHost.app/Contents/PlugIns/ScreensaverArtExtension.appex"
[ -d "$APPEX" ] || { echo "Build did not produce $APPEX" >&2; exit 1; }
echo "$APPEX"
