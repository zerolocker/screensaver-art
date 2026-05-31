import Foundation
import PaperSaverKit

// Tiny CLI the Electron app shells out to for the two things that can only be
// done from Swift: detecting whether our screensaver is the active one, and
// setting it (one-click "Set"). Both go through PaperSaver, which performs the
// reverse-engineered macOS wallpaper-store surgery for us.
//
//   lart-screensaver-helper status [module]     -> prints {"active":true|false}
//   lart-screensaver-helper activate [module]    -> sets it everywhere; exit 0 on success
//
// `module` is the extension's bundle name (ScreensaverArtExtension.appex),
// matching how Aerial/AppexSaverMinimal name theirs, and defaults to ours.
// The Electron app always calls the no-argument form; the optional override
// exists for testing/restoring other screensavers.

@main
struct Helper {
    static let defaultModule = "ScreensaverArtExtension"

    @MainActor
    static func main() async {
        let paperSaver = PaperSaver()
        let args = CommandLine.arguments
        let cmd = args.count > 1 ? args[1] : ""
        let module = args.count > 2 ? args[2] : defaultModule

        switch cmd {
        case "status":
            print("{\"active\":\(isActive(paperSaver, module: module))}")

        case "activate":
            do {
                try await paperSaver.setScreensaverEverywhere(module: module)
                print("{\"active\":true}")
            } catch {
                fail("activate failed: \(error.localizedDescription)", code: 1)
            }

        default:
            fail("usage: lart-screensaver-helper [status|activate] [module]", code: 2)
        }
    }

    @MainActor
    static func isActive(_ paperSaver: PaperSaver, module: String) -> Bool {
        guard let info = paperSaver.getActiveScreensaver(for: nil) else { return false }
        return info.identifier == module || info.name == module
    }

    static func fail(_ message: String, code: Int32) -> Never {
        FileHandle.standardError.write(Data((message + "\n").utf8))
        exit(code)
    }
}
