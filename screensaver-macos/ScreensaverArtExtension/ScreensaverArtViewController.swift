import AppKit
import ScreenSaver

// Main view controller for the screensaver. Specified as
// ScreenSaverViewControllerClass in Info.plist as
// `$(PRODUCT_MODULE_NAME).ScreensaverArtViewController`.
//
// Mirrors Apple's Arabesque.appex pattern: only override init and loadView,
// and let the framework drive everything else.

private let logger = LartLog.logger("ViewController")

@objc(ScreensaverArtViewController)
class ScreensaverArtViewController: ScreenSaverViewController {

    /// Strong reference so the framework can't drop our view while we still own it.
    private var saverView: ScreensaverArtView?

    override init(nibName nibNameOrNil: NSNib.Name?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    /// Called by the framework to create the view.
    override func loadView() {
        let frame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let isPreview = frame.width < 400
        logger.info("loadView() frame=\(frame.size.width, privacy: .public)x\(frame.size.height, privacy: .public) isPreview=\(isPreview, privacy: .public)")

        let view = ScreensaverArtView(frame: frame, isPreview: isPreview)
        saverView = view
        self.view = view ?? NSView(frame: frame)
    }
}
