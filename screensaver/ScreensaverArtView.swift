import Cocoa
import ScreenSaver
import AVFoundation

// MARK: - Screensaver View
//
// Pure player. Reads the manifest written by the Electron companion app,
// decrypts each video to a temp file, and crossfades between them.
//
// All auth, subscription, gallery-fetching, upsell, and configure-sheet logic
// lives in the Electron app now. If the cache is empty (user hasn't synced
// yet), we show a black screen with a hint.

@objc(ScreensaverArtView)
class ScreensaverArtView: ScreenSaverView {

    // MARK: State

    private var items:         [CachedItem] = []
    private var shuffledOrder: [Int]        = []
    private var orderPos:      Int          = 0
    private var isSubscribed:  Bool         = true
    private var totalCount:    Int          = 0
    private var freeLoopCount: Int          = 0
    private let upsellAfterLoops            = 1

    // MARK: A/B crossfade layers

    private var slotA: CALayer?
    private var slotB: CALayer?
    private var activeSlot: CALayer?

    private var playerA:  AVPlayer?
    private var playerB:  AVPlayer?
    private var loopObsA: Any?
    private var loopObsB: Any?
    private var tmpURLA:  URL?
    private var tmpURLB:  URL?

    // MARK: UI

    private var pillContainer: NSView?
    private var titleLabel:    NSTextField?
    private var emptyState:    NSTextField?
    private var upsellOverlay: UpsellOverlay?
    private var upsellVisible  = false

    // MARK: Timing

    private var advanceTimer:    Timer?
    private let displayDuration: TimeInterval = 8.0
    private let fadeDuration:    TimeInterval = 1.5

    // MARK: Init

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        buildUI()
        loadFromCache()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        buildUI()
        loadFromCache()
    }

    // MARK: Cache loading

    private func loadFromCache() {
        let manifest = CachedGallery.shared.loadManifest()
        let newItems = (manifest?.items ?? []).filter { $0.isVideo }
        items         = newItems
        shuffledOrder = Array(0..<newItems.count).shuffled()
        orderPos      = 0
        isSubscribed  = manifest?.isSubscribed ?? true
        totalCount    = manifest?.totalCount ?? 0
        freeLoopCount = 0
        hideUpsell()
        if newItems.isEmpty {
            showEmptyState()
        } else {
            hideEmptyState()
            showCurrent()
            startTimer()
        }
    }

    // MARK: UI construction

    private func buildUI() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor

        let a = makeSlot(); slotA = a
        let b = makeSlot(); slotB = b
        layer?.addSublayer(a)
        layer?.addSublayer(b)

        buildTitlePill()
    }

    private func makeSlot() -> CALayer {
        let slot = CALayer()
        slot.frame            = bounds
        slot.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        slot.backgroundColor  = NSColor.black.cgColor
        slot.opacity          = 0
        return slot
    }

    private func buildTitlePill() {
        let fontSize:  CGFloat = isPreview ? 7  : 12
        let radius:    CGFloat = isPreview ? 10 : 24
        let pad:       CGFloat = isPreview ? 6  : 20
        let hInset:    CGFloat = isPreview ? 12 : 20
        let vInset:    CGFloat = isPreview ? 6  : 12
        let minHeight: CGFloat = isPreview ? 20 : 40

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.wantsLayer = true
        container.layer?.cornerRadius  = radius
        container.layer?.masksToBounds = false
        container.layer?.shadowColor   = NSColor.black.cgColor
        container.layer?.shadowOpacity = 0.35
        container.layer?.shadowOffset  = CGSize(width: 0, height: -2)
        container.layer?.shadowRadius  = 12
        if let scale = NSScreen.main?.backingScaleFactor {
            container.layer?.contentsScale = scale
        }
        addSubview(container)
        pillContainer = container

        let blur = NSVisualEffectView()
        blur.translatesAutoresizingMaskIntoConstraints = false
        blur.material     = .hudWindow
        blur.blendingMode = .withinWindow
        blur.state        = .active
        blur.alphaValue   = 0.65
        blur.wantsLayer   = true
        blur.layer?.cornerRadius  = radius
        blur.layer?.masksToBounds = true
        container.addSubview(blur, positioned: .below, relativeTo: nil)

        let lbl = NSTextField(labelWithString: "")
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.textColor       = .white
        lbl.font            = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        lbl.alignment       = .center
        lbl.isBezeled       = false
        lbl.isEditable      = false
        lbl.drawsBackground = false
        lbl.wantsLayer      = true
        container.addSubview(lbl)
        titleLabel = lbl

        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: centerXAnchor),
            container.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -pad),
            container.widthAnchor.constraint(equalTo: lbl.widthAnchor, constant: 2 * hInset),
            container.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.85),
            container.heightAnchor.constraint(equalTo: lbl.heightAnchor, constant: 2 * vInset),
            container.heightAnchor.constraint(greaterThanOrEqualToConstant: minHeight),

            blur.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            blur.topAnchor.constraint(equalTo: container.topAnchor),
            blur.bottomAnchor.constraint(equalTo: container.bottomAnchor),

            lbl.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: hInset),
            lbl.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -hInset),
            lbl.topAnchor.constraint(equalTo: container.topAnchor, constant: vInset),
            lbl.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -vInset),
        ])
    }

    // MARK: Empty state

    private func showEmptyState() {
        guard !isPreview else { return }
        pillContainer?.isHidden = true
        if emptyState == nil {
            let lbl = NSTextField(labelWithString:
                "Open the Living Art Screensaver app to sync your gallery.")
            lbl.translatesAutoresizingMaskIntoConstraints = false
            lbl.textColor = NSColor(white: 0.7, alpha: 1)
            lbl.font      = NSFont.systemFont(ofSize: 16, weight: .regular)
            lbl.alignment = .center
            lbl.drawsBackground = false
            lbl.isBezeled       = false
            addSubview(lbl)
            NSLayoutConstraint.activate([
                lbl.centerXAnchor.constraint(equalTo: centerXAnchor),
                lbl.centerYAnchor.constraint(equalTo: centerYAnchor),
            ])
            emptyState = lbl
        }
    }

    private func hideEmptyState() {
        emptyState?.removeFromSuperview()
        emptyState = nil
        pillContainer?.isHidden = false
    }

    // MARK: Playback

    private func showCurrent() {
        guard !items.isEmpty else { return }
        show(items[shuffledOrder[orderPos]])
    }

    private func show(_ item: CachedItem) {
        let incoming: CALayer  = (activeSlot === slotA) ? slotB! : slotA!
        let outgoing: CALayer? = activeSlot

        if let out = outgoing { layer?.insertSublayer(incoming, above: out) }
        clearSlot(incoming)

        guard let url = CachedGallery.shared.playableURL(for: item) else {
            // Skip and try the next one.
            advance()
            return
        }
        fillVideo(slot: incoming, url: url, isA: incoming === slotA)

        CATransaction.begin()
        CATransaction.setAnimationDuration(fadeDuration)
        incoming.opacity = 1
        outgoing?.opacity = 0
        CATransaction.commit()

        activeSlot = incoming
        updateTitle(item.title)
    }

    private func updateTitle(_ title: String) {
        guard let lbl = titleLabel else { return }
        let fontSize: CGFloat = isPreview ? 7 : 12
        let ps = NSMutableParagraphStyle()
        ps.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [
            .font:           NSFont.systemFont(ofSize: fontSize, weight: .medium),
            .foregroundColor: NSColor.white,
            .kern:           isPreview ? 0 : 1.2,
            .paragraphStyle: ps,
        ]
        lbl.attributedStringValue = NSAttributedString(string: "  \(title)  ", attributes: attrs)
    }

    private func advance() {
        guard !items.isEmpty else { return }
        let nextPos = (orderPos + 1) % shuffledOrder.count

        if !isSubscribed && nextPos == 0 {
            freeLoopCount += 1
            if freeLoopCount >= upsellAfterLoops {
                showUpsell()
                return
            }
        }

        orderPos = nextPos
        showCurrent()
    }

    // MARK: Upsell

    private func showUpsell() {
        guard !upsellVisible, !isPreview else { return }
        upsellVisible = true
        advanceTimer?.invalidate()

        let overlay = UpsellOverlay(frame: bounds, totalCount: totalCount > 0 ? totalCount : items.count)
        overlay.autoresizingMask = [.width, .height]
        overlay.alphaValue = 0
        addSubview(overlay)
        upsellOverlay = overlay

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 1.0
            overlay.animator().alphaValue = 1
        }

        Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
            self?.hideUpsell()
            self?.freeLoopCount = 0
            self?.startTimer()
        }
    }

    private func hideUpsell() {
        upsellVisible = false
        upsellOverlay?.removeFromSuperview()
        upsellOverlay = nil
    }

    // MARK: Slot management

    private func clearSlot(_ slot: CALayer) {
        slot.sublayers?.forEach { $0.removeFromSuperlayer() }
        slot.contents = nil
        if slot === slotA {
            playerA?.pause(); playerA = nil
            if let obs = loopObsA { NotificationCenter.default.removeObserver(obs) }
            loopObsA = nil
            CachedGallery.shared.releasePlayable(tmpURLA)
            tmpURLA = nil
        } else {
            playerB?.pause(); playerB = nil
            if let obs = loopObsB { NotificationCenter.default.removeObserver(obs) }
            loopObsB = nil
            CachedGallery.shared.releasePlayable(tmpURLB)
            tmpURLB = nil
        }
    }

    private func fillVideo(slot: CALayer, url: URL, isA: Bool) {
        let player = AVPlayer(url: url)
        player.isMuted = true

        let pLayer = AVPlayerLayer(player: player)
        pLayer.frame            = slot.bounds
        pLayer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        pLayer.videoGravity     = .resizeAspectFill
        pLayer.backgroundColor  = NSColor.black.cgColor
        slot.addSublayer(pLayer)
        player.play()

        let obs = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object:  player.currentItem,
            queue:   .main
        ) { _ in player.seek(to: .zero); player.play() }

        if isA { playerA = player; loopObsA = obs; tmpURLA = url }
        else   { playerB = player; loopObsB = obs; tmpURLB = url }
    }

    // MARK: Timer

    private func startTimer() {
        advanceTimer?.invalidate()
        advanceTimer = Timer.scheduledTimer(withTimeInterval: displayDuration,
                                            repeats: true) { [weak self] _ in self?.advance() }
    }

    // MARK: ScreenSaverView lifecycle

    override func animateOneFrame() {}

    override func startAnimation() {
        super.startAnimation()
        // Re-read the manifest every time we wake up so a fresh sync from the
        // Electron app is picked up without rebooting the screensaver.
        loadFromCache()
    }

    override func stopAnimation() {
        super.stopAnimation()
        advanceTimer?.invalidate(); advanceTimer = nil
        playerA?.pause()
        playerB?.pause()
    }

    override var hasConfigureSheet: Bool { false }
}
