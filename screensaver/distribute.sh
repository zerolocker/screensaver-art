#!/usr/bin/env bash
# distribute.sh — Build ScreensaverArt and package it as an installable DMG
#
# Usage:
#   bash distribute.sh           # → screensaver/dist/ScreensaverArt-<version>.dmg
#   bash distribute.sh 1.2       # override version string
#
# What ends up in the DMG:
#   ScreensaverArt.saver         — the bundle (users can install manually if they prefer)
#   Install ScreensaverArt.command — double-click installer (handles process-killing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="ScreensaverArt"
BUNDLE_NAME="${APP_NAME}.saver"
VERSION="${1:-1.0}"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
DIST_DIR="${SCRIPT_DIR}/dist"
STAGING="${DIST_DIR}/staging"

# ── Step 1: Build the .saver bundle ─────────────────────────────────────────
echo "→ Building ${BUNDLE_NAME}..."
bash "${SCRIPT_DIR}/build.sh"   # produces screensaver/build/ScreensaverArt.saver

# ── Step 2: Populate staging directory ──────────────────────────────────────
echo "→ Preparing staging directory..."
rm -rf  "${STAGING}"
mkdir -p "${STAGING}"
cp -r "${SCRIPT_DIR}/build/${BUNDLE_NAME}" "${STAGING}/"

# ── Step 3: Write the installer script ──────────────────────────────────────
# .command files open in Terminal on double-click — the right UX for installers.
# NOTE: This script runs from inside the mounted DMG, so ${SCRIPT_DIR} will be
#       something like /Volumes/ScreensaverArt — the .saver sits right next to it.

INSTALLER="${STAGING}/Install ScreensaverArt.command"
cat > "${INSTALLER}" << 'INSTALLER_SCRIPT'
#!/usr/bin/env bash
# ScreensaverArt Installer
# ────────────────────────
# Double-click this file to install Living Art Screensaver.
# A Terminal window will open briefly to handle the installation.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SAVER="${HERE}/ScreensaverArt.saver"
INSTALL_DIR="${HOME}/Library/Screen Savers"

echo "╔═══════════════════════════════════════╗"
echo "║   Living Art Screensaver — Installer  ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Guard: make sure the .saver bundle is present ───────────────────────────
if [[ ! -d "${SAVER}" ]]; then
    echo "✗  Cannot find ScreensaverArt.saver next to this installer."
    echo "   Please re-download the DMG and try again."
    read -rp "Press Enter to close…"
    exit 1
fi

# ── Kill processes that hold the old bundle mapped in memory ─────────────────
# Apple's legacy screensaver framework does not release the bundle until the
# hosting processes are killed. Overwriting a live binary causes hangs / crashes.
echo "→ Stopping screensaver processes (this is normal)…"
killall ScreenSaverEngine    2>/dev/null || true
killall "System Settings"    2>/dev/null || true
killall "System Preferences" 2>/dev/null || true
pkill -f legacyScreenSaver   2>/dev/null || true
sleep 1   # give launchd time to acknowledge the kills

# ── Copy bundle ──────────────────────────────────────────────────────────────
echo "→ Installing ScreensaverArt.saver to ~/Library/Screen Savers/…"
mkdir -p "${INSTALL_DIR}"
rm -rf   "${INSTALL_DIR}/ScreensaverArt.saver"
cp -r    "${SAVER}" "${INSTALL_DIR}/"

# ── Strip quarantine ─────────────────────────────────────────────────────────
# Without this, macOS blocks the bundle even after manual installation.
xattr -dr com.apple.quarantine "${INSTALL_DIR}/ScreensaverArt.saver" 2>/dev/null || true

echo ""
echo "✓  Installation complete!"
echo ""

# ── Open System Settings → Screen Saver ──────────────────────────────────────
echo "→ Opening System Settings → Screen Saver…"
sleep 0.5
# Try URL scheme first (macOS 13+), then fall back to older pref pane IDs
open "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension" 2>/dev/null \
    || open "x-apple.systempreferences:com.apple.preference.screensaver"  2>/dev/null \
    || open -a "System Settings"                                           2>/dev/null \
    || open -a "System Preferences"                                        2>/dev/null \
    || true

echo ""
echo "  1. Select 'ScreensaverArt' from the screensaver list"
echo "  2. Click 'Options…' to sign in to your account"
echo "  3. Visit https://living-art-screensaver.com to subscribe"
echo ""
read -rp "Press Enter to close this window…"
INSTALLER_SCRIPT

chmod +x "${INSTALLER}"

# ── Step 4: Create the DMG ───────────────────────────────────────────────────
echo "→ Creating DMG (${DMG_NAME})…"
rm -f "${DIST_DIR}/${DMG_NAME}"

hdiutil create \
    -volname  "${APP_NAME}" \
    -srcfolder "${STAGING}" \
    -ov \
    -format   UDZO \
    "${DIST_DIR}/${DMG_NAME}"

# Strip quarantine from the DMG so Gatekeeper doesn't block the contents
xattr -dr com.apple.quarantine "${DIST_DIR}/${DMG_NAME}" 2>/dev/null || true

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✓ DMG ready: ${DIST_DIR}/${DMG_NAME}"
echo ""
echo "  Distribute this file to users."
echo "  They open the DMG and double-click 'Install ScreensaverArt.command'."
