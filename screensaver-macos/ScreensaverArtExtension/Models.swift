import Foundation

// MARK: - Cached gallery models
//
// The manifest the Electron app writes at Cache.manifestFile.

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
