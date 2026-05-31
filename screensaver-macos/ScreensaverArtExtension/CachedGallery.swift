import Foundation

// MARK: - Cached gallery reader
//
// Reads the manifest written by the Electron companion app and turns each
// obfuscated `.bin` file into a playable temp `.mp4` URL on demand.
//
// Lifetime model: each call to `playableURL(for:)` writes a fresh decrypted
// file under NSTemporaryDirectory() (inside this extension's own sandbox
// container — always writable). Pair every call with `releasePlayable(_:)`
// once the player is done with it so we don't leak temp files. macOS will
// also reap NSTemporaryDirectory() on its own, so the leak is bounded even
// if we miss one.

final class CachedGallery {

    static let shared = CachedGallery()
    private init() {}

    /// Loads the manifest. Returns nil if the Electron app hasn't synced
    /// anything yet, or if the manifest is corrupt.
    func loadManifest() -> CachedManifest? {
        guard let data = try? Data(contentsOf: Cache.manifestFile),
              let manifest = try? JSONDecoder().decode(CachedManifest.self, from: data) else {
            return nil
        }
        return manifest
    }

    /// Decrypts an item's `.bin` file to a temp `.mp4` and returns its URL.
    /// Returns nil if the file is missing, the magic header doesn't match,
    /// or the temp write fails.
    func playableURL(for item: CachedItem) -> URL? {
        let src = Cache.videosDir.appendingPathComponent(item.filename)
        guard let blob = try? Data(contentsOf: src) else { return nil }

        let magic = Obfuscation.magic
        guard blob.count >= magic.count,
              Array(blob.prefix(magic.count)) == magic else { return nil }

        let key = Obfuscation.key
        let plainCount = blob.count - magic.count
        var plain = Data(count: plainCount)
        plain.withUnsafeMutableBytes { (dst: UnsafeMutableRawBufferPointer) in
            blob.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
                let srcBase = src.baseAddress!.advanced(by: magic.count)
                    .assumingMemoryBound(to: UInt8.self)
                let dstBase = dst.baseAddress!.assumingMemoryBound(to: UInt8.self)
                for i in 0..<plainCount {
                    dstBase[i] = srcBase[i] ^ key[i % key.count]
                }
            }
        }

        let tmpDir = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
            .appendingPathComponent("ScreensaverArt", isDirectory: true)
        try? FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        let dest = tmpDir.appendingPathComponent("\(UUID().uuidString)-\(item.filename).mp4")
        do {
            try plain.write(to: dest, options: .atomic)
            return dest
        } catch {
            return nil
        }
    }

    /// Deletes a temp file produced by `playableURL(for:)`.
    func releasePlayable(_ url: URL?) {
        guard let url, url.path.hasPrefix(NSTemporaryDirectory()) else { return }
        try? FileManager.default.removeItem(at: url)
    }
}
