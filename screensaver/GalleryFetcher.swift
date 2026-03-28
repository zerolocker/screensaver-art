import Foundation

// MARK: - Gallery Fetcher

/// Fetches gallery items from the server-side gating endpoint.
/// Falls back to the last cached copy when the network is unavailable.
class GalleryFetcher {

    static let shared = GalleryFetcher()
    private init() {}

    /// Fetch the gallery, optionally filtering by collection.
    /// Completion is called on the main thread.
    func fetch(collection: String = "classic",
               completion: @escaping (_ items: [ArtItem], _ isSubscribed: Bool, _ totalCount: Int) -> Void) {

        guard let url = URL(string: "\(API.galleryEndpoint)?collection=\(collection)") else { return }

        var req = URLRequest(url: url, timeoutInterval: 10)
        if let token = AuthManager.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        URLSession.shared.dataTask(with: req) { data, _, _ in
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

            // Network or decode failure — fall back to cache
            if let cached   = VideoCache.shared.loadGalleryCache(),
               let response = try? JSONDecoder().decode(GalleryResponse.self, from: cached) {
                DispatchQueue.main.async { completion(response.items, response.isSubscribed, response.totalCount) }
            } else {
                DispatchQueue.main.async { completion([], false, 0) }
            }
        }.resume()
    }

    /// Refreshes the access token if logged in, then fetches the gallery.
    func fetchWithTokenRefresh(collection: String = "classic",
                               completion: @escaping (_ items: [ArtItem], _ isSubscribed: Bool, _ totalCount: Int) -> Void) {
        guard AuthManager.shared.isLoggedIn else {
            fetch(collection: collection, completion: completion)
            return
        }
        AuthManager.shared.refreshAccessToken { _ in
            self.fetch(collection: collection, completion: completion)
        }
    }
}
