// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "lart-screensaver-helper",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/AerialScreensaver/PaperSaver.git", exact: "0.2.1"),
    ],
    targets: [
        .executableTarget(
            name: "lart-screensaver-helper",
            dependencies: [
                .product(name: "PaperSaverKit", package: "PaperSaver"),
            ]
        ),
    ]
)
