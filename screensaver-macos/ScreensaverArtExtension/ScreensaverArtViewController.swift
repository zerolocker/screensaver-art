import AppKit
import ScreenSaver

// The ScreenSaverViewControllerClass in Info.plist. Like Apple's Arabesque.appex,
// it overrides only init and loadView.

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
