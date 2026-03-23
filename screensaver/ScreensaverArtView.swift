import Cocoa
import Darwin
import ScreenSaver
import AVFoundation
import Security

// MARK: - Constants

private enum API {
    static let supabaseURL    = "https://fcrkikggdvgshuopshgm.supabase.co"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmtpa2dnZHZnc2h1b3BzaGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTAyNTUsImV4cCI6MjA4OTEyNjI1NX0.ia0iWugP97L0cOX4OTI20vB9C3U1_f4w84Xumjsvc7c"
    static let galleryEndpoint = "https://living-art-screensaver.com/api/gallery"
    static let subscribeURL    = "https://living-art-screensaver.com"
    static let freeItemCount   = 2  // items visible without subscription
}

// MARK: - Model

struct ArtItem: Decodable {
    let src:         String
    let title:       String
    let type:        String
    let collection:  String?

    var mediaURL: URL { URL(string: src)! }
    var isVideo:  Bool { type == "video" }
}

struct GalleryResponse: Decodable {
    let items:        [ArtItem]
    let isSubscribed: Bool
    let totalCount:   Int
}

// MARK: - Keychain helpers

private enum Keychain {
    static let service = "com.livingart.screensaver"

    enum Key: String {
        case accessToken  = "access_token"
        case refreshToken = "refresh_token"
        case email        = "email"
    }

    static func save(_ value: String, for key: Key) {
        let data = value.data(using: .utf8)!
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData] = data
        SecItemAdd(item as CFDictionary, nil)
    }

    static func load(_ key: Key) -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      key.rawValue,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let str  = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    static func delete(_ key: Key) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func clear() {
        delete(.accessToken)
        delete(.refreshToken)
        delete(.email)
    }
}

// MARK: - Auth Manager

/// Handles Supabase email/password auth via REST.  Tokens are persisted in Keychain.
class AuthManager {

    static let shared = AuthManager()
    private init() {}

    var accessToken:  String? { Keychain.load(.accessToken)  }
    var refreshToken: String? { Keychain.load(.refreshToken) }
    var email:        String? { Keychain.load(.email)        }
    var isLoggedIn:   Bool    { accessToken != nil           }

    // Sign in — stores tokens on success; calls completion on main thread
    func signIn(email: String, password: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let url = URL(string: "\(API.supabaseURL)/auth/v1/token?grant_type=password")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json",    forHTTPHeaderField: "Content-Type")
        req.setValue(API.supabaseAnonKey,   forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        URLSession.shared.dataTask(with: req) { data, resp, err in
            if let err { return DispatchQueue.main.async { completion(.failure(err)) } }
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let accessToken  = json["access_token"]  as? String,
                  let refreshToken = json["refresh_token"] as? String
            else {
                let msg = (try? JSONSerialization.jsonObject(with: data ?? Data()) as? [String: Any])?["error_description"] as? String ?? "Sign-in failed"
                return DispatchQueue.main.async { completion(.failure(NSError(domain: "Auth", code: 0, userInfo: [NSLocalizedDescriptionKey: msg]))) }
            }
            Keychain.save(accessToken,  for: .accessToken)
            Keychain.save(refreshToken, for: .refreshToken)
            Keychain.save(email,        for: .email)
            DispatchQueue.main.async { completion(.success(())) }
        }.resume()
    }

    // Silently refresh the access token using the refresh token
    func refreshAccessToken(completion: @escaping (Bool) -> Void) {
        guard let refreshToken else { return completion(false) }
        let url = URL(string: "\(API.supabaseURL)/auth/v1/token?grant_type=refresh_token")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json",  forHTTPHeaderField: "Content-Type")
        req.setValue(API.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let newAccess  = json["access_token"]  as? String,
                  let newRefresh = json["refresh_token"] as? String
            else { return completion(false) }
            Keychain.save(newAccess,  for: .accessToken)
            Keychain.save(newRefresh, for: .refreshToken)
            completion(true)
        }.resume()
    }

    func signOut() {
        Keychain.clear()
        SubscriptionCache.shared.clear()
    }
}

// MARK: - Subscription Cache

/// Caches subscription status locally so we don't hit the API on every activation.
/// Re-verified once per day when a network request is already happening.
class SubscriptionCache {

    static let shared = SubscriptionCache()
    private init() {}

    private let defaults = UserDefaults.standard
    private let keyIsActive   = "sub_isActive"
    private let keyTotalCount = "sub_totalCount"
    private let keyCachedAt   = "sub_cachedAt"
    private let revalidateInterval: TimeInterval = 60 * 60 * 24  // 24 h

    var isActive:   Bool { defaults.bool(forKey: keyIsActive)    }
    var totalCount: Int  { defaults.integer(forKey: keyTotalCount) }

    var needsRevalidation: Bool {
        guard let cachedAt = defaults.object(forKey: keyCachedAt) as? Date else { return true }
        return Date().timeIntervalSince(cachedAt) > revalidateInterval
    }

    func update(isActive: Bool, totalCount: Int) {
        defaults.set(isActive,   forKey: keyIsActive)
        defaults.set(totalCount, forKey: keyTotalCount)
        defaults.set(Date(),     forKey: keyCachedAt)
    }

    func clear() {
        defaults.removeObject(forKey: keyIsActive)
        defaults.removeObject(forKey: keyTotalCount)
        defaults.removeObject(forKey: keyCachedAt)
    }
}

// MARK: - Video Cache

/// Caches MP4 files in ~/Library/Caches/ScreensaverArt/videos/.
/// Falls back to the remote URL if the file isn't cached yet.
class VideoCache {

    static let shared = VideoCache()
    private init() { try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true) }

    private let cacheDir: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("ScreensaverArt/videos", isDirectory: true)
    }()

    private let maxCacheBytes: Int64 = 2 * 1024 * 1024 * 1024  // 2 GB

    // Stable filename: SHA256-like hash of the URL string (using simple djb2 for zero dependencies)
    private func filename(for url: URL) -> String {
        var hash: UInt64 = 5381
        for c in url.absoluteString.utf8 { hash = hash &* 127 &+ UInt64(c) }
        return String(format: "%016llx.mp4", hash)
    }

    func localURL(for remote: URL) -> URL {
        cacheDir.appendingPathComponent(filename(for: remote))
    }

    func isCached(_ remote: URL) -> Bool {
        FileManager.default.fileExists(atPath: localURL(for: remote).path)
    }

    /// Returns the best URL to play: local file if cached, remote otherwise.
    func playbackURL(for remote: URL) -> URL {
        isCached(remote) ? localURL(for: remote) : remote
    }

    /// Downloads and caches a video in the background.  No-op if already cached.
    func cacheInBackground(_ remote: URL) {
        guard !isCached(remote) else { return }
        let dest = localURL(for: remote)
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
            at: cacheDir,
            includingPropertiesForKeys: [.fileSizeKey, .contentAccessDateKey]
        ) else { return }

        let sized: [(URL, Int64, Date)] = files.compactMap { url in
            let vals = try? url.resourceValues(forKeys: [.fileSizeKey, .contentAccessDateKey])
            guard let size = vals?.fileSize, let date = vals?.contentAccessDate else { return nil }
            return (url, Int64(size), date)
        }.sorted { $0.2 < $1.2 }  // oldest-accessed first

        var total = sized.reduce(0) { $0 + $1.1 }
        for (url, size, _) in sized {
            if total <= maxCacheBytes { break }
            try? FileManager.default.removeItem(at: url)
            total -= size
        }
    }

    /// Cache the gallery playlist JSON so we can play offline
    private var galleryCacheFile: URL {
        (FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!)
            .appendingPathComponent("ScreensaverArt/gallery.json")
    }

    func saveGalleryCache(_ data: Data) {
        try? FileManager.default.createDirectory(at: galleryCacheFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: galleryCacheFile)
    }

    func loadGalleryCache() -> Data? {
        try? Data(contentsOf: galleryCacheFile)
    }
}

// MARK: - Gallery Fetcher

class GalleryFetcher {

    static let shared = GalleryFetcher()
    private init() {}

    /// Fetches the gallery from the API (with auth) or falls back to the cached copy.
    /// Completion called on main thread.
    func fetch(collection: String = "classic",
               completion: @escaping ([ArtItem], Bool, Int) -> Void) {

        let urlStr = "\(API.galleryEndpoint)?collection=\(collection)"
        guard let url = URL(string: urlStr) else { return }

        var req = URLRequest(url: url, timeoutInterval: 10)
        if let token = AuthManager.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        URLSession.shared.dataTask(with: req) { data, resp, err in

            if let data {
                VideoCache.shared.saveGalleryCache(data)   // persist for offline use

                if let response = try? JSONDecoder().decode(GalleryResponse.self, from: data) {
                    DispatchQueue.main.async {
                        SubscriptionCache.shared.update(isActive: response.isSubscribed, totalCount: response.totalCount)
                        completion(response.items, response.isSubscribed, response.totalCount)
                    }
                    return
                }
            }

            // Network failure or decode error — fall back to cache
            if let cached = VideoCache.shared.loadGalleryCache(),
               let response = try? JSONDecoder().decode(GalleryResponse.self, from: cached) {
                DispatchQueue.main.async {
                    completion(response.items, response.isSubscribed, response.totalCount)
                }
            } else {
                // Absolute fallback: empty (screensaver stays black until next try)
                DispatchQueue.main.async { completion([], false, 0) }
            }
        }.resume()
    }

    /// If the access token may have expired, refresh it first then fetch.
    func fetchWithTokenRefresh(collection: String = "classic",
                               completion: @escaping ([ArtItem], Bool, Int) -> Void) {
        guard AuthManager.shared.isLoggedIn else {
            fetch(collection: collection, completion: completion)
            return
        }
        AuthManager.shared.refreshAccessToken { success in
            self.fetch(collection: collection, completion: completion)
        }
    }
}

// MARK: - Configure Sheet

/// The "Options…" panel shown when the user clicks Options in System Settings → Screen Saver.
class ConfigureSheetController: NSObject {

    private var window: NSWindow?
    private var emailField:    NSTextField?
    private var emailLabel:    NSTextField?
    private var passwordField: NSSecureTextField?
    private var passwordLabel: NSTextField?
    private var statusLabel:   NSTextField?
    private var loginButton:   NSButton?
    private var logoutButton:  NSButton?
    private var doneButton:    NSButton?
    private var onDismiss: (() -> Void)?

    func makeWindow(onDismiss: @escaping () -> Void) -> NSWindow {
        self.onDismiss = onDismiss

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 380, height: 280),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        panel.title = "Living Art — Account"
        panel.isMovableByWindowBackground = true
        self.window = panel

        let content = panel.contentView!
        content.wantsLayer = true

        // ── Status label ──────────────────────────────────────────────────────
        let statusLbl = NSTextField(labelWithString: "")
        statusLbl.translatesAutoresizingMaskIntoConstraints = false
        statusLbl.font = NSFont.systemFont(ofSize: 12)
        statusLbl.textColor = .secondaryLabelColor
        statusLbl.alignment = .center
        statusLbl.lineBreakMode = .byWordWrapping
        statusLbl.maximumNumberOfLines = 3
        content.addSubview(statusLbl)
        statusLabel = statusLbl

        // ── Email field ───────────────────────────────────────────────────────
        let emailLbl = NSTextField(labelWithString: "Email")
        emailLbl.translatesAutoresizingMaskIntoConstraints = false
        emailLbl.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        content.addSubview(emailLbl)
        emailLabel = emailLbl

        let emailFld = NSTextField()
        emailFld.translatesAutoresizingMaskIntoConstraints = false
        emailFld.placeholderString = "you@example.com"
        emailFld.font = NSFont.systemFont(ofSize: 13)
        content.addSubview(emailFld)
        emailField = emailFld

        // ── Password field ────────────────────────────────────────────────────
        let pwLbl = NSTextField(labelWithString: "Password")
        pwLbl.translatesAutoresizingMaskIntoConstraints = false
        pwLbl.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        content.addSubview(pwLbl)
        passwordLabel = pwLbl

        let pwFld = NSSecureTextField()
        pwFld.translatesAutoresizingMaskIntoConstraints = false
        pwFld.placeholderString = "••••••••"
        pwFld.font = NSFont.systemFont(ofSize: 13)
        content.addSubview(pwFld)
        passwordField = pwFld

        // ── Login button ──────────────────────────────────────────────────────
        let loginBtn = NSButton(title: "Sign In", target: self, action: #selector(loginTapped))
        loginBtn.translatesAutoresizingMaskIntoConstraints = false
        loginBtn.bezelStyle = .rounded
        loginBtn.keyEquivalent = "\r"
        content.addSubview(loginBtn)
        loginButton = loginBtn

        // ── Logout button ─────────────────────────────────────────────────────
        let logoutBtn = NSButton(title: "Sign Out", target: self, action: #selector(logoutTapped))
        logoutBtn.translatesAutoresizingMaskIntoConstraints = false
        logoutBtn.bezelStyle = .rounded
        content.addSubview(logoutBtn)
        logoutButton = logoutBtn

        // ── Done button ───────────────────────────────────────────────────────
        let doneBtn = NSButton(title: "Done", target: self, action: #selector(doneTapped))
        doneBtn.translatesAutoresizingMaskIntoConstraints = false
        doneBtn.bezelStyle = .rounded
        content.addSubview(doneBtn)
        doneButton = doneBtn

        // ── Layout ────────────────────────────────────────────────────────────
        let pad: CGFloat = 24
        NSLayoutConstraint.activate([
            statusLbl.topAnchor.constraint(equalTo: content.topAnchor, constant: pad),
            statusLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            statusLbl.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            emailLbl.topAnchor.constraint(equalTo: statusLbl.bottomAnchor, constant: 16),
            emailLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),

            emailFld.topAnchor.constraint(equalTo: emailLbl.bottomAnchor, constant: 4),
            emailFld.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            emailFld.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            pwLbl.topAnchor.constraint(equalTo: emailFld.bottomAnchor, constant: 12),
            pwLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),

            pwFld.topAnchor.constraint(equalTo: pwLbl.bottomAnchor, constant: 4),
            pwFld.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            pwFld.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            loginBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            loginBtn.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            loginBtn.widthAnchor.constraint(equalToConstant: 100),

            logoutBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            logoutBtn.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            logoutBtn.widthAnchor.constraint(equalToConstant: 100),

            doneBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            doneBtn.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),
            doneBtn.widthAnchor.constraint(equalToConstant: 80),
        ])

        refreshUI()
        return panel
    }

    private func refreshUI() {
        let loggedIn = AuthManager.shared.isLoggedIn
        emailLabel?.isHidden    =  loggedIn
        emailField?.isHidden    =  loggedIn
        passwordLabel?.isHidden =  loggedIn
        passwordField?.isHidden =  loggedIn
        loginButton?.isHidden   =  loggedIn
        logoutButton?.isHidden  = !loggedIn

        if loggedIn {
            let email  = AuthManager.shared.email ?? "your account"
            let active = SubscriptionCache.shared.isActive
            let total  = SubscriptionCache.shared.totalCount
            if active {
                statusLabel?.stringValue = "✓ Signed in as \(email)\n✓ Subscription active — all \(total) artworks unlocked."
                statusLabel?.textColor = NSColor(calibratedRed: 0.2, green: 0.65, blue: 0.3, alpha: 1)
            } else {
                statusLabel?.stringValue = "Signed in as \(email)\nNo active subscription. Visit \(API.subscribeURL) to subscribe."
                statusLabel?.textColor = .secondaryLabelColor
            }
        } else {
            statusLabel?.stringValue = "Sign in to unlock all artworks."
            statusLabel?.textColor = .secondaryLabelColor
        }
    }

    @objc private func loginTapped() {
        guard let email = emailField?.stringValue, !email.isEmpty,
              let pw    = passwordField?.stringValue, !pw.isEmpty else {
            statusLabel?.stringValue = "Please enter your email and password."
            statusLabel?.textColor = .systemRed
            return
        }
        loginButton?.isEnabled = false
        statusLabel?.stringValue = "Signing in…"
        statusLabel?.textColor = .secondaryLabelColor

        AuthManager.shared.signIn(email: email, password: pw) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success:
                // Re-fetch gallery to update subscription cache
                GalleryFetcher.shared.fetch { [weak self] _, isSubscribed, totalCount in
                    self?.loginButton?.isEnabled = true
                    self?.passwordField?.stringValue = ""
                    self?.refreshUI()
                }
            case .failure(let err):
                self.statusLabel?.stringValue = err.localizedDescription
                self.statusLabel?.textColor = .systemRed
                self.loginButton?.isEnabled = true
            }
        }
    }

    @objc private func logoutTapped() {
        AuthManager.shared.signOut()
        refreshUI()
    }

    @objc private func doneTapped() {
        guard let w = window else { return }
        w.sheetParent?.endSheet(w)   // end the modal session — required by the screensaver framework
        w.orderOut(nil)
        onDismiss?()
    }
}

// MARK: - Upsell Overlay

/// Shown after the free items loop, prompting non-subscribers to sign up.
class UpsellOverlay: NSView {

    private var totalCount: Int = 0

    convenience init(frame: NSRect, totalCount: Int) {
        self.init(frame: frame)
        self.totalCount = totalCount
        build()
    }

    private func build() {
        wantsLayer = true
        layer?.backgroundColor = NSColor(white: 0, alpha: 0.72).cgColor

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment   = .centerX
        stack.spacing     = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let heading = NSTextField(labelWithString: "Unlock \(totalCount) Living Artworks")
        heading.font      = NSFont.systemFont(ofSize: 28, weight: .semibold)
        heading.textColor = .white
        heading.alignment = .center

        let sub = NSTextField(labelWithString:
            "You're watching the free preview.\nSubscribe for $0.99 / month to unlock the full gallery.")
        sub.font                  = NSFont.systemFont(ofSize: 15)
        sub.textColor             = NSColor(white: 0.85, alpha: 1)
        sub.alignment             = .center
        sub.maximumNumberOfLines  = 3
        sub.lineBreakMode         = .byWordWrapping

        let urlLbl = NSTextField(labelWithString: API.subscribeURL)
        urlLbl.font      = NSFont.monospacedSystemFont(ofSize: 14, weight: .regular)
        urlLbl.textColor = NSColor(calibratedRed: 0.4, green: 0.75, blue: 1.0, alpha: 1)
        urlLbl.alignment = .center

        stack.addArrangedSubview(heading)
        stack.addArrangedSubview(sub)
        stack.addArrangedSubview(urlLbl)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.75),
        ])
    }
}

// MARK: - Screensaver View

@objc(ScreensaverArtView)
class ScreensaverArtView: ScreenSaverView {

    // ── Items ───────────────────────────────────────────────────────────────
    private var items:         [ArtItem] = []
    private var shuffledOrder: [Int]     = []
    private var orderPos:      Int       = 0
    private var isSubscribed:  Bool      = false
    private var totalCount:    Int       = 0
    private var freeLoopCount: Int       = 0   // how many times we've looped through free items
    private let upsellAfterLoops = 1           // show upsell after N full loops of free content

    // ── A/B layers for crossfade ────────────────────────────────────────────
    private var slotA: CALayer?
    private var slotB: CALayer?
    private var activeSlot: CALayer?

    private var playerA: AVPlayer?
    private var playerB: AVPlayer?
    private var loopObsA: Any?
    private var loopObsB: Any?

    // ── Title pill ──────────────────────────────────────────────────────────
    private var pillContainer: NSView?
    private var titleLabel: NSTextField?

    // ── Upsell overlay ──────────────────────────────────────────────────────
    private var upsellOverlay: UpsellOverlay?
    private var upsellVisible = false

    // ── Timer ───────────────────────────────────────────────────────────────
    private var advanceTimer: Timer?
    private let displayDuration: TimeInterval = 8.0
    private let fadeDuration:    TimeInterval = 1.5

    // ── Configure sheet ─────────────────────────────────────────────────────
    private var configController = ConfigureSheetController()
    private var configWindow: NSWindow?

    // MARK: Init

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        buildUI()
        loadGallery()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        buildUI()
        loadGallery()
    }

    // MARK: Gallery Loading

    private func loadGallery() {
        // Immediately try to play from local cache (offline-first)
        if let cached = VideoCache.shared.loadGalleryCache(),
           let response = try? JSONDecoder().decode(GalleryResponse.self, from: cached) {
            applyGallery(response.items, isSubscribed: response.isSubscribed, totalCount: response.totalCount)
        }

        // Then refresh from network (respects daily revalidation cadence)
        let needsRefresh = SubscriptionCache.shared.needsRevalidation || items.isEmpty
        guard needsRefresh else { return }

        GalleryFetcher.shared.fetchWithTokenRefresh { [weak self] newItems, isSubscribed, totalCount in
            guard let self, !newItems.isEmpty else { return }
            self.applyGallery(newItems, isSubscribed: isSubscribed, totalCount: totalCount)
        }
    }

    private func applyGallery(_ newItems: [ArtItem], isSubscribed: Bool, totalCount: Int) {
        self.items        = newItems
        self.isSubscribed = isSubscribed
        self.totalCount   = totalCount
        self.shuffledOrder = Array(0..<newItems.count).shuffled()
        self.orderPos     = 0
        self.freeLoopCount = 0
        hideUpsell()
        showCurrent()
        startTimer()

        // Pre-cache the first few videos immediately for offline use
        for item in newItems.prefix(API.freeItemCount) where item.isVideo {
            VideoCache.shared.cacheInBackground(item.mediaURL)
        }
    }

    // MARK: UI

    private func buildUI() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor

        let a = CALayer()
        a.frame = bounds; a.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        a.backgroundColor = NSColor.black.cgColor; a.opacity = 0
        layer?.addSublayer(a); slotA = a

        let b = CALayer()
        b.frame = bounds; b.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        b.backgroundColor = NSColor.black.cgColor; b.opacity = 0
        layer?.addSublayer(b); slotB = b

        // Title pill
        let fontSize:  CGFloat = isPreview ? 7  : 12
        let radius:    CGFloat = isPreview ? 10 : 24
        let pad:       CGFloat = isPreview ? 6  : 20
        let minHeight: CGFloat = isPreview ? 20 : 40
        let hInset:    CGFloat = isPreview ? 12 : 20
        let vInset:    CGFloat = isPreview ? 6  : 12

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.wantsLayer = true
        container.layer?.cornerRadius = radius
        container.layer?.masksToBounds = true
        if let scale = NSScreen.main?.backingScaleFactor { container.layer?.contentsScale = scale }
        container.layer?.shadowColor   = NSColor.black.cgColor
        container.layer?.shadowOpacity = 0.35
        container.layer?.shadowOffset  = CGSize(width: 0, height: -2)
        container.layer?.shadowRadius  = 12
        container.layer?.masksToBounds = false
        addSubview(container)
        pillContainer = container

        let blur = NSVisualEffectView()
        blur.translatesAutoresizingMaskIntoConstraints = false
        blur.material     = .hudWindow
        blur.blendingMode = .withinWindow
        blur.state        = .active
        blur.alphaValue   = 0.65
        blur.wantsLayer   = true
        blur.layer?.cornerRadius  = radius
        blur.layer?.masksToBounds = true
        container.addSubview(blur, positioned: .below, relativeTo: nil)

        let lbl = NSTextField(labelWithString: "")
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.textColor       = .white
        lbl.font            = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        lbl.alignment       = .center
        lbl.isBezeled       = false
        lbl.isEditable      = false
        lbl.drawsBackground = false
        lbl.backgroundColor = .clear
        lbl.wantsLayer      = true
        container.addSubview(lbl)
        titleLabel = lbl

        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: centerXAnchor),
            container.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -pad),
            container.widthAnchor.constraint(equalTo: lbl.widthAnchor, constant: 2 * hInset),
            container.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.85),
            container.heightAnchor.constraint(equalTo: lbl.heightAnchor, constant: 2 * vInset),
            container.heightAnchor.constraint(greaterThanOrEqualToConstant: minHeight),
            blur.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            blur.topAnchor.constraint(equalTo: container.topAnchor),
            blur.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            lbl.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: hInset),
            lbl.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -hInset),
            lbl.topAnchor.constraint(equalTo: container.topAnchor, constant: vInset),
            lbl.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -vInset),
        ])
    }

    // MARK: Playback

    private func showCurrent() {
        guard !items.isEmpty else { return }
        show(items[shuffledOrder[orderPos]])
    }

    private func show(_ item: ArtItem) {
        let incoming: CALayer = (activeSlot === slotA) ? slotB! : slotA!
        let outgoing: CALayer? = activeSlot

        if let out = outgoing { layer?.insertSublayer(incoming, above: out) }
        clearSlot(incoming)

        let playbackURL = item.isVideo ? VideoCache.shared.playbackURL(for: item.mediaURL) : item.mediaURL

        if item.isVideo {
            fillVideo(slot: incoming, url: playbackURL, isA: incoming === slotA)
            // Cache the remote version in the background if we're playing from remote
            if playbackURL == item.mediaURL { VideoCache.shared.cacheInBackground(item.mediaURL) }
        } else {
            fillImage(slot: incoming, url: playbackURL)
        }

        CATransaction.begin()
        CATransaction.setAnimationDuration(fadeDuration)
        incoming.opacity = 1
        outgoing?.opacity = 0
        CATransaction.commit()

        activeSlot = incoming

        let padded = "  \(item.title)  "
        guard let lbl = titleLabel else { return }
        let fontSize: CGFloat = isPreview ? 7 : 12
        let font = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        let ps = NSMutableParagraphStyle()
        ps.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font, .foregroundColor: NSColor.white,
            .kern: isPreview ? 0 : 1.2, .paragraphStyle: ps,
        ]
        lbl.attributedStringValue = NSAttributedString(string: padded, attributes: attrs)
    }

    private func advance() {
        guard !items.isEmpty else { return }
        let nextPos = (orderPos + 1) % shuffledOrder.count

        // When a non-subscriber loops back to start, count it
        if !isSubscribed && nextPos == 0 {
            freeLoopCount += 1
            if freeLoopCount >= upsellAfterLoops {
                showUpsell()
                return
            }
        }

        orderPos = nextPos
        showCurrent()
    }

    // MARK: Upsell

    private func showUpsell() {
        guard !upsellVisible, !isPreview else { return }
        upsellVisible = true
        advanceTimer?.invalidate()

        let tc = totalCount > 0 ? totalCount : 123
        let overlay = UpsellOverlay(frame: bounds, totalCount: tc)
        overlay.autoresizingMask = [.width, .height]
        overlay.alphaValue = 0
        addSubview(overlay)
        upsellOverlay = overlay

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 1.0
            overlay.animator().alphaValue = 1
        }

        // Auto-dismiss after 30 s and restart the loop
        Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
            self?.hideUpsell()
            self?.freeLoopCount = 0
            self?.startTimer()
        }
    }

    private func hideUpsell() {
        upsellVisible = false
        upsellOverlay?.removeFromSuperview()
        upsellOverlay = nil
    }

    // MARK: Slot management

    private func clearSlot(_ slot: CALayer) {
        slot.sublayers?.forEach { $0.removeFromSuperlayer() }
        slot.contents = nil
        if slot === slotA {
            playerA?.pause(); playerA = nil
            if let obs = loopObsA { NotificationCenter.default.removeObserver(obs) }
            loopObsA = nil
        } else {
            playerB?.pause(); playerB = nil
            if let obs = loopObsB { NotificationCenter.default.removeObserver(obs) }
            loopObsB = nil
        }
    }

    private func fillVideo(slot: CALayer, url: URL, isA: Bool) {
        let player = AVPlayer(url: url)
        player.isMuted = true

        let pLayer = AVPlayerLayer(player: player)
        pLayer.frame            = slot.bounds
        pLayer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        pLayer.videoGravity     = .resizeAspectFill
        pLayer.backgroundColor  = NSColor.black.cgColor
        slot.addSublayer(pLayer)
        player.play()

        let obs = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object:  player.currentItem,
            queue:   .main
        ) { _ in player.seek(to: .zero); player.play() }

        if isA { playerA = player; loopObsA = obs }
        else   { playerB = player; loopObsB = obs }
    }

    private func fillImage(slot: CALayer, url: URL) {
        URLSession.shared.dataTask(with: url) { [weak slot] data, _, _ in
            guard let data, let img = NSImage(data: data) else { return }
            DispatchQueue.main.async {
                slot?.contentsGravity = .resizeAspectFill
                slot?.contents        = img
            }
        }.resume()
    }

    // MARK: Timer

    private func startTimer() {
        advanceTimer?.invalidate()
        advanceTimer = Timer.scheduledTimer(withTimeInterval: displayDuration,
                                             repeats: true) { [weak self] _ in
            self?.advance()
        }
    }

    // MARK: ScreenSaverView lifecycle

    override func animateOneFrame() { }

    override func startAnimation() {
        super.startAnimation()
        if items.isEmpty {
            loadGallery()
        } else if SubscriptionCache.shared.needsRevalidation {
            GalleryFetcher.shared.fetchWithTokenRefresh { [weak self] newItems, isSubscribed, totalCount in
                guard let self, !newItems.isEmpty else { return }
                self.applyGallery(newItems, isSubscribed: isSubscribed, totalCount: totalCount)
            }
        } else {
            startTimer()
        }
    }

    override func stopAnimation() {
        super.stopAnimation()
        advanceTimer?.invalidate(); advanceTimer = nil
        playerA?.pause()
        playerB?.pause()
    }

    // MARK: Configure sheet

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        if configWindow == nil {
            configWindow = configController.makeWindow { [weak self] in
                // After sheet dismissal, reload gallery in case subscription changed
                self?.loadGallery()
            }
        }
        return configWindow
    }
}
