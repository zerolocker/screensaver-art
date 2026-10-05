import Cocoa
import ScreenSaver
import AVFoundation

// MARK: - Screensaver View
//
// A pure player: reads the manifest the Electron app writes, decrypts each video
// to a temp file, and crossfades between them. Shows a hint if the cache is empty.
//
// Start/stop is driven from viewDidMoveToWindow, which works in both
// ScreenSaverEngine and the System Settings preview, as well as from
// startAnimation/stopAnimation.

@objc(ScreensaverArtView)
class ScreensaverArtView: ScreenSaverView {

    // MARK: State

    private var items:         [CachedItem] = []
    private var shuffledOrder: [Int]        = []
    private var orderPos:      Int          = 0
    private var isSubscribed:  Bool         = true

    // Manifest mtime at last load, to pick up a sync mid-session.
    private var lastManifestMtime: Date? = nil

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
    private var upsellPill:    UpsellPill?

    // MARK: Timing

    private var advanceTimer:    Timer?
    private let displayDuration: TimeInterval = 7.8
    private let fadeDuration:    TimeInterval = 1.5

    // Free users' subscribe pill shows for `nudgeInterval`, then hides for as long.
    private var nudgeTimer:      Timer?
    private let nudgeInterval:   TimeInterval = 16
    private let nudgeFade:       TimeInterval = 1.0

    // MARK: Init

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        buildUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        buildUI()
    }

    // MARK: View lifecycle

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil {
            loadFromCache()
        } else {
            stopPlayback()
        }
    }

    // MARK: Cache loading

    private func loadFromCache() {
        let manifest = CachedGallery.shared.loadManifest()
        let newItems = (manifest?.items ?? []).filter { $0.isVideo }
        items         = newItems
        shuffledOrder = Array(0..<newItems.count).shuffled()
        orderPos      = 0
        isSubscribed  = manifest?.isSubscribed ?? true
        lastManifestMtime = manifestMtime()
        teardownUpsell()
        if newItems.isEmpty {
            // "Never synced" and "nothing selected" get different hints.
            showEmptyState(synced: manifest != nil)
        } else {
            hideEmptyState()
            showCurrent()
        }
        // Run the timer even when empty, so a sync in progress gets picked up.
        startTimer()
        // Re-evaluated on every load, so subscribing mid-session stops the nudge.
        startUpsellNudge()
    }

    /// Reload if the app rewrote the manifest since we loaded it. Returns true on
    /// reload, in which case the caller shouldn't also advance.
    @discardableResult
    private func reloadIfManifestChanged() -> Bool {
        guard let mod = manifestMtime() else { return false }
        if let last = lastManifestMtime, mod <= last { return false }
        loadFromCache()
        return true
    }

    private func manifestMtime() -> Date? {
        let attrs = try? FileManager.default.attributesOfItem(atPath: Cache.manifestFile.path)
        return attrs?[.modificationDate] as? Date
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

    private func showEmptyState(synced: Bool) {
        guard !isPreview else { return }
        pillContainer?.isHidden = true
        let message = synced
            ? "No artwork selected. Open the Living Art Screensaver app to choose what plays."
            : "Open the Living Art Screensaver app to sync your gallery."
        if let existing = emptyState {
            existing.stringValue = message
            return
        }
        let lbl = NSTextField(labelWithString: message)
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
        // A reload reshuffles and starts playback itself.
        if reloadIfManifestChanged() { return }

        guard !items.isEmpty else { return }
        orderPos = (orderPos + 1) % shuffledOrder.count
        showCurrent()
    }

    // MARK: Upsell nudge

    /// Start the pill's fade cycle for free users. No-op when subscribed, in the
    /// System Settings preview, or when nothing is playing.
    private func startUpsellNudge() {
        guard !isSubscribed, !isPreview, !items.isEmpty else { return }
        ensureUpsellPill()
        // Start hidden, so the art is alone on screen first.
        nudgeTimer = Timer.scheduledTimer(withTimeInterval: nudgeInterval, repeats: true) {
            [weak self] _ in self?.toggleUpsellNudge()
        }
    }

    private func toggleUpsellNudge() {
        guard let pill = upsellPill else { return }
        let shouldShow = pill.alphaValue < 0.5
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = nudgeFade
            pill.animator().alphaValue = shouldShow ? 1 : 0
        }
    }

    private func ensureUpsellPill() {
        guard upsellPill == nil, let title = pillContainer else { return }
        let pill = UpsellPill(frame: .zero)
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.alphaValue = 0
        addSubview(pill)
        upsellPill = pill
        NSLayoutConstraint.activate([
            // Just above the title pill, never over the art.
            pill.centerXAnchor.constraint(equalTo: centerXAnchor),
            pill.bottomAnchor.constraint(equalTo: title.topAnchor, constant: -14),
            pill.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.85),
        ])
    }

    /// Stop the cycle and remove the pill entirely (e.g. on reload or stop).
    private func teardownUpsell() {
        nudgeTimer?.invalidate()
        nudgeTimer = nil
        upsellPill?.removeFromSuperview()
        upsellPill = nil
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
        let asset  = AVURLAsset(url: url)
        let player = AVPlayer(playerItem: AVPlayerItem(asset: asset))
        player.isMuted = true

        let pLayer = AVPlayerLayer(player: player)
        pLayer.frame            = slot.bounds
        pLayer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        pLayer.videoGravity     = .resizeAspectFill
        pLayer.backgroundColor  = NSColor.black.cgColor
        slot.addSublayer(pLayer)
        player.play()
        hangIfPortrait(asset, in: pLayer)

        let obs = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object:  player.currentItem,
            queue:   .main
        ) { _ in player.seek(to: .zero); player.play() }

        if isA { playerA = player; loopObsA = obs; tmpURLA = url }
        else   { playerB = player; loopObsB = obs; tmpURLB = url }
    }

    /// A portrait (9:16) piece is shown whole, centred on the dark wall, instead
    /// of being cropped to a thin band by aspect-fill. Landscape pieces keep
    /// filling the screen. The manifest carries no aspect, so the clip decides.
    /// Its track loads from the local temp file in milliseconds, while the slot
    /// is still near-transparent at the start of its 1.5s fade-in, and the wall
    /// covers the whole slot, so the crossfade reads the same in every pairing.
    private func hangIfPortrait(_ asset: AVURLAsset, in pLayer: AVPlayerLayer) {
        Task { @MainActor [weak pLayer] in
            guard let track = try? await asset.loadTracks(withMediaType: .video).first,
                  let (size, transform) = try? await track.load(.naturalSize, .preferredTransform)
            else { return }
            let shown = size.applying(transform)    // rotation metadata can turn the frame
            guard abs(shown.height) > abs(shown.width), let pLayer else { return }
            CATransaction.begin()
            CATransaction.setDisableActions(true)   // snap, don't animate the switch
            pLayer.videoGravity    = .resizeAspect
            pLayer.backgroundColor = Self.wallColor
            CATransaction.commit()
        }
    }

    /// #0b0b0d, the near-black wall the curation hangs real paintings on.
    private static let wallColor = CGColor(srgbRed: 11 / 255, green: 11 / 255, blue: 13 / 255, alpha: 1)

    // MARK: Timer

    private func startTimer() {
        advanceTimer?.invalidate()
        advanceTimer = Timer.scheduledTimer(withTimeInterval: displayDuration,
                                            repeats: true) { [weak self] _ in self?.advance() }
    }

    private func stopPlayback() {
        advanceTimer?.invalidate(); advanceTimer = nil
        nudgeTimer?.invalidate(); nudgeTimer = nil
        playerA?.pause()
        playerB?.pause()
    }

    // MARK: ScreenSaverView lifecycle

    override func animateOneFrame() {}

    override func startAnimation() {
        super.startAnimation()
        // Re-read the manifest on every start to pick up the latest sync.
        loadFromCache()
    }

    override func stopAnimation() {
        super.stopAnimation()
        stopPlayback()
    }
}
