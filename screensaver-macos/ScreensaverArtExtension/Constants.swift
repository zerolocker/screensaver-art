import Foundation

// MARK: - Constants

/// The cache, written by the Electron app and only read here. The sandbox can
/// read /Users/Shared through an entitlement, and writing there triggers no
/// privacy prompt. MUST match `getCacheDir()` in electron-app/src/main/cache-sync.ts.
enum Cache {
    static let baseDir = URL(fileURLWithPath: "/Users/Shared/LivingArtScreensaver", isDirectory: true)

    /// Obfuscated `.bin` files.
    static let videosDir: URL = baseDir.appendingPathComponent("videos", isDirectory: true)

    /// The manifest.
    static let manifestFile: URL = baseDir.appendingPathComponent("gallery.json")
}

/// Cache obfuscation. MUST match electron-app/src/main/obfuscation.ts. It deters
/// casual copying; it isn't encryption.
enum Obfuscation {
    static let magic: [UInt8] = Array("LARTV001".utf8)
    static let key: [UInt8] = [
        0x9c, 0x4d, 0x1f, 0x7a, 0xe3, 0x55, 0xa1, 0x08,
        0x6b, 0xd2, 0x44, 0xc7, 0x18, 0xf9, 0x82, 0x37,
        0x2e, 0xa6, 0x71, 0xbb, 0x09, 0x5d, 0xe4, 0xc1,
        0x76, 0x33, 0x88, 0x4f, 0xaa, 0x12, 0xb9, 0x60,
    ]
}
