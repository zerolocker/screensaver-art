import Foundation
import OSLog
import PaperSaverKit

// Logs go to the unified log; stdout is for the JSON the app parses. Watch with:
//   log stream --predicate 'subsystem == "com.livingart.screensaver.app"' --level debug
private let logger = Logger(subsystem: "com.livingart.screensaver.app", category: "helper")

// The Electron app calls this for the Swift-only work: reading and setting the
// active screensaver, and registering or finding our .appex. It wraps
// PaperSaver (`PaperSaver` and `PluginkitManager`).
//
//   lart-screensaver-helper status [module]        -> {"active":true|false}
//   lart-screensaver-helper activate [module]       -> {"active":true}; exit 0 on success
//   lart-screensaver-helper register <appex-path>   -> {"registered":bool,"path":string|null}
//   lart-screensaver-helper unregister <appex-path> -> {"unregistered":true}; exit 0 on success
//   lart-screensaver-helper find [bundle-id]        -> {"registered":bool,"path":string|null}
//
// `module` (the bundle name) and `bundle-id` default to ours, for testing; the
// app always passes them.

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
        logger.debug("command: \(cmd, privacy: .public) arg: \(arg ?? "nil", privacy: .public)")

        switch cmd {
        case "status":
            let active = isActive(paperSaver, module: arg ?? defaultModule)
            logger.info("status: active=\(active, privacy: .public)")
            emit(["active": active])

        case "activate":
            do {
                try await paperSaver.setScreensaverEverywhere(module: arg ?? defaultModule)
                logger.info("activate: set active screensaver")
                emit(["active": true])
            } catch {
                logger.error("activate failed: \(error.localizedDescription, privacy: .public)")
                fail("activate failed: \(error.localizedDescription)", code: 1)
            }

        case "register":
            guard let path = arg else {
                fail("usage: lart-screensaver-helper register <appex-path>", code: 2)
            }
            do {
                logger.info("register: pluginkit -a \(path, privacy: .public)")
                try pluginkit.registerExtension(at: URL(fileURLWithPath: path))
                // Don't trust `pluginkit -a`'s exit status; query instead.
                let result = registration(pluginkit, bundleID: defaultBundleID)
                logger.info("register: registered=\(String(describing: result["registered"]), privacy: .public)")
                emit(result)
            } catch {
                logger.error("register failed: \(error.localizedDescription, privacy: .public)")
                fail("register failed: \(error.localizedDescription)", code: 1)
            }

        case "unregister":
            guard let path = arg else {
                fail("usage: lart-screensaver-helper unregister <appex-path>", code: 2)
            }
            do {
                logger.info("unregister: pluginkit -r \(path, privacy: .public)")
                try pluginkit.unregisterExtension(at: URL(fileURLWithPath: path))
                emit(["unregistered": true])
            } catch {
                logger.error("unregister failed: \(error.localizedDescription, privacy: .public)")
                fail("unregister failed: \(error.localizedDescription)", code: 1)
            }

        case "find":
            let result = registration(pluginkit, bundleID: arg ?? defaultBundleID)
            logger.info("find: registered=\(String(describing: result["registered"]), privacy: .public)")
            emit(result)

        default:
            fail("usage: lart-screensaver-helper [status|activate|register|unregister|find] [arg]", code: 2)
        }
    }

    @MainActor
    static func isActive(_ paperSaver: PaperSaver, module: String) -> Bool {
        guard let info = paperSaver.getActiveScreensaver(for: nil) else { return false }
        return info.identifier == module || info.name == module
    }

    // Whether pluginkit knows the extension, and its registered path.
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
