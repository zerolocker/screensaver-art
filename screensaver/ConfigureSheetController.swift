import Cocoa

// MARK: - Configure Sheet

/// The "Options…" panel shown in System Settings → Screen Saver → Options.
/// Shows a login form when signed out; shows subscription status and a Sign Out button when signed in.
class ConfigureSheetController: NSObject {

    private var window:        NSWindow?
    private var statusLabel:   NSTextField?
    private var emailLabel:    NSTextField?
    private var emailField:    NSTextField?
    private var passwordLabel: NSTextField?
    private var passwordField: NSSecureTextField?
    private var loginButton:   NSButton?
    private var logoutButton:  NSButton?
    private var onDismiss:     (() -> Void)?

    // MARK: Public

    func makeWindow(onDismiss: @escaping () -> Void) -> NSWindow {
        self.onDismiss = onDismiss

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 380, height: 280),
            styleMask:   [.titled, .closable],
            backing:     .buffered,
            defer:       false
        )
        panel.title                    = "Living Art — Account"
        panel.isMovableByWindowBackground = true
        self.window = panel

        buildContent(in: panel.contentView!)
        refreshUI()
        return panel
    }

    // MARK: UI Construction

    private func buildContent(in content: NSView) {
        content.wantsLayer = true
        let pad: CGFloat = 24

        let statusLbl = makeLabel("", size: 12, color: .secondaryLabelColor)
        statusLbl.lineBreakMode       = .byWordWrapping
        statusLbl.maximumNumberOfLines = 3
        statusLbl.alignment           = .center
        content.addSubview(statusLbl)
        statusLabel = statusLbl

        let emailLbl = makeLabel("Email", size: 13, weight: .medium)
        content.addSubview(emailLbl)
        emailLabel = emailLbl

        let emailFld = NSTextField()
        emailFld.translatesAutoresizingMaskIntoConstraints = false
        emailFld.placeholderString = "you@example.com"
        emailFld.font = NSFont.systemFont(ofSize: 13)
        content.addSubview(emailFld)
        emailField = emailFld

        let pwLbl = makeLabel("Password", size: 13, weight: .medium)
        content.addSubview(pwLbl)
        passwordLabel = pwLbl

        let pwFld = NSSecureTextField()
        pwFld.translatesAutoresizingMaskIntoConstraints = false
        pwFld.placeholderString = "••••••••"
        pwFld.font = NSFont.systemFont(ofSize: 13)
        content.addSubview(pwFld)
        passwordField = pwFld

        let loginBtn = NSButton(title: "Sign In", target: self, action: #selector(loginTapped))
        loginBtn.translatesAutoresizingMaskIntoConstraints = false
        loginBtn.bezelStyle   = .rounded
        loginBtn.keyEquivalent = "\r"
        content.addSubview(loginBtn)
        loginButton = loginBtn

        let logoutBtn = NSButton(title: "Sign Out", target: self, action: #selector(logoutTapped))
        logoutBtn.translatesAutoresizingMaskIntoConstraints = false
        logoutBtn.bezelStyle = .rounded
        content.addSubview(logoutBtn)
        logoutButton = logoutBtn

        let doneBtn = NSButton(title: "Done", target: self, action: #selector(doneTapped))
        doneBtn.translatesAutoresizingMaskIntoConstraints = false
        doneBtn.bezelStyle = .rounded
        content.addSubview(doneBtn)

        NSLayoutConstraint.activate([
            statusLbl.topAnchor.constraint(equalTo: content.topAnchor, constant: pad),
            statusLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            statusLbl.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            emailLbl.topAnchor.constraint(equalTo: statusLbl.bottomAnchor, constant: 16),
            emailLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),

            emailFld.topAnchor.constraint(equalTo: emailLbl.bottomAnchor, constant: 4),
            emailFld.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            emailFld.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            pwLbl.topAnchor.constraint(equalTo: emailFld.bottomAnchor, constant: 12),
            pwLbl.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),

            pwFld.topAnchor.constraint(equalTo: pwLbl.bottomAnchor, constant: 4),
            pwFld.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            pwFld.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),

            loginBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            loginBtn.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            loginBtn.widthAnchor.constraint(equalToConstant: 100),

            logoutBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            logoutBtn.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: pad),
            logoutBtn.widthAnchor.constraint(equalToConstant: 100),

            doneBtn.topAnchor.constraint(equalTo: pwFld.bottomAnchor, constant: 20),
            doneBtn.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -pad),
            doneBtn.widthAnchor.constraint(equalToConstant: 80),
        ])
    }

    private func makeLabel(_ text: String, size: CGFloat,
                            weight: NSFont.Weight = .regular,
                            color: NSColor = .labelColor) -> NSTextField {
        let lbl = NSTextField(labelWithString: text)
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.font      = NSFont.systemFont(ofSize: size, weight: weight)
        lbl.textColor = color
        return lbl
    }

    // MARK: State

    private func refreshUI() {
        let loggedIn = AuthManager.shared.isLoggedIn

        emailLabel?.isHidden    =  loggedIn
        emailField?.isHidden    =  loggedIn
        passwordLabel?.isHidden =  loggedIn
        passwordField?.isHidden =  loggedIn
        loginButton?.isHidden   =  loggedIn
        logoutButton?.isHidden  = !loggedIn

        if loggedIn {
            let email  = AuthManager.shared.email ?? "your account"
            let active = SubscriptionCache.shared.isActive
            let total  = SubscriptionCache.shared.totalCount
            if active {
                statusLabel?.stringValue = "✓ Signed in as \(email)\n✓ Subscription active — all \(total) artworks unlocked."
                statusLabel?.textColor   = NSColor(calibratedRed: 0.2, green: 0.65, blue: 0.3, alpha: 1)
            } else {
                statusLabel?.stringValue = "Signed in as \(email)\nNo active subscription. Visit \(API.subscribeURL) to subscribe."
                statusLabel?.textColor   = .secondaryLabelColor
            }
        } else {
            statusLabel?.stringValue = "Sign in to unlock all artworks."
            statusLabel?.textColor   = .secondaryLabelColor
        }
    }

    // MARK: Actions

    @objc private func loginTapped() {
        guard let email = emailField?.stringValue, !email.isEmpty,
              let pw    = passwordField?.stringValue, !pw.isEmpty else {
            statusLabel?.stringValue = "Please enter your email and password."
            statusLabel?.textColor   = .systemRed
            return
        }
        loginButton?.isEnabled   = false
        statusLabel?.stringValue = "Signing in…"
        statusLabel?.textColor   = .secondaryLabelColor

        AuthManager.shared.signIn(email: email, password: pw) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success:
                GalleryFetcher.shared.fetch { [weak self] _, _, _ in
                    self?.loginButton?.isEnabled = true
                    self?.passwordField?.stringValue = ""
                    self?.refreshUI()
                }
            case .failure(let err):
                self.statusLabel?.stringValue = err.localizedDescription
                self.statusLabel?.textColor   = .systemRed
                self.loginButton?.isEnabled   = true
            }
        }
    }

    @objc private func logoutTapped() {
        AuthManager.shared.signOut()
        refreshUI()
    }

    @objc private func doneTapped() {
        guard let w = window else { return }
        w.sheetParent?.endSheet(w)
        w.orderOut(nil)
        onDismiss?()
    }
}
