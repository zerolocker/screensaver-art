import SwiftUI

// A host app for local builds only, never shipped. macOS loads an .appex only
// from inside an app; in production that's the Electron app.

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
