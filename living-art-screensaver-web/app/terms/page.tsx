import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service — Living Art Screensaver",
  description:
    "The terms and conditions governing your use of the Living Art Screensaver website, desktop app, and screensaver.",
}

const CONTACT_EMAIL = "livingartscreensaver@gmail.com"

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 7, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Living Art Screensaver
        (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
        including our website at{" "}
        <a href="https://living-art-screensaver.com">living-art-screensaver.com</a>, our desktop
        application, and our screensaver (together, the &ldquo;Service&rdquo;). By creating an
        account or using the Service, you agree to these Terms. If you do not agree, please do not
        use the Service.
      </p>

      <h2>The Service</h2>
      <p>
        Living Art Screensaver is a screensaver that plays a curated gallery of AI-animated artworks on your
        computer. The desktop app downloads and caches artwork to your device and installs the
        screensaver. New artworks are added to the gallery from time to time.
      </p>

      <h2>Accounts and Eligibility</h2>
      <p>
        You must be at least 13 years old (or the minimum age required in your jurisdiction) to use
        the Service. You are responsible for the accuracy of your account information and for keeping
        your login credentials secure. You are responsible for all activity that occurs under your
        account. Notify us promptly of any unauthorized use.
      </p>

      <h2>Subscriptions, Billing, and Refunds</h2>
      <p>
        The Service offers a <strong>free tier</strong> that includes the first 100 artworks. A paid
        <strong> subscription</strong> unlocks the full gallery and ongoing new additions.
      </p>
      <ul>
        <li>
          The subscription is advertised at <strong>$0.99/month</strong> and is{" "}
          <strong>billed quarterly</strong> as a single charge of <strong>$2.97 every 3 months</strong>.
        </li>
        <li>
          Subscriptions renew automatically at the end of each billing period unless you cancel
          beforehand.
        </li>
        <li>
          You can cancel at any time through the billing portal; cancellation takes effect at the end
          of the current billing period, and you retain paid access until then.
        </li>
        <li>
          Prices and the contents of the free and paid tiers may change; we&rsquo;ll give notice of
          material changes, and any price change applies to the next billing period.
        </li>
      </ul>
      <p>
        Except where required by law, payments are non-refundable. Payment processing is handled by
        Stripe and is subject to Stripe&rsquo;s terms.
      </p>

      <h2>License and Acceptable Use</h2>
      <p>
        Subject to these Terms, we grant you a personal, non-exclusive, non-transferable, revocable
        license to use the Service and to display the artwork through the screensaver on devices you
        own or control. You agree not to:
      </p>
      <ul>
        <li>
          Copy, extract, redistribute, publicly display, sell, or otherwise exploit the artwork
          outside the Service.
        </li>
        <li>
          Circumvent, disable, or interfere with any access controls, content protection, or
          obfuscation in the Service.
        </li>
        <li>
          Reverse engineer, decompile, or attempt to derive source code, except to the extent this
          restriction is prohibited by law.
        </li>
        <li>Share your account, or use the Service in violation of any applicable law.</li>
        <li>Disrupt, overload, or attempt to gain unauthorized access to the Service or its systems.</li>
      </ul>

      <h2>Intellectual Property</h2>
      <p>
        The Service, including the artworks, software, designs, and trademarks, is owned by Living
        Art or its licensors and is protected by intellectual-property laws. Your subscription grants
        you access to view the artwork through the Service — it does not transfer any ownership or
        grant any rights beyond the license described above.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        The Service relies on third-party providers (including Supabase, Stripe, Vercel, Cloudflare,
        and, if you choose, Google sign-in). Your use of those services may be subject to their own
        terms and privacy policies. We are not responsible for third-party services.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
        <strong>&ldquo;as available&rdquo;</strong> without warranties of any kind, whether express
        or implied, including warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or
        secure.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Living Art Screensaver will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss of data, profits, or
        goodwill, arising from your use of the Service. Our total liability for any claim relating to
        the Service will not exceed the greater of the amount you paid us in the 12 months before the
        claim or USD $50.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate your access if you violate these Terms or if necessary to protect the Service or
        other users. Provisions that by their nature should survive termination (such as
        intellectual property, disclaimers, and limitation of liability) will survive.
      </p>

      <h2>Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we&rsquo;ll revise the &ldquo;Last
        updated&rdquo; date above, and for material changes we&rsquo;ll provide a more prominent
        notice. Your continued use of the Service after changes take effect means you accept the
        updated Terms.
      </p>

      <h2>Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of California, United States, without
        regard to its conflict-of-laws rules. You agree that the state and federal courts located in
        California will have exclusive jurisdiction over any disputes arising out of or relating to
        these Terms or the Service, except where prohibited by applicable law.
      </p>

      <h2>Contact Us</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
