#!/usr/bin/env bash
# release.sh — cut a new public release of the Living Art Screensaver Mac app.
#
# This is the one command behind "release a new version". It:
#   1. bumps electron-app/package.json (patch/minor/major or an explicit X.Y.Z)
#   2. builds a SIGNED + NOTARIZED universal DMG  (pnpm dist:mac:release)
#   3. commits the bump, tags vX.Y.Z, pushes
#   4. publishes a GitHub Release with the DMG attached as a stable-named asset
#
# The website's "Download for Mac" button (→ /download/mac) resolves "latest"
# from GitHub Releases at request time, so the new build goes live within ~2 min
# of the release publishing — NO website redeploy needed per release.
#
# Prerequisites (one-time):
#   - electron-app/release.env present (Developer ID + notary creds — see
#     electron-app/release.env.example). Required for the signed build.
#   - gh CLI authenticated with repo scope (gh auth status).
#   - Xcode + xcodegen installed (the build bundles the .appex + helper).
#
# Usage:
#   ./scripts/release.sh             # bump patch  (1.0.0 → 1.0.1)
#   ./scripts/release.sh minor       # 1.0.0 → 1.1.0
#   ./scripts/release.sh major       # 1.0.0 → 2.0.0
#   ./scripts/release.sh 1.4.2       # set an explicit version
#
# Env toggles:
#   DRY_RUN=1     build only — bump + build, but do NOT commit/tag/push/publish
#   SKIP_BUILD=1  reuse the already-built DMG in electron-app/dist (re-publish)
#   ALLOW_BRANCH=1  allow releasing from a branch other than master

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ELECTRON_DIR="$REPO_ROOT/electron-app"
PKG="$ELECTRON_DIR/package.json"
GH_REPO="zerolocker/screensaver-art"
STABLE_ASSET="Living-Art-Screensaver-mac.dmg"

BUMP="${1:-patch}"

say()  { printf '\n\033[1;36m→ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v gh >/dev/null   || die "gh CLI not found."
# --active so a stale/invalid *other* account doesn't fail the gate (gh auth
# status without it exits non-zero if ANY configured account has a bad token).
gh auth status --active >/dev/null 2>&1 || die "gh active account not authenticated (run: gh auth login / gh auth switch)."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "master" ] && [ "${ALLOW_BRANCH:-0}" != "1" ]; then
  die "On branch '$BRANCH', not master. Use ALLOW_BRANCH=1 to override."
fi

if [ "${DRY_RUN:-0}" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  die "Working tree is dirty. Commit or stash first (the release commits a version bump)."
fi

if [ "${SKIP_BUILD:-0}" != "1" ] && [ ! -f "$ELECTRON_DIR/release.env" ]; then
  die "electron-app/release.env missing — needed for the signed+notarized build. See release.env.example."
fi

# ── Compute the new version ──────────────────────────────────────────────────
NEW_VERSION="$(node -e '
  const fs = require("fs");
  const pkgPath = process.argv[1];
  const arg = process.argv[2];
  const cur = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
  let next;
  if (/^\d+\.\d+\.\d+$/.test(arg)) {
    next = arg;
  } else {
    const [a, b, c] = cur.split(".").map(Number);
    if (arg === "major") next = `${a + 1}.0.0`;
    else if (arg === "minor") next = `${a}.${b + 1}.0`;
    else if (arg === "patch") next = `${a}.${b}.${c + 1}`;
    else { console.error(`Bad bump arg: ${arg}`); process.exit(1); }
  }
  process.stdout.write(next);
' "$PKG" "$BUMP")" || die "Could not compute new version."

TAG="v$NEW_VERSION"
say "Releasing $TAG  (from branch $BRANCH)"

# Refuse to clobber an existing tag/release.
if git rev-parse "$TAG" >/dev/null 2>&1; then die "Tag $TAG already exists locally."; fi
if gh release view "$TAG" --repo "$GH_REPO" >/dev/null 2>&1; then die "Release $TAG already exists on GitHub."; fi

# ── Bump version ─────────────────────────────────────────────────────────────
say "Bumping $PKG → $NEW_VERSION"
node -e '
  const fs = require("fs");
  const [pkgPath, v] = process.argv.slice(1);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.version = v;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
' "$PKG" "$NEW_VERSION"

# ── Build the signed + notarized DMG ─────────────────────────────────────────
DMG="$ELECTRON_DIR/dist/Living Art Screensaver-$NEW_VERSION.dmg"
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  say "SKIP_BUILD=1 — reusing existing DMG"
  [ -f "$DMG" ] || die "Expected DMG not found: $DMG"
else
  say "Building signed + notarized DMG (this takes several minutes, incl. notarization)…"
  ( cd "$ELECTRON_DIR" && pnpm dist:mac:release )
  [ -f "$DMG" ] || die "Build finished but DMG not found: $DMG"
fi

# Stable, version-less asset name so the release always carries the same filename.
STABLE_PATH="$ELECTRON_DIR/dist/$STABLE_ASSET"
cp "$DMG" "$STABLE_PATH"
say "DMG ready: $STABLE_PATH ($(du -h "$STABLE_PATH" | cut -f1))"

if [ "${DRY_RUN:-0}" = "1" ]; then
  say "DRY_RUN=1 — built only. Version bump left UNCOMMITTED in the working tree."
  say "Nothing pushed or published. Inspect, then re-run without DRY_RUN to release."
  exit 0
fi

# ── Commit (if the version changed), tag, push ───────────────────────────────
say "Tagging $TAG, pushing"
git add "$PKG"
if git diff --cached --quiet; then
  # Version unchanged (e.g. releasing the current version as-is) — tag HEAD.
  say "Version already $NEW_VERSION — tagging current commit, no bump commit"
else
  git commit -m "release: $TAG"
fi
git tag -a "$TAG" -m "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"

# ── Publish GitHub Release ───────────────────────────────────────────────────
say "Publishing GitHub Release $TAG with $STABLE_ASSET"
gh release create "$TAG" \
  --repo "$GH_REPO" \
  --title "$TAG" \
  --generate-notes \
  --latest \
  "$STABLE_PATH#Living Art Screensaver (macOS, universal)"

say "Done. $TAG is live."
cat <<EOF

  Download link (resolves to this release within ~2 min):
    https://living-art-screensaver.com/download/mac

  Release page:
    https://github.com/$GH_REPO/releases/tag/$TAG

  Verify the redirect once the release-lookup cache refreshes:
    curl -sIL https://living-art-screensaver.com/download/mac | grep -i location

EOF
