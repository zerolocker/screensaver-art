#!/usr/bin/env bash
# dist-mac-release.sh — build a SIGNED + NOTARIZED mac DMG for public distribution.
#
# Reads your developer-specific signing/notary settings from `release.env` (a
# gitignored file next to package.json — copy release.env.example to create it),
# then runs the normal `pnpm dist:mac`. The env vars drive electron-builder.cjs
# + the signing hooks (see CLAUDE.md → "Code signing & notarization").
#
# Nothing secret lives in release.env: LART_CODESIGN_IDENTITY (cert name + Team
# ID) is embedded in every shipped app, and APPLE_KEYCHAIN_PROFILE is just a
# local Keychain label — the real Apple credentials stay in the Keychain. It's
# gitignored only because it's developer-specific, not because it's sensitive.
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
