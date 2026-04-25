#!/usr/bin/env bash
# bundle-saver.sh — build the macOS .saver and copy it into the Electron
# app's resources/ folder so it can ship inside the packaged app.
#
# Run from electron-app/ before `pnpm dev` or `pnpm dist`.

set -euo pipefail

ELECTRON_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ELECTRON_DIR}/.." && pwd)"
SAVER_NAME="ScreensaverArt.saver"

if [[ "$(uname)" != "Darwin" ]]; then
    echo "→ Skipping .saver bundle on non-macOS host."
    mkdir -p "${ELECTRON_DIR}/resources"
    exit 0
fi

echo "→ Building ${SAVER_NAME}…"
bash "${REPO_ROOT}/screensaver/build.sh"

mkdir -p "${ELECTRON_DIR}/resources"
rm -rf "${ELECTRON_DIR}/resources/${SAVER_NAME}"
cp -r "${REPO_ROOT}/screensaver/build/${SAVER_NAME}" "${ELECTRON_DIR}/resources/"
echo "✓ Bundled ${SAVER_NAME} into electron-app/resources/"
