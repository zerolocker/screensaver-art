import Cocoa
import Darwin
import ScreenSaver
import AVFoundation

// MARK: - Model

struct ArtItem: Decodable {
    let src: String
    let title: String
    let type: String

    static let baseURL = "https://tempzero-clawd.github.io/screensaver-art/"
    var mediaURL: URL { URL(string: ArtItem.baseURL + src)! }
    var isVideo: Bool { type == "video" }
}

// MARK: - Screensaver View

@objc(ScreensaverArtView)
class ScreensaverArtView: ScreenSaverView {

    // ── Items ───────────────────────────────────────────────────────────────
    private var items:         [ArtItem] = []
    private var shuffledOrder: [Int]     = []
    private var orderPos:      Int       = 0

    // ── A/B layers for crossfade ────────────────────────────────────────────
    // Each slot holds either an AVPlayerLayer (video) or a plain CALayer (image).
    private var slotA: CALayer?
    private var slotB: CALayer?
    private var activeSlot: CALayer?   // whichever is currently visible

    // Keep strong refs to players so ARC doesn't kill them
    private var playerA: AVPlayer?
    private var playerB: AVPlayer?
    private var loopObsA: Any?
    private var loopObsB: Any?

    // ── Title pill ──────────────────────────────────────────────────────────
    private var titleLabel: NSTextField?

    // ── Timer ───────────────────────────────────────────────────────────────
    private var advanceTimer: Timer?
    private let displayDuration: TimeInterval = 8.0
    private let fadeDuration:    TimeInterval = 1.5

    // MARK: Init

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        buildUI()
        fetchItems()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        buildUI()
        fetchItems()
    }

    // MARK: UI

    private func buildUI() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor

        // Two blank placeholder layers (black)
        let a = CALayer()
        a.frame = bounds; a.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        a.backgroundColor = NSColor.black.cgColor; a.opacity = 0
        layer?.addSublayer(a); slotA = a

        let b = CALayer()
        b.frame = bounds; b.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        b.backgroundColor = NSColor.black.cgColor; b.opacity = 0
        layer?.addSublayer(b); slotB = b

        // Title pill at bottom-center (matches the web app style)
        let fontSize: CGFloat = isPreview ? 7 : 12
        let lbl = NSTextField(labelWithString: "")
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.textColor      = .white
        lbl.font           = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        lbl.alignment      = .center
        lbl.isBezeled      = false
        lbl.isEditable     = false
        lbl.drawsBackground = true
        lbl.backgroundColor = NSColor(white: 0, alpha: 0.6)
        lbl.wantsLayer     = true
        lbl.layer?.cornerRadius = isPreview ? 8 : 20
        lbl.layer?.masksToBounds = true
        addSubview(lbl)
        titleLabel = lbl

        let pad: CGFloat = isPreview ? 6 : 20
        NSLayoutConstraint.activate([
            lbl.centerXAnchor.constraint(equalTo: centerXAnchor),
            lbl.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -pad),
            lbl.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.85),
        ])
    }

    // MARK: Fetch & Parse

    private func fetchItems() {
        let url = URL(string: "https://tempzero-clawd.github.io/screensaver-art/gallery.json")!
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data else { return }
            guard let parsed = try? JSONDecoder().decode([ArtItem].self, from: data),
                  !parsed.isEmpty else { return }

            DispatchQueue.main.async {
                self.items         = parsed
                self.shuffledOrder = Array(0..<parsed.count).shuffled()
                self.orderPos      = 0
                self.showCurrent()
                self.startTimer()
            }
        }.resume()
    }

    // MARK: Playback

    private func showCurrent() {
        guard !items.isEmpty else { return }
        show(items[shuffledOrder[orderPos]])
    }

    private func show(_ item: ArtItem) {
        // Decide which slot is incoming vs outgoing
        let incoming: CALayer = (activeSlot === slotA) ? slotB! : slotA!
        let outgoing: CALayer? = activeSlot

        // Bring incoming above outgoing
        if let out = outgoing { layer?.insertSublayer(incoming, above: out) }

        // Tear down whatever was in the incoming slot
        clearSlot(incoming)

        if item.isVideo {
            fillVideo(slot: incoming, url: item.mediaURL, isA: incoming === slotA)
        } else {
            fillImage(slot: incoming, url: item.mediaURL)
        }

        // Crossfade
        CATransaction.begin()
        CATransaction.setAnimationDuration(fadeDuration)
        incoming.opacity = 1
        outgoing?.opacity = 0
        CATransaction.commit()

        activeSlot = incoming

        // Title pill — pad with spaces for the pill effect
        let padded = "  \(item.title)  "
        titleLabel?.stringValue = padded
    }

    private func clearSlot(_ slot: CALayer) {
        // Remove AVPlayerLayer sublayers
        slot.sublayers?.forEach { $0.removeFromSuperlayer() }
        slot.contents = nil

        // Pause & release whichever player owned this slot
        if slot === slotA {
            playerA?.pause(); playerA = nil
            if let obs = loopObsA { NotificationCenter.default.removeObserver(obs) }
            loopObsA = nil
        } else {
            playerB?.pause(); playerB = nil
            if let obs = loopObsB { NotificationCenter.default.removeObserver(obs) }
            loopObsB = nil
        }
    }

    private func fillVideo(slot: CALayer, url: URL, isA: Bool) {
        let player = AVPlayer(url: url)
        player.isMuted = true

        let pLayer = AVPlayerLayer(player: player)
        pLayer.frame              = slot.bounds
        pLayer.autoresizingMask   = [.layerWidthSizable, .layerHeightSizable]
        pLayer.videoGravity       = .resizeAspectFill
        pLayer.backgroundColor    = NSColor.black.cgColor
        slot.addSublayer(pLayer)

        player.play()

        // Loop forever
        let obs = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object:  player.currentItem,
            queue:   .main
        ) { _ in
            player.seek(to: .zero)
            player.play()
        }

        if isA { playerA = player; loopObsA = obs }
        else   { playerB = player; loopObsB = obs }
    }

    private func fillImage(slot: CALayer, url: URL) {
        URLSession.shared.dataTask(with: url) { [weak slot] data, _, _ in
            guard let data, let img = NSImage(data: data) else { return }
            DispatchQueue.main.async {
                slot?.contentsGravity = .resizeAspectFill
                slot?.contents        = img
            }
        }.resume()
    }

    // MARK: Timer

    private func startTimer() {
        advanceTimer?.invalidate()
        advanceTimer = Timer.scheduledTimer(withTimeInterval: displayDuration,
                                             repeats: true) { [weak self] _ in
            guard let self, !self.items.isEmpty else { return }
            self.orderPos = (self.orderPos + 1) % self.shuffledOrder.count
            self.showCurrent()
        }
    }

    // MARK: ScreenSaverView lifecycle

    override func animateOneFrame() { }

    override func startAnimation() {
        super.startAnimation()
        if !items.isEmpty { startTimer() }
    }

    override func stopAnimation() {
        super.stopAnimation()
        advanceTimer?.invalidate()
        advanceTimer = nil
        playerA?.pause()
        playerB?.pause()
    }

    // MARK: Configure sheet (none needed — URL is hardcoded to GitHub Pages)

    override var hasConfigureSheet: Bool { false }
    override var configureSheet:    NSWindow? { nil }
}
