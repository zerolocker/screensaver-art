// Caption copy for the social clips — shared by the asset engine (which writes a
// human-readable captions.md and burns the title pill) and the poster (which
// sends the same strings to the four platforms).
//
// ONE FIXED LINE, ON PURPOSE (founder call, 2026-09-12). Instagram and YouTube
// posts lead with the same short sentence, CAPTION below, and TikTok with the
// same pitch pointed at its pinned comment, TIKTOK_CAPTION. The clip
// itself carries no marketing text — a post that reads as an ad gets scrolled
// past, and words on screen pull attention off the art — so the caption is where
// a post quietly says this is an app, not an account that shares daily art.
//   - Short, because a phone shows a line or two before "more".
//   - No URL, because those three platforms don't make caption links clickable.
//     The profile's bio link does that job, or on TikTok the pinned comment.
//   - No "Mac", deliberately: interest from people on other platforms is a signal
//     worth seeing.
//
// Behind "more", each post names its piece in the same words as the title pill,
// so posts stay distinguishable to search. Repeating the first line nightly is
// not a duplicate to Zernio, which fingerprints the text and the media together.
//
// Pinterest is the exception. A pin is itself a link, to the piece's own
// /art/<slug> page, so it never says "Link in bio". Its title leads with the
// piece's style, because pin titles are what Pinterest search ranks and people
// search a style ("ukiyo-e"), not a piece's name. No hashtags there: Pinterest
// ranks the words in a pin, not its tags.
//
// HASHTAGS come from the piece itself (lib/hashtags.mjs): its movement and its
// era, where either has a real audience, after the two every post carries. Four
// at most on Instagram and TikTok (Instagram caps a post at five), and three in a
// YouTube description, the most YouTube shows beside the title.
//
// TikTok also gets LINK_COMMENT, which the poster comments under each video and
// pins. That account can't have a clickable bio link (it has no Business switch,
// and a personal account needs 1,000 followers), so its caption says "Link in
// comment and bio" (founder call, 2026-09-14): the pinned comment carries the
// address, and the bio carries it as plain text. TikTok makes neither clickable.
//
// REAL ARTWORKS (`source: "real_artwork"` in gallery.json — a public-domain
// painting with AI motion) keep the same fixed first lines, but behind "more"
// they lead with the painting and painter ("Caillebotte's Paris Street; Rainy
// Day, brought to life") plus a museum credit, take their hashtags from the
// artist and movement (#caillebotte #impressionism #arthistory…), and their
// YouTube and pin titles name the painting and the artist.
//
// Everything is a pure function of the piece, so a retried post republishes
// byte-identical copy.

import { artPhrase, artistMovement, artistShortName, artworkHashtags, pieceHashtags } from './hashtags.mjs'
import { SITE_ORIGIN, landingUrl } from './pieces.mjs'

/** What the app is, in as few words as a phone will show. */
const PITCH = 'Animated art screensaver app'

/** The first (on a phone, often the only visible) line of every IG / YouTube post. */
export const CAPTION = `${PITCH} - Link in bio`

/** TikTok's first line: its link lives in the pinned comment, and as plain text in the bio. */
const TIKTOK_CAPTION = `${PITCH} - Link in comment and bio`

/** Pinned under every TikTok video. Verified visible to signed-out viewers, 2026-09-14. */
const LINK_COMMENT = `Get the screensaver app: ${SITE_ORIGIN.replace(/^https?:\/\//, '')}`

/** The piece as the title pill names it, e.g. "The Street Food Stall · Contemporary Illustration". */
export const titleLine = (title, style) => `${title} · ${style}`

const clamp = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Distinct hashtags, first `max` of them, as one line. */
const hashtagLine = (tags, max) => [...new Set(tags)].slice(0, max).join(' ')

/** "Caillebotte's", "Rubens'" — for a name that may end in s. */
const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)

/**
 * The lead for a real artwork, naming the painting and the painter:
 * "Caillebotte's Paris Street; Rainy Day, brought to life".
 */
export function artworkLead(title, artwork) {
  const short = artistShortName(artwork.artist)
  return short ? `${possessive(short)} ${title}, brought to life` : `${title}, brought to life`
}

/** "Gustave Caillebotte, 1877 · Art Institute of Chicago · Public domain" */
export function artworkCreditLine(artwork) {
  return [
    [artwork.artist, artwork.originalDate].filter(Boolean).join(', '),
    artwork.museum,
    artwork.license === 'CC0' ? 'CC0' : 'Public domain',
  ].filter(Boolean).join(' · ')
}

/** Shorten `lead` until `lead + tail` fits in `max`. */
const fitWithTail = (lead, tail, max) => `${clamp(lead, max - tail.length)}${tail}`

/**
 * Captions for a real public-domain artwork. Same skeleton as an AI piece —
 * the IG / TikTok first lines are the SAME fixed lines (founder calls,
 * 2026-09-12/-14) — but the copy behind "more" leads with the painting and the
 * painter, credits the museum, and the hashtags come from the artist.
 */
function artworkCaptions({ title, era, webSlug, artwork }) {
  const lead = artworkLead(title, artwork)
  const credit = artworkCreditLine(artwork)
  const own = artworkHashtags({ artist: artwork.artist, era })
  const movement = artistMovement(artwork.artist)
  const phrase = movement ? null : artPhrase({ style: null, era })
  const body = `${lead}\n${credit}`
  return {
    instagram: { text: `${CAPTION}\n\n${body}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}` },
    tiktok: {
      text: `${TIKTOK_CAPTION}\n\n${body}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}`,
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // The Shorts title names the painting and the painter, then keeps the
      // fixed line's job (what this is, and where the link is) as room allows.
      title: `${lead} | ${CAPTION}`.length <= 100
        ? `${lead} | ${CAPTION}`
        : fitWithTail(lead, ' - Link in bio', 100),
      description: `${body}\n\n${hashtagLine([...own, '#animatedart'], 3)}`,
      tags: ['screensaver app', 'animated art', artwork.artist, title, movement, 'art history']
        .filter(Boolean).map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
    },
    pinterest: {
      // Painting and painter first: for a real work, that's what people search.
      title: fitWithTail(`${title} by ${artwork.artist}, animated`, ' | Art screensaver app', 100),
      // Pinterest ranks the words in a pin, so the movement (or era) is named too.
      description: `${lead}. ${credit}.${movement ? ` ${movement}.` : phrase ? ` ${capitalize(phrase)}.` : ''} ` +
        'The real artwork, gently animated with AI for your screensaver by Living Art Screensaver, ' +
        'with a new piece every night.',
      link: landingUrl(webSlug, 'pinterest'),
    },
  }
}

/**
 * Every string the four platforms need for one piece. `era` is its gallery tag
 * ("Japanese", "Modern"…), or null for a clip rendered from outside the gallery.
 * `artwork` is a real artwork's provenance (`artworkOf` in lib/pieces.mjs), or
 * null for an AI piece.
 */
export function buildCaptions({ title, style, era = null, webSlug, artwork = null }) {
  if (artwork) return artworkCaptions({ title, era, webSlug, artwork })
  const piece = titleLine(title, style)
  const own = pieceHashtags({ style, era })
  const phrase = artPhrase({ style, era })
  return {
    instagram: { text: `${CAPTION}\n\n${piece}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}` },
    tiktok: {
      text: `${TIKTOK_CAPTION}\n\n${piece}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}`,
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // The Shorts player shows the title, so the fixed line goes there; the
      // description (rarely seen, but searched) names the piece. Its hashtags put
      // the piece's own first: YouTube shows up to three beside the title.
      title: CAPTION,
      description: `${piece}\n\n${hashtagLine([...own, '#animatedart'], 3)}`,
      // YouTube splits tags on commas and rejects angle brackets.
      tags: ['screensaver app', 'animated art', style, title].map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
    },
    pinterest: {
      // Style first: it is what people search for, and search ranks the title.
      title: clamp(`Animated ${style}: ${title} | Art screensaver app`, 100),
      description: `${piece}. ${phrase ? `${capitalize(phrase)}, gently animated` : 'Gently animated art'} ` +
        'for your screensaver by Living Art Screensaver, with a new piece every night.',
      // Tagged with the channel so PostHog can attribute pin traffic.
      link: landingUrl(webSlug, 'pinterest'),
    },
  }
}

/** The human-facing record written next to the rendered clips. */
export function captionsMarkdown({ title, style, era = null, webSlug, artwork = null }) {
  const c = buildCaptions({ title, style, era, webSlug, artwork })
  const landing = webSlug ? `\`/art/${webSlug}\`` : 'the home page (no gallery entry for this source)'
  return `# Social captions — ${title}

_These are exactly the strings \`post-social.mjs\` publishes, so what you read here
is what went out. Instagram and YouTube lead with the same fixed line and leave
the linking to the profile's bio; TikTok's points at a pinned comment and the bio;
the pin links to ${landing}._

## Instagram Reels
\`\`\`
${c.instagram.text}
\`\`\`

## TikTok
\`\`\`
${c.tiktok.text}
\`\`\`
**Pinned comment:** \`${c.tiktok.linkComment}\`

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
