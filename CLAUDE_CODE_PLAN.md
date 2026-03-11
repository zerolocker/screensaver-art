# Claude Code Plan — macOS Screensaver Wrapper

## Goal
Convert the existing web-based art screensaver (`index.html` + `https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/`) into a
native macOS `.saver` bundle that System Settings can use as a screensaver.
The HTML/JS/CSS web app is preserved exactly as-is.

## Architecture

```
screensaver-art/
├── index.html                   ← web app (loads playlist from gallery.json)
├── gallery.json                 ← single source of truth for all art items
├── https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/                     ← media assets (MP4 + PNG)
├── screensaver/
│   ├── ScreensaverArtView.swift ← native Swift screensaver
│   ├── Info.plist               ← bundle metadata
│   └── build.sh                 ← compile + install script
├── CLAUDE.md                    ← project quick-reference
└── CLAUDE_CODE_PLAN.md          ← this file
```

## Playlist: gallery.json (single source of truth)

All art items live in `gallery.json`. Both `index.html` (via `fetch()`) and the
Swift screensaver (via `URLSession` + `JSONDecoder`) read from this file.

**To add new art:** add an entry to `gallery.json` and push to GitHub. No rebuild needed.

```json
[
  { "src": "https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/xxx_animated.mp4", "title": "Title - Collection (AI Animated)", "type": "video" },
  ...
]
```

## Screensaver: ScreensaverArtView.swift

Uses **AVFoundation** (not WKWebView) to play video:
- WKWebView's sandboxed WebContent process cannot render `<video>` in ScreenSaverEngine
- AVPlayer has full hardware decoding access and streams HTTPS URLs natively

On startup:
1. Fetch `gallery.json` from GitHub Pages via URLSession
2. Decode with JSONDecoder into `[ArtItem]`
3. Shuffle the playlist
4. Stream videos via AVPlayer + AVPlayerLayer
5. Crossfade every 8 seconds using A/B CALayer swap

## Build method

No Xcode project. Pure `swiftc`:

```bash
swiftc ScreensaverArtView.swift \
  -parse-as-library \
  -module-name ScreensaverArt \
  -Xlinker -bundle \
  -Xlinker -undefined -Xlinker dynamic_lookup \
  -framework Cocoa -framework ScreenSaver -framework AVFoundation \
  -o ~/Library/Screen\ Savers/ScreensaverArt.saver/Contents/MacOS/ScreensaverArt
```

`build.sh --install`:
1. Kills ScreenSaverEngine + System Settings first (cache invalidation)
2. Compiles directly into `~/Library/Screen Savers/` (no copy step)
3. Strips quarantine flag with `xattr -dr`

## Key learnings

| Problem | Root cause | Fix |
|---|---|---|
| `index.html` not found | `NSHomeDirectory()` returns sandbox container path | Use `getpwuid()` to get real home dir |
| Videos black | WKWebView WebContent sandbox can't render video | Switch to native AVPlayer |
| Old code persists after reinstall | ScreenSaverEngine caches bundle in memory | Kill processes before writing files; compile directly to install dir |

## Progress

- [x] Swift screensaver shell with WKWebView (initial approach)
- [x] Fixed home directory detection (sandbox → getpwuid)
- [x] Switched to AVPlayer (WKWebView video broken in screensaver sandbox)
- [x] Fixed build.sh to kill-first, build-in-place, strip quarantine
- [x] Extracted playlist into `gallery.json`
- [x] `index.html` fetches `gallery.json` via fetch()
- [x] Swift fetches `gallery.json` via URLSession + JSONDecoder (no HTML parsing)
