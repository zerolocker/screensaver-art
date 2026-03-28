import Foundation

// MARK: - Data Models

struct ArtItem: Decodable {
    let src:        String
    let title:      String
    let type:       String
    let collection: String?

    var mediaURL: URL { URL(string: src)! }
    var isVideo:  Bool { type == "video" }
}

struct GalleryResponse: Decodable {
    let items:        [ArtItem]
    let isSubscribed: Bool
    let totalCount:   Int
}
