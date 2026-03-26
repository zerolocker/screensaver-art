import Foundation

// MARK: - Auth Manager

/// Handles Supabase email/password auth via REST. Tokens are persisted in Keychain.
class AuthManager {

    static let shared = AuthManager()
    private init() {}

    var accessToken:  String? { Keychain.load(.accessToken)  }
    var refreshToken: String? { Keychain.load(.refreshToken) }
    var email:        String? { Keychain.load(.email)        }
    var isLoggedIn:   Bool    { accessToken != nil           }

    /// Sign in — stores tokens on success; calls completion on the main thread.
    func signIn(email: String, password: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let url = URL(string: "\(API.supabaseURL)/auth/v1/token?grant_type=password")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json",  forHTTPHeaderField: "Content-Type")
        req.setValue(API.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        URLSession.shared.dataTask(with: req) { data, _, err in
            if let err { return DispatchQueue.main.async { completion(.failure(err)) } }
            guard let data,
                  let json        = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let accessToken  = json["access_token"]  as? String,
                  let refreshToken = json["refresh_token"] as? String
            else {
                let msg = (try? JSONSerialization.jsonObject(with: data ?? Data()) as? [String: Any])?["error_description"] as? String
                             ?? "Sign-in failed"
                return DispatchQueue.main.async {
                    completion(.failure(NSError(domain: "Auth", code: 0, userInfo: [NSLocalizedDescriptionKey: msg])))
                }
            }
            Keychain.save(accessToken,  for: .accessToken)
            Keychain.save(refreshToken, for: .refreshToken)
            Keychain.save(email,        for: .email)
            DispatchQueue.main.async { completion(.success(())) }
        }.resume()
    }

    /// Silently exchanges the refresh token for a new access token.
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
                  let json       = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
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
