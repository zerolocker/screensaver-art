import Cocoa
import ScreenSaver
import AVFoundation

// MARK: - Screensaver View

@objc(ScreensaverArtView)
class ScreensaverArtView: ScreenSaverView {

    // MARK: State

    private var items:         [ArtItem] = []
    private var shuffledOrder: [Int]     = []
    private var orderPos:      Int       = 0
    private var isSubscribed:  Bool      = false
    private var totalCount:    Int       = 0
    private var freeLoopCount: Int       = 0
    private let upsellAfterLoops         = 1

    // MARK: A/B crossfade layers

    private var slotA: CALayer?
    private var slotB: CALayer?
    private var activeSlot: CALayer?

    private var playerA:  AVPlayer?
    private var playerB:  AVPlayer?
    private var loopObsA: Any?
    private var loopObsB: Any?

    // MARK: UI components

    private var pillContainer: NSView?
    private var titleLabel:    NSTextField?
    private var upsellOverlay: UpsellOverlay?
    private var upsellVisible  = false

    // MARK: Timing

    private var advanceTimer:        Timer?
    private let displayDuration:     TimeInterval = 8.0
    private let fadeDuration:        TimeInterval = 1.5

    // MARK: Configure sheet

    private var configController = ConfigureSheetController()
    private var configWindow:    NSWindow?

    // MARK: Init

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        buildUI()
        loadGallery()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        buildUI()
        loadGallery()
    }

    // MARK: Gallery loading

    private func loadGallery() {
        // Offline-first: play from cache immediately if available
        if let cached   = VideoCache.shared.loadGalleryCache(),
           let response = try? JSONDecoder().decode(GalleryResponse.self, from: cached) {
            applyGallery(response.items, isSubscribed: response.isSubscribed, totalCount: response.totalCount)
        }

        // Then refresh from network (respects daily revalidation cadence)
        guard SubscriptionCache.shared.needsRevalidation || items.isEmpty else { return }
        GalleryFetcher.shared.fetchWithTokenRefresh { [weak self] newItems, isSubscribed, totalCount in
            guard let self, !newItems.isEmpty else { return }
            self.applyGallery(newItems, isSubscribed: isSubscribed, totalCount: totalCount)
        }
    }

    private func applyGallery(_ newItems: [ArtItem], isSubscribed: Bool, totalCount: Int) {
        self.items         = newItems
        self.isSubscribed  = isSubscribed
        self.totalCount    = totalCount
        self.shuffledOrder = Array(0..<newItems.count).shuffled()
        self.orderPos      = 0
        self.freeLoopCount = 0
        hideUpsell()
        showCurrent()
        startTimer()

        // Eagerly cache the free videos so they're available offline
        for item in newItems.prefix(API.freeItemCount) where item.isVideo {
            VideoCache.shared.cacheInBackground(item.mediaURL)
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

    // MARK: Playback

    private func showCurrent() {
        guard !items.isEmpty else { return }
        show(items[shuffledOrder[orderPos]])
    }

    private func show(_ item: ArtItem) {
        let incoming: CALayer = (activeSlot === slotA) ? slotB! : slotA!
        let outgoing: CALayer? = activeSlot

        if let out = outgoing { layer?.insertSublayer(incoming, above: out) }
        clearSlot(incoming)

        let playURL = item.isVideo ? VideoCache.shared.playbackURL(for: item.mediaURL) : item.mediaURL
        if item.isVideo {
            fillVideo(slot: incoming, url: playURL, isA: incoming === slotA)
            if playURL == item.mediaURL { VideoCache.shared.cacheInBackground(item.mediaURL) }
        } else {
            fillImage(slot: incoming, url: playURL)
        }

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

        let overlay = UpsellOverlay(frame: bounds, totalCount: totalCount > 0 ? totalCount : 123)
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
                                             repeats: true) { [weak self] _ in self?.advance() }
    }

    // MARK: ScreenSaverView lifecycle

    override func animateOneFrame() {}

    override func startAnimation() {
        super.startAnimation()
        if items.isEmpty {
            loadGallery()
        } else if SubscriptionCache.shared.needsRevalidation {
            GalleryFetcher.shared.fetchWithTokenRefresh { [weak self] newItems, isSubscribed, totalCount in
                guard let self, !newItems.isEmpty else { return }
                self.applyGallery(newItems, isSubscribed: isSubscribed, totalCount: totalCount)
            }
        } else {
            startTimer()
        }
    }

    override func stopAnimation() {
        super.stopAnimation()
        advanceTimer?.invalidate(); advanceTimer = nil
        playerA?.pause()
        playerB?.pause()
    }

    // MARK: Configure sheet

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        if configWindow == nil {
            configWindow = configController.makeWindow { [weak self] in
                self?.loadGallery()
            }
        }
        return configWindow
    }
}
