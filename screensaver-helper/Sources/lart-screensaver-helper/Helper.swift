import Foundation
import PaperSaverKit

// Tiny CLI the Electron app shells out to for everything that can only be done
// from Swift: detecting/setting the active screensaver, and registering /
// unregistering / discovering our screensaver .appex. All of it goes through
// PaperSaver (PaperSaverKit) — `PaperSaver` for the active-screensaver
// read/write, and `PluginkitManager` for the pluginkit surgery + output
// parsing — so the Electron app never shells out to `pluginkit` or parses its
// output itself.
//
//   lart-screensaver-helper status [module]        -> {"active":true|false}
//   lart-screensaver-helper activate [module]       -> {"active":true}; exit 0 on success
//   lart-screensaver-helper register <appex-path>   -> {"registered":bool,"path":string|null}
//   lart-screensaver-helper unregister <appex-path> -> {"unregistered":true}; exit 0 on success
//   lart-screensaver-helper find [bundle-id]        -> {"registered":bool,"path":string|null}
//
// `module` is the extension's bundle name (ScreensaverArtExtension.appex),
// matching how Aerial/AppexSaverMinimal name theirs, and defaults to ours.
// `bundle-id` defaults to our extension's bundle identifier. The Electron app
// always passes explicit values; the optional defaults exist for testing.

@main
struct Helper {
    static let defaultModule = "ScreensaverArtExtension"
    static let defaultBundleID = "com.livingart.screensaver.app.Extension"

    @MainActor
    static func main() async {
        let paperSaver = PaperSaver()
        let pluginkit = PluginkitManager.shared
        let args = CommandLine.arguments
        let cmd = args.count > 1 ? args[1] : ""
        let arg = args.count > 2 ? args[2] : nil

        switch cmd {
        case "status":
            emit(["active": isActive(paperSaver, module: arg ?? defaultModule)])

        case "activate":
            do {
                try await paperSaver.setScreensaverEverywhere(module: arg ?? defaultModule)
                emit(["active": true])
            } catch {
                fail("activate failed: \(error.localizedDescription)", code: 1)
            }

        case "register":
            guard let path = arg else {
                fail("usage: lart-screensaver-helper register <appex-path>", code: 2)
            }
            do {
                try pluginkit.registerExtension(at: URL(fileURLWithPath: path))
                // `pluginkit -a` can report odd exit states, so confirm the
                // extension actually landed by re-querying instead of trusting it.
                emit(registration(pluginkit, bundleID: defaultBundleID))
            } catch {
                fail("register failed: \(error.localizedDescription)", code: 1)
            }

        case "unregister":
            guard let path = arg else {
                fail("usage: lart-screensaver-helper unregister <appex-path>", code: 2)
            }
            do {
                try pluginkit.unregisterExtension(at: URL(fileURLWithPath: path))
                emit(["unregistered": true])
            } catch {
                fail("unregister failed: \(error.localizedDescription)", code: 1)
            }

        case "find":
            emit(registration(pluginkit, bundleID: arg ?? defaultBundleID))

        default:
            fail("usage: lart-screensaver-helper [status|activate|register|unregister|find] [arg]", code: 2)
        }
    }

    @MainActor
    static func isActive(_ paperSaver: PaperSaver, module: String) -> Bool {
        guard let info = paperSaver.getActiveScreensaver(for: nil) else { return false }
        return info.identifier == module || info.name == module
    }

    // Look up our extension by bundle id and report whether pluginkit knows it
    // and (if so) the path it has registered. PaperSaver does the parsing.
    static func registration(_ pluginkit: PluginkitManager, bundleID: String) -> [String: Any] {
        let ext = try? pluginkit.findExtension(byBundleIdentifier: bundleID)
        return ["registered": ext != nil, "path": ext?.path.path ?? NSNull()]
    }

    static func emit(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let json = String(data: data, encoding: .utf8) else {
            print("{}")
            return
        }
        print(json)
    }

    static func fail(_ message: String, code: Int32) -> Never {
        FileHandle.standardError.write(Data((message + "\n").utf8))
        exit(code)
    }
}
