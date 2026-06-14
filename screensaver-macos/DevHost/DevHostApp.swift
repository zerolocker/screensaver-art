import SwiftUI

// Minimal host app — a BUILD/TEST SCAFFOLD ONLY, never shipped to users.
//
// macOS only loads an .appex screensaver that's embedded inside an application
// bundle. In production the real host is the Electron app (the .appex is
// embedded into its Contents/PlugIns and registered via pluginkit). This tiny
// SwiftUI app lets us build, sign, embed, and register the extension locally
// from Xcode/xcodebuild while iterating on the Swift player code.

@main
struct DevHostApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 16) {
                Image(systemName: "tv")
                    .font(.system(size: 48))
                    .foregroundColor(.accentColor)
                Text("Living Art Screensaver — Dev Host")
                    .font(.title2).fontWeight(.semibold)
                Text("Build/test scaffold for ScreensaverArtExtension.appex.\nThe real host is the Electron app.")
                    .font(.callout)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                Button("Open Screen Saver Settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension") {
                        NSWorkspace.shared.open(url)
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(40)
            .frame(width: 420)
        }
    }
}
