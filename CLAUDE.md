# Screensaver Art — Project Reference

## What this project is
A collection of AI-generated animated artworks displayed as a looping screensaver.
- **Web app**: `index.html` (standalone, no build step) — visit directly in browser
- **macOS screensaver**: `screensaver/` — native Swift wrapper using AVPlayer, streams from GitHub Pages

## Key paths
| Path | Purpose |
|---|---|
| `index.html` | The entire web app (HTML+CSS+JS) |
| `gallery.json` | Playlist — the single source of truth for all art items |
| `gallery/` | 506 MB of art assets (.mp4 animated, .png static) |
| `screensaver/ScreensaverArtView.swift` | Native Swift screensaver source |
| `screensaver/Info.plist` | Bundle metadata (CFBundleIdentifier, NSPrincipalClass) |
| `screensaver/build.sh` | Build + install script |

## Build & install the screensaver
```bash
cd screensaver-art/screensaver
bash build.sh --install
# kills cached processes, compiles, installs to ~/Library/Screen Savers/ScreensaverArt.saver
```

## Rebuild after changing Swift code
```bash
bash screensaver/build.sh --install
```

## Add new art pieces
1. Add the file to `gallery/`
2. Add an entry to `gallery.json` — this is the only file you need to edit
3. `index.html` and the screensaver both read from `gallery.json` automatically

## How the screensaver gets its playlist
`ScreensaverArtView.swift` fetches `gallery.json` from GitHub Pages at startup:
```
https://tempzero-clawd.github.io/screensaver-art/gallery.json
```
No rebuild needed when adding new art — push to GitHub and the screensaver picks it up on next launch.

## Screensaver architecture
- AVPlayer streams videos directly from GitHub Pages (no local file access needed)
- A/B CALayer crossfade every 8 seconds with shuffled playback
- Title pill overlay matches the web app style
