import Foundation
import ScreenSaver

// Principal class for the screensaver extension. Specified as
// NSExtensionPrincipalClass in Info.plist as
// `$(PRODUCT_MODULE_NAME).ScreensaverArtExtension`.
//
// Following Apple's own screensavers (e.g. Arabesque.appex) we keep this
// minimal — only implement init() and let the framework drive lifecycle.

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
