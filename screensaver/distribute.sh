#!/usr/bin/env bash
# distribute.sh — Build ScreensaverArt and package it as a polished DMG
#
# Usage:
#   bash distribute.sh           # → screensaver/dist/ScreensaverArt-<version>.dmg
#   bash distribute.sh 1.2       # override version string
#
# The DMG contains ONE item the user sees:
#   "Install Living Art.app"  — native macOS installer (built with osacompile)
#     └─ ScreensaverArt.saver is embedded in its Resources/ folder
#
# The DMG window has a dark background image with title + arrow + instruction.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="ScreensaverArt"
BUNDLE_NAME="${APP_NAME}.saver"
INSTALLER_APP="Install Living Art.app"
VERSION="${1:-1.0}"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
DIST_DIR="${SCRIPT_DIR}/dist"
STAGING="${DIST_DIR}/staging"
TMP_DMG="${DIST_DIR}/tmp_rw.dmg"
VOLUME_NAME="Living Art Screensaver"

# DMG Finder window geometry (logical points)
WIN_W=660
WIN_H=400
# Pre-compute arithmetic to avoid bad-substitution in heredocs
BG_W=$((WIN_W * 2))          # @2x Retina
BG_H=$((WIN_H * 2))
WIN_LEFT=300
WIN_TOP=150
WIN_RIGHT=$((WIN_LEFT + WIN_W))
WIN_BOTTOM=$((WIN_TOP + WIN_H))
ICON_X=$((WIN_W / 2))
ICON_Y=$((WIN_H / 2 + 20))

# ── Step 1: Build the .saver bundle ─────────────────────────────────────────
echo "→ Building ${BUNDLE_NAME}…"
bash "${SCRIPT_DIR}/build.sh"

# ── Step 2: Prepare staging directory ───────────────────────────────────────
echo "→ Preparing staging…"
rm -rf  "${STAGING}"
mkdir -p "${STAGING}"

# ── Step 3: Build the installer .app via osacompile ─────────────────────────
# Using an AppleScript .app means the user sees a real app icon, not a script.
# The .saver is embedded inside Contents/Resources/ so there is only ONE item
# visible in the DMG — no confusion about which file to use.
echo "→ Building installer app…"

APPLESCRIPT_TMP="${DIST_DIR}/installer.applescript"
cat > "${APPLESCRIPT_TMP}" << 'APPLESCRIPT'
-- Living Art Screensaver Installer
-- The .saver bundle lives in this app's Contents/Resources/ folder.

set myBundle  to POSIX path of (path to me)
set saverSrc  to myBundle & "Contents/Resources/ScreensaverArt.saver"
set installDir to (POSIX path of (path to home folder)) & "Library/Screen Savers"

-- Verify the bundled .saver is present
try
    do shell script "test -d " & quoted form of saverSrc
on error
    display alert "Installation Error" message ¬
        "The screensaver bundle is missing from this installer. " & ¬
        "Please re-download the DMG." as critical
    return
end try

-- Confirm with user
set choice to button returned of (display dialog ¬
    "Install Living Art Screensaver on your Mac?" & return & return & ¬
    "This will briefly close System Settings." ¬
    buttons {"Cancel", "Install"} default button "Install" ¬
    with title "Living Art Screensaver Installer")
if choice is "Cancel" then return

-- Install the screensaver
-- Apple's legacy screensaver framework keeps the bundle mapped in memory until
-- its hosting processes are killed. We must kill them before copying, otherwise
-- the install hangs or macOS loads the stale binary on next launch.
try
    do shell script "
        killall ScreenSaverEngine    2>/dev/null || true
        killall 'System Settings'    2>/dev/null || true
        killall 'System Preferences' 2>/dev/null || true
        pkill -f legacyScreenSaver   2>/dev/null || true
        sleep 1
        mkdir -p " & quoted form of installDir & "
        rm -rf "   & quoted form of (installDir & "/ScreensaverArt.saver") & "
        cp -r "    & quoted form of saverSrc & " " & quoted form of installDir & "
        xattr -dr com.apple.quarantine " & ¬
            quoted form of (installDir & "/ScreensaverArt.saver") & " 2>/dev/null || true
    "
on error errMsg
    display alert "Installation Failed" message errMsg as critical
    return
end try

-- Success — open System Settings directly to Screen Saver
display dialog ¬
    "✓  Living Art Screensaver is installed!" & return & return & ¬
    "Select 'ScreensaverArt' in System Settings, then click Options to sign in." ¬
    buttons {"Open System Settings"} default button "Open System Settings" ¬
    with title "Installation Complete"

do shell script "
    open 'x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension' 2>/dev/null ||
    open 'x-apple.systempreferences:com.apple.preference.screensaver'          2>/dev/null ||
    open -a 'System Settings'                                                   2>/dev/null ||
    open -a 'System Preferences'                                                2>/dev/null ||
    true
"
APPLESCRIPT

APP_PATH="${STAGING}/${INSTALLER_APP}"
osacompile -o "${APP_PATH}" "${APPLESCRIPT_TMP}"
rm "${APPLESCRIPT_TMP}"

# Embed the .saver inside the installer app's Resources (single-item DMG UX)
cp -r "${SCRIPT_DIR}/build/${BUNDLE_NAME}" "${APP_PATH}/Contents/Resources/"

# ── Step 4: Generate the DMG background image ────────────────────────────────
echo "→ Generating background image…"

python3 - "${STAGING}/.background.png" "${BG_W}" "${BG_H}" "${WIN_W}" "${WIN_H}" << 'PYEOF'
import sys
from PIL import Image, ImageDraw, ImageFont

out, W, H, win_w, win_h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])

img  = Image.new("RGB", (W, H), "#080810")
draw = ImageDraw.Draw(img)

# Soft radial glow from centre
cx, cy = W // 2, H // 2
max_r  = int((W**2 + H**2)**0.5 // 2)
for r in range(max_r, 0, -10):
    t = 1 - r / max_r
    v = int(28 * t * t)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(10 + v, 10 + v, 22 + v))

def font(size):
    for path in ["/System/Library/Fonts/Helvetica.ttc",
                 "/System/Library/Fonts/SFNSText.ttf",
                 "/System/Library/Fonts/LucidaGrande.ttc"]:
        try: return ImageFont.truetype(path, size)
        except: pass
    return ImageFont.load_default()

def centred(text, y, f, color):
    bb = draw.textbbox((0, 0), text, font=f)
    x  = (W - (bb[2] - bb[0])) // 2
    draw.text((x, y), text, fill=color, font=f)

# Title near top
centred("Living Art Screensaver", 80, font(58), "#ffffff")

# Thin separator line
draw.line([(W//2 - 120, 170), (W//2 + 120, 170)], fill="#333355", width=2)

# Draw a downward arrow pointing at where the icon will sit
# Icon is at ICON_Y logical pts; in @2x px: icon_py = (win_h//2 + 20) * 2
icon_py = (win_h // 2 + 20) * 2
ax, ay = W // 2, icon_py - 200   # arrow top-centre
aw, ah = 44, 90                   # shaft half-width, total height
shaft_hw = 16                     # shaft half-width
head_hw  = aw                     # arrowhead half-width
head_h   = ah * 2 // 5            # arrowhead height
shaft_h  = ah - head_h
color    = "#4466ee"
# Shaft
draw.rectangle([ax - shaft_hw, ay, ax + shaft_hw, ay + shaft_h], fill=color)
# Arrowhead triangle
draw.polygon([ax - head_hw, ay + shaft_h,
              ax + head_hw, ay + shaft_h,
              ax,           ay + ah], fill=color)

# Instruction at bottom
centred("Double-click to install", H - 90, font(34), "#7777aa")

img.save(out)
print(f"  background: {W}x{H}px @2x → {out}")
PYEOF

# ── Step 5: Build styled read-write DMG, configure window, convert ───────────
echo "→ Creating DMG…"
rm -f "${TMP_DMG}" "${DIST_DIR}/${DMG_NAME}"

hdiutil create \
    -srcfolder "${STAGING}" \
    -volname   "${VOLUME_NAME}" \
    -fs        HFS+ \
    -fsargs    "-c c=16,a=16,b=16" \
    -format    UDRW \
    -size      60m \
    "${TMP_DMG}"

MOUNT_DIR="$(hdiutil attach "${TMP_DMG}" -readwrite -noverify -noautoopen \
    | grep '/Volumes/' | sed 's/.*\t//' | tr -d '\r')"
# The actual volume name may differ (macOS appends " 1" etc. on name collision)
MOUNTED_VOL="$(basename "${MOUNT_DIR}")"
echo "  Mounted at: ${MOUNT_DIR} (volume: ${MOUNTED_VOL})"

# Move background into hidden .background folder (Finder's convention)
mkdir -p "${MOUNT_DIR}/.background"
mv "${MOUNT_DIR}/.background.png" "${MOUNT_DIR}/.background/background.png"

# Configure the Finder window via AppleScript
sleep 1
osascript << ASEOF
tell application "Finder"
  tell disk "${MOUNTED_VOL}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {${WIN_LEFT}, ${WIN_TOP}, ${WIN_RIGHT}, ${WIN_BOTTOM}}
    set sidebar width of container window to 0
    set theViewOptions to icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to 96
    set background picture of theViewOptions to file ".background:background.png"
    set position of item "${INSTALLER_APP}" of container window to {${ICON_X}, ${ICON_Y}}
    close
    open
    update without registering applications
    delay 3
    close
  end tell
end tell
ASEOF

sync
hdiutil detach "${MOUNT_DIR}" -quiet

# Convert to compressed read-only
hdiutil convert "${TMP_DMG}" \
    -format UDZO \
    -imagekey zlib-level=9 \
    -o "${DIST_DIR}/${DMG_NAME}"

rm -f "${TMP_DMG}"
xattr -dr com.apple.quarantine "${DIST_DIR}/${DMG_NAME}" 2>/dev/null || true

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✓ DMG ready: ${DIST_DIR}/${DMG_NAME}"
echo ""
echo "  Users open the DMG and double-click 'Install Living Art' to install."
