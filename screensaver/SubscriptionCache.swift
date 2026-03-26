import Foundation

// MARK: - Subscription Cache

/// Caches subscription status locally so we don't hit the API on every screensaver activation.
/// Re-verified once per day when a network request is already in flight.
class SubscriptionCache {

    static let shared = SubscriptionCache()
    private init() {}

    private let defaults = UserDefaults.standard
    private let keyIsActive   = "sub_isActive"
    private let keyTotalCount = "sub_totalCount"
    private let keyCachedAt   = "sub_cachedAt"
    private let revalidateInterval: TimeInterval = 60 * 60 * 24  // 24 h

    var isActive:   Bool { defaults.bool(forKey: keyIsActive)      }
    var totalCount: Int  { defaults.integer(forKey: keyTotalCount)  }

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
