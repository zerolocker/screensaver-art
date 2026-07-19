import Cocoa

// MARK: - Upsell Pill
//
// A gentle, non-blocking subscribe nudge for free-plan users. It's a small
// frosted pill that sits just above the title pill and NEVER covers the art —
// ScreensaverArtView fades it in and out on a slow cycle (16s on / 16s off) so
// the gallery can breathe. (This replaced an older full-screen modal that
// blacked out the art for 30s — far too distracting for an art screensaver.)
//
// A screensaver can't be clicked (any input quits it), so the copy points the
// user back to the Electron app, where the Subscribe button lives. The
// `isSubscribed` flag comes from the cache manifest the Electron app writes; the
// screensaver itself never talks to the subscription API.

class UpsellPill: NSView {

    private let radius: CGFloat = 18

    override init(frame: NSRect) {
        super.init(frame: frame)
        build()
    }

    required init?(coder: NSCoder) { fatalError("not supported") }

    private func build() {
        wantsLayer = true
        layer?.cornerRadius  = radius
        layer?.masksToBounds = false
        // Match the title pill's soft drop shadow so the nudge reads as the same
        // family of chrome rather than a foreign element.
        layer?.shadowColor   = NSColor.black.cgColor
        layer?.shadowOpacity = 0.35
        layer?.shadowOffset  = CGSize(width: 0, height: -2)
        layer?.shadowRadius  = 12
        if let scale = NSScreen.main?.backingScaleFactor {
            layer?.contentsScale = scale
        }

        let blur = NSVisualEffectView()
        blur.translatesAutoresizingMaskIntoConstraints = false
        blur.material     = .hudWindow
        blur.blendingMode = .withinWindow
        blur.state        = .active
        blur.alphaValue   = 0.65
        blur.wantsLayer   = true
        blur.layer?.cornerRadius  = radius
        blur.layer?.masksToBounds = true
        addSubview(blur)

        let icon = NSImageView()
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.image = NSImage(systemSymbolName: "sparkles", accessibilityDescription: nil)
        icon.contentTintColor = NSColor(calibratedRed: 0.62, green: 0.88, blue: 0.80, alpha: 1)
        icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 13, weight: .medium)
        icon.setContentHuggingPriority(.required, for: .horizontal)

        let lbl = NSTextField(labelWithString:
            "Enjoying the free preview? Unlock the full gallery in the Living Art app")
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.textColor       = .white
        lbl.font            = NSFont.systemFont(ofSize: 13, weight: .medium)
        lbl.isBezeled       = false
        lbl.isEditable      = false
        lbl.drawsBackground = false

        let stack = NSStackView(views: [icon, lbl])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.orientation = .horizontal
        stack.alignment   = .centerY
        stack.spacing     = 8
        addSubview(stack)

        NSLayoutConstraint.activate([
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),

            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 9),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -9),
        ])
    }
}
