#!/usr/bin/env bash
# Build a signed, notarized DMG: load release.env (copy release.env.example)
# and run `pnpm dist:mac`.
#
#   pnpm dist:mac:release

set -euo pipefail

ELECTRON_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ELECTRON_DIR"

if [ -f release.env ]; then
  echo "→ Loading signing settings from release.env"
  set -a
  # shellcheck disable=SC1091
  . ./release.env
  set +a
fi

: "${LART_CODESIGN_IDENTITY:?Set LART_CODESIGN_IDENTITY (copy release.env.example → release.env). See CLAUDE.md → Code signing & notarization.}"
: "${APPLE_KEYCHAIN_PROFILE:?Set APPLE_KEYCHAIN_PROFILE (or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID) so the build can notarize.}"

echo "→ Signing as: ${LART_CODESIGN_IDENTITY}"
echo "→ Notarizing via keychain profile: ${APPLE_KEYCHAIN_PROFILE}"
exec pnpm dist:mac
