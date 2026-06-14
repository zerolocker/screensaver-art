import Foundation

// MARK: - Cached gallery models
//
// Written by the Electron companion app at Cache.manifestFile, then read here.
// Kept intentionally minimal — anything subscription-related lives in the
// Electron app, not in the screensaver.

struct CachedItem: Decodable {
    let filename: String
    let title:    String
    let type:     String

    var isVideo: Bool { type == "video" }
}

struct CachedManifest: Decodable {
    let items:        [CachedItem]
    let isSubscribed: Bool
    let syncedAt:     String?
}
