import Foundation

// MARK: - Constants

/// Cache layout — populated and managed entirely by the Electron companion app.
/// The screensaver only reads.
///
/// `.cachesDirectory` here resolves to the legacyScreenSaver sandbox container
/// (e.g. `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/
/// Data/Library/Caches/ScreensaverArt/`), NOT `~/Library/Caches/`. The Electron
/// app writes into that same container path — see `macSandboxCacheDir` in
/// electron-app/src/main/cache-sync.ts.
enum Cache {
    static let baseDir: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return caches.appendingPathComponent("ScreensaverArt", isDirectory: true)
    }()

    /// `<baseDir>/videos/` — `.bin` files, XOR-obfuscated.
    static let videosDir: URL = baseDir.appendingPathComponent("videos", isDirectory: true)

    /// `<baseDir>/gallery.json` — manifest written by Electron.
    static let manifestFile: URL = baseDir.appendingPathComponent("gallery.json")
}

/// Cache-file obfuscation. Mirrors electron-app/src/main/obfuscation.ts —
/// if you change either, change both. Not real cryptography; the goal is to
/// make the `.bin` files in the cache directory inert without our reader,
/// to deter casual extraction for a $0.99 product.
enum Obfuscation {
    static let magic: [UInt8] = Array("LARTV001".utf8)
    static let key: [UInt8] = [
        0x9c, 0x4d, 0x1f, 0x7a, 0xe3, 0x55, 0xa1, 0x08,
        0x6b, 0xd2, 0x44, 0xc7, 0x18, 0xf9, 0x82, 0x37,
        0x2e, 0xa6, 0x71, 0xbb, 0x09, 0x5d, 0xe4, 0xc1,
        0x76, 0x33, 0x88, 0x4f, 0xaa, 0x12, 0xb9, 0x60,
    ]
}
