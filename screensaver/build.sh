#!/usr/bin/env bash
# build.sh — Compile and (optionally) install the Screensaver Art .saver bundle
#
# Usage:
#   bash build.sh           # build only → screensaver/build/ScreensaverArt.saver
#   bash build.sh --install # kill cached procs, build directly into install dir

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="ScreensaverArt"
BUNDLE_NAME="${APP_NAME}.saver"
INSTALL_DIR="${HOME}/Library/Screen Savers"

# ── Kill every process that may have the old bundle mapped in memory ────────
_kill_saver_procs() {
    killall ScreenSaverEngine    2>/dev/null || true
    killall "System Settings"    2>/dev/null || true
    killall "System Preferences" 2>/dev/null || true
    pkill -f legacyScreenSaver   2>/dev/null || true
    sleep 1   # give launchd time to acknowledge the kills before we overwrite files
}

# ── Choose output path ───────────────────────────────────────────────────────
if [[ "${1:-}" == "--install" ]]; then
    # Kill BEFORE touching any files so nothing has the old binary open
    echo "→ Stopping screensaver processes..."
    _kill_saver_procs
    BUNDLE_PATH="${INSTALL_DIR}/${BUNDLE_NAME}"
    mkdir -p "${INSTALL_DIR}"
else
    BUNDLE_PATH="${SCRIPT_DIR}/build/${BUNDLE_NAME}"
fi

# ── Fresh bundle skeleton ────────────────────────────────────────────────────
echo "→ Creating bundle structure..."
rm -rf   "${BUNDLE_PATH}"
mkdir -p "${BUNDLE_PATH}/Contents/MacOS"
mkdir -p "${BUNDLE_PATH}/Contents/Resources"

# ── Compile Swift directly into the destination ──────────────────────────────
# (No intermediate copy — avoids any race where a restarted process grabs stale files)
echo "→ Compiling Swift (this may take a moment)..."
swiftc \
    "${SCRIPT_DIR}"/*.swift \
    -parse-as-library \
    -module-name "${APP_NAME}" \
    -Xlinker -bundle \
    -Xlinker -undefined \
    -Xlinker dynamic_lookup \
    -framework Cocoa \
    -framework ScreenSaver \
    -framework AVFoundation \
    -o "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}"

# ── Copy Info.plist ──────────────────────────────────────────────────────────
echo "→ Copying Info.plist..."
cp "${SCRIPT_DIR}/Info.plist" "${BUNDLE_PATH}/Contents/"

# ── Strip quarantine — macOS blocks newly-written bundles without this ───────
xattr -dr com.apple.quarantine "${BUNDLE_PATH}" 2>/dev/null || true

echo ""
echo "✓ Built: ${BUNDLE_PATH}"

if [[ "${1:-}" == "--install" ]]; then
    echo ""
    echo "Open System Settings → Screen Saver to preview."
fi
