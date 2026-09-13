// Caption copy for the social clips — shared by the asset engine (which writes a
// human-readable captions.md and burns the title pill) and the poster (which
// sends the same strings to the four platforms).
//
// ONE FIXED LINE, ON PURPOSE (founder call, 2026-09-12). Instagram, TikTok and
// YouTube posts all lead with the same short sentence, CAPTION below. The clip
// itself carries no marketing text — a post that reads as an ad gets scrolled
// past, and words on screen pull attention off the art — so the caption is where
// a post quietly says this is an app, not an account that shares daily art.
//   - Short, because a phone shows a line or two before "more".
//   - No URL, because those three platforms don't make caption links clickable.
//     The profile's bio link does that job.
//   - No "Mac", deliberately: interest from people on other platforms is a signal
//     worth seeing.
//
// Behind "more", each post names its piece in the same words as the title pill,
// so posts stay distinguishable to search. Repeating the first line nightly is
// not a duplicate to Zernio, which fingerprints the text and the media together.
//
// Pinterest is the exception. A pin is itself a link, to the piece's own
// /art/<slug> page, so it never says "Link in bio"; and its title names the
// piece, because pin titles are what Pinterest search ranks.
//
// Everything is a pure function of the piece, so a retried post republishes
// byte-identical copy.

import { landingUrl } from './pieces.mjs'

/** What the app is, in as few words as a phone will show. */
const PITCH = 'Screensaver app with animated art'

/** The first (on a phone, often the only visible) line of every IG / TikTok / YouTube post. */
export const CAPTION = `${PITCH} - Link in bio`

/** The piece as the title pill names it, e.g. "The Street Food Stall · Contemporary Illustration". */
export const titleLine = (title, style) => `${title} · ${style}`

const clamp = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

/** Every string the four platforms need for one piece. */
export function buildCaptions({ title, style, webSlug }) {
  const piece = titleLine(title, style)
  return {
    instagram: { text: `${CAPTION}\n\n${piece}` },
    // Two broad hashtags: TikTok's search leans on them more than the others' does.
    tiktok: { text: `${CAPTION}\n\n${piece}\n#screensaver #animatedart` },
    youtube: {
      // The Shorts player shows the title, so the fixed line goes there; the
      // description (rarely seen, but searched) names the piece.
      title: CAPTION,
      description: piece,
      // YouTube splits tags on commas and rejects angle brackets.
      tags: ['screensaver app', 'animated art', style, title].map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
    },
    pinterest: {
      title: clamp(`${PITCH}: ${title}`, 100),
      description: `${piece}. Animated art from Living Art Screensaver.`,
      // Tagged with the channel so PostHog can attribute pin traffic.
      link: landingUrl(webSlug, 'pinterest'),
    },
  }
}

/** The human-facing record written next to the rendered clips. */
export function captionsMarkdown({ title, style, webSlug }) {
  const c = buildCaptions({ title, style, webSlug })
  const landing = webSlug ? `\`/art/${webSlug}\`` : 'the home page (no gallery entry for this source)'
  return `# Social captions — ${title}

_These are exactly the strings \`post-social.mjs\` publishes, so what you read here
is what went out. Instagram, TikTok and YouTube lead with the same fixed line and
leave the linking to the profile's bio; the pin links to ${landing}._

## Instagram Reels
\`\`\`
${c.instagram.text}
\`\`\`

## TikTok
\`\`\`
${c.tiktok.text}
\`\`\`

## YouTube Shorts
**Title:** \`${c.youtube.title}\`
**Tags:** ${c.youtube.tags.join(', ')}
\`\`\`
${c.youtube.description}
\`\`\`

## Pinterest
**Title:** \`${c.pinterest.title}\`
**Link:** ${c.pinterest.link}
\`\`\`
${c.pinterest.description}
\`\`\`
`
}
