import Foundation

// MARK: - Video Cache

/// File-based MP4 cache in ~/Library/Caches/ScreensaverArt/videos/.
/// Plays from local disk when available; downloads and caches in the background otherwise.
/// LRU eviction keeps usage under a 2 GB cap.
class VideoCache {

    static let shared = VideoCache()
    private init() {
        try? FileManager.default.createDirectory(at: videoCacheDir, withIntermediateDirectories: true)
    }

    // MARK: Paths

    private let videoCacheDir: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return caches.appendingPathComponent("ScreensaverArt/videos", isDirectory: true)
    }()

    private var galleryCacheFile: URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return caches.appendingPathComponent("ScreensaverArt/gallery.json")
    }

    // MARK: Video caching

    private let maxCacheBytes: Int64 = 2 * 1024 * 1024 * 1024  // 2 GB

    /// Stable filename derived from the URL (djb2 hash — no dependencies).
    private func filename(for url: URL) -> String {
        var hash: UInt64 = 5381
        for byte in url.absoluteString.utf8 { hash = hash &* 127 &+ UInt64(byte) }
        return String(format: "%016llx.mp4", hash)
    }

    func localURL(for remote: URL) -> URL {
        videoCacheDir.appendingPathComponent(filename(for: remote))
    }

    func isCached(_ remote: URL) -> Bool {
        FileManager.default.fileExists(atPath: localURL(for: remote).path)
    }

    /// Returns the local file URL if cached, otherwise the original remote URL.
    func playbackURL(for remote: URL) -> URL {
        isCached(remote) ? localURL(for: remote) : remote
    }

    /// Downloads and caches a video in the background. No-op if already cached.
    func cacheInBackground(_ remote: URL) {
        guard !isCached(remote) else { return }
        let dest    = localURL(for: remote)
        let tmpDest = dest.appendingPathExtension("tmp")
        URLSession.shared.downloadTask(with: remote) { [weak self] tmpURL, _, _ in
            guard let self, let tmpURL else { return }
            try? FileManager.default.moveItem(at: tmpURL, to: tmpDest)
            try? FileManager.default.moveItem(at: tmpDest, to: dest)
            self.evictIfNeeded()
        }.resume()
    }

    private func evictIfNeeded() {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: videoCacheDir,
            includingPropertiesForKeys: [.fileSizeKey, .contentAccessDateKey]
        ) else { return }

        let sorted: [(url: URL, size: Int64, accessed: Date)] = files.compactMap { url in
            let vals = try? url.resourceValues(forKeys: [.fileSizeKey, .contentAccessDateKey])
            guard let size = vals?.fileSize, let date = vals?.contentAccessDate else { return nil }
            return (url, Int64(size), date)
        }.sorted { $0.accessed < $1.accessed }  // oldest-accessed first

        var total = sorted.reduce(0) { $0 + $1.size }
        for entry in sorted {
            let (url, size) = (entry.url, entry.size)
            if total <= maxCacheBytes { break }
            try? FileManager.default.removeItem(at: url)
            total -= size
        }

    }

    // MARK: Gallery JSON caching (offline fallback)

    func saveGalleryCache(_ data: Data) {
        try? FileManager.default.createDirectory(
            at: galleryCacheFile.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: galleryCacheFile)
    }

    func loadGalleryCache() -> Data? {
        try? Data(contentsOf: galleryCacheFile)
    }
}
