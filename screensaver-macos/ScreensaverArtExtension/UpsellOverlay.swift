import Cocoa

// MARK: - Upsell Overlay
//
// Shown after the free preview loops once. ScreensaverArtView reads the
// `isSubscribed` flag from the cache manifest (written by the Electron app)
// to decide whether to show this — the screensaver itself never talks to
// the subscription API.

class UpsellOverlay: NSView {

    override init(frame: NSRect) {
        super.init(frame: frame)
        build()
    }

    required init?(coder: NSCoder) { fatalError("not supported") }

    // MARK: Layout

    private func build() {
        wantsLayer = true
        layer?.backgroundColor = NSColor(white: 0, alpha: 0.72).cgColor

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment   = .centerX
        stack.spacing     = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let heading = label("Unlock the full gallery",
                            size: 28, weight: .semibold, color: .white)
        heading.alignment = .center

        let body = label(
            "You're on the free plan. Unlock the full gallery — plus a new piece every day.",
            size: 15, color: NSColor(white: 0.85, alpha: 1)
        )
        body.alignment            = .center
        body.maximumNumberOfLines = 3
        body.lineBreakMode        = .byWordWrapping

        let urlLbl = label("living-art-screensaver.com", size: 14,
                           color: NSColor(calibratedRed: 0.4, green: 0.75, blue: 1.0, alpha: 1))
        urlLbl.font      = NSFont.monospacedSystemFont(ofSize: 14, weight: .regular)
        urlLbl.alignment = .center

        stack.addArrangedSubview(heading)
        stack.addArrangedSubview(body)
        stack.addArrangedSubview(urlLbl)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.75),
        ])
    }

    private func label(_ text: String, size: CGFloat,
                       weight: NSFont.Weight = .regular,
                       color: NSColor = .white) -> NSTextField {
        let lbl = NSTextField(labelWithString: text)
        lbl.font      = NSFont.systemFont(ofSize: size, weight: weight)
        lbl.textColor = color
        return lbl
    }
}
