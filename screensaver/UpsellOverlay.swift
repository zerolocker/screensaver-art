import Cocoa

// MARK: - Upsell Overlay

/// Full-screen overlay shown after the free content loops.
/// Auto-dismisses after 30 s via the timer managed in ScreensaverArtView.
class UpsellOverlay: NSView {

    private let totalCount: Int

    init(frame: NSRect, totalCount: Int) {
        self.totalCount = totalCount
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

        let heading = label("Unlock \(totalCount) Living Artworks",
                            size: 28, weight: .semibold, color: .white)
        heading.alignment = .center

        let body = label(
            "You're watching the free preview.\nSubscribe for $0.99 / month to unlock the full gallery.",
            size: 15, color: NSColor(white: 0.85, alpha: 1)
        )
        body.alignment             = .center
        body.maximumNumberOfLines  = 3
        body.lineBreakMode         = .byWordWrapping

        let urlLbl = label(API.subscribeURL, size: 14,
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
