import Foundation
import ScreenSaver

// The NSExtensionPrincipalClass in Info.plist. Like Apple's Arabesque.appex, it
// only implements init().

private let logger = LartLog.logger("Extension")

@objc(ScreensaverArtExtension)
class ScreensaverArtExtension: ScreenSaverExtension {

    @objc override init() {
        logger.info("ScreensaverArtExtension.init() PID=\(ProcessInfo.processInfo.processIdentifier, privacy: .public)")
        super.init()
    }

    deinit {
        logger.info("ScreensaverArtExtension.deinit")
    }
}
