import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy — Living Art Screensaver",
  description:
    "How Living Art Screensaver collects, uses, and protects your personal information, including data received when you sign in with Google.",
}

const CONTACT_EMAIL = "livingartscreensaver@gmail.com"

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 7, 2026">
      <p>
        This Privacy Policy explains how Living Art Screensaver (&ldquo;Living Art,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares
        information when you visit{" "}
        <a href="https://living-art-screensaver.com">living-art-screensaver.com</a>, create an
        account, or use our desktop application and screensaver (together, the
        &ldquo;Service&rdquo;). We&rsquo;ve tried to keep it short and readable.
      </p>
      <p>
        By using the Service, you agree to the collection and use of information in accordance with
        this policy.
      </p>

      <h2>Information We Collect</h2>

      <h3>Account information</h3>
      <p>
        When you create an account, we collect your <strong>email address</strong> and a securely
        hashed password. Authentication is handled by our provider, Supabase. If you instead sign in
        with Google, see &ldquo;Signing in with Google&rdquo; below.
      </p>

      <h3>Subscription and billing information</h3>
      <p>
        Payments are processed by <strong>Stripe</strong>. We do not see or store your full card
        number — Stripe handles that directly. We store a Stripe customer and subscription
        identifier and your subscription status and billing period dates so we know whether your
        subscription is active.
      </p>

      <h3>Diagnostic and error reports</h3>
      <p>
        If you choose to send an error report from the desktop app, we collect a diagnostic snapshot
        to help us fix problems: app, operating-system, and Electron versions; installation and
        code-signing diagnostics; a summary of your local cache; and recent application logs. These
        reports <strong>do not</strong> include any artwork/video content or your authentication
        token.
      </p>

      <h3>Usage analytics</h3>
      <p>
        On the website we use privacy-friendly, aggregated analytics (Vercel Analytics) to
        understand traffic and improve the site. This does not use cross-site tracking cookies.
      </p>

      <h3>Content stored on your device</h3>
      <p>
        Artwork videos are downloaded and cached locally on your computer so the screensaver can
        play them offline. This cache stays on your device and is not uploaded to us.
      </p>

      <h2>How We Use Information</h2>
      <ul>
        <li>To create and maintain your account and authenticate you.</li>
        <li>To provide the Service — syncing your gallery and verifying your subscription.</li>
        <li>To process payments and manage subscriptions (via Stripe).</li>
        <li>To diagnose, fix, and improve the Service using error reports you send.</li>
        <li>To communicate with you about your account, security, or important changes.</li>
        <li>To comply with legal obligations and enforce our Terms of Service.</li>
      </ul>

      <h2>Signing in with Google</h2>
      <p>
        If you choose to sign in with Google, Google shares a limited set of profile information with
        us — typically your <strong>name</strong>, <strong>email address</strong>, and{" "}
        <strong>profile picture</strong>. We use this information only to create and secure your
        account and to identify you within the Service.
      </p>
      <p>
        Living Art&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not sell Google user data, and we do not use
        it for advertising. You can revoke our access at any time from your{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Account permissions
        </a>{" "}
        page.
      </p>

      <h2>How We Share Information</h2>
      <p>
        We do not sell your personal information. We share information only with service providers
        who help us operate the Service, and only as needed to provide it:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication, database, and secure storage for accounts,
          subscription records, and error reports.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing and subscription management.
        </li>
        <li>
          <strong>Vercel</strong> — website hosting and aggregated analytics.
        </li>
        <li>
          <strong>Cloudflare R2</strong> — delivery of artwork video assets.
        </li>
        <li>
          <strong>Google</strong> — if you choose to sign in with Google.
        </li>
      </ul>
      <p>
        We may also disclose information if required by law, to protect our rights or the safety of
        others, or in connection with a business transfer (such as a merger or acquisition).
      </p>

      <h2>Data Retention</h2>
      <p>
        We keep your account and subscription information for as long as your account is active. If
        you delete your account, we delete or anonymize your personal information within a reasonable
        period, except where we must retain it to comply with legal, tax, or accounting obligations.
        Error reports are retained only as long as useful for diagnostics.
      </p>

      <h2>Data Security</h2>
      <p>
        We use reputable providers and reasonable technical measures to protect your information,
        including encrypted connections and access controls. No method of transmission or storage is
        100% secure, so we cannot guarantee absolute security.
      </p>

      <h2>Your Rights and Choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, export, or delete
        your personal information, and to object to or restrict certain processing. You can update
        your account details in the app, manage your subscription through the Stripe billing portal,
        and request account deletion by contacting us at the address below. If you signed in with
        Google, you can revoke access from your Google Account permissions page.
      </p>

      <h2>Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed to children under 13 (or the minimum age required in your
        jurisdiction), and we do not knowingly collect personal information from them. If you believe
        a child has provided us information, please contact us and we will delete it.
      </p>

      <h2>International Users</h2>
      <p>
        We operate from the United States, and your information may be processed in the United States
        and other countries where our service providers operate. By using the Service, you consent
        to this transfer.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we&rsquo;ll revise the
        &ldquo;Last updated&rdquo; date above, and for material changes we&rsquo;ll provide a more
        prominent notice. Your continued use of the Service after changes take effect means you
        accept the updated policy.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or your information, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
